import React, { useEffect, useRef, useState } from 'react';
import { addons } from '@storybook/preview-api';
import { EVT_TOOL_MODE, EVT_COMMENT_SUBMIT, EVT_TEXT_SUBMIT, EVT_COPIED, EVT_CHAT_MODE, type ToolMode, type CommentTarget } from './channel';

function cssPath(el: Element, root: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== root && cur.nodeType === 1) {
    let sel = cur.tagName.toLowerCase();
    const parent: Element | null = cur.parentElement;
    if (parent) {
      const sibs = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
      if (sibs.length > 1) sel += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
    }
    parts.unshift(sel);
    cur = cur.parentElement;
  }
  return parts.join(' > ');
}

type Box = { x: number; y: number; width: number; height: number };
type Pin = { n: number; box?: Box; text: string; sessionId?: string };

const ACCENT = '#2563eb';

function buildTarget(el: Element, root: Element, storyId?: string, component?: string): CommentTarget {
  const b = el.getBoundingClientRect();
  return {
    selector: cssPath(el, root),
    box: { x: b.x, y: b.y, width: b.width, height: b.height },
    text: (el.textContent ?? '').trim().slice(0, 120),
    tag: el.tagName.toLowerCase(),
    classes: typeof el.className === 'string' ? el.className : undefined,
    storyId,
    component,
  };
}

/** A human-readable + machine-readable descriptor of a picked element (for the copy tool). */
function describe(t: CommentTarget): string {
  const lines = [
    'emdesign element',
    t.component ? `component: ${t.component}` : '',
    t.storyId ? `story: ${t.storyId}` : '',
    `selector: ${t.selector}`,
    `tag: <${t.tag}>`,
    t.text ? `text: "${t.text}"` : '',
    t.classes ? `classes: "${t.classes}"` : '',
    t.box ? `box: ${Math.round(t.box.x)},${Math.round(t.box.y)} ${Math.round(t.box.width)}×${Math.round(t.box.height)}` : '',
  ].filter(Boolean);
  return `${lines.join('\n')}\n---\n${JSON.stringify(t)}`;
}

const HINTS: Record<ToolMode, string> = {
  off: '',
  comment: 'emdesign: click an element to comment · Esc to cancel',
  copy: 'emdesign: click an element to copy its identifier · Esc to cancel',
  text: 'emdesign: click a text element to edit it inline · Enter to apply · Esc to cancel',
};

/**
 * One canvas overlay for all three tools. It highlights the element under the cursor and, on click,
 * does the mode's action: open a comment popover, copy a rich descriptor to the clipboard, or make the
 * text editable inline and emit an edit-text intent on commit.
 */
function ToolOverlay({ storyId, component }: { storyId?: string; component?: string }) {
  const [mode, setModeState] = useState<ToolMode>('off');
  const [hover, setHover] = useState<DOMRect | null>(null);
  const [composing, setComposing] = useState<{ target: CommentTarget; box: Box } | null>(null);
  const [text, setText] = useState('');
  const [pins, setPins] = useState<Pin[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const modeRef = useRef<ToolMode>('off');
  const composingRef = useRef(false);
  const editingRef = useRef<{ el: HTMLElement; from: string } | null>(null);

  const setMode = (m: ToolMode) => {
    modeRef.current = m;
    setModeState(m);
    if (m === 'off') { setHover(null); composingRef.current = false; setComposing(null); setText(''); }
    document.body.style.cursor = m === 'off' ? '' : 'crosshair';
  };
  const offAndSync = () => { setMode('off'); addons.getChannel().emit(EVT_TOOL_MODE, { mode: 'off' }); };
  const flash = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 1600); };

  // commit/cancel the inline text edit
  const endEdit = (commit: boolean) => {
    const e = editingRef.current;
    if (!e) return;
    const to = (e.el.textContent ?? '').trim();
    e.el.contentEditable = 'false';
    e.el.style.outline = '';
    if (commit && to && to !== e.from) {
      const target = buildTarget(e.el, document.getElementById('storybook-root') ?? document.body, storyId, component);
      addons.getChannel().emit(EVT_TEXT_SUBMIT, { target, from: e.from, to });
      flash('text edit queued');
    } else if (!commit) {
      e.el.textContent = e.from; // revert
    }
    editingRef.current = null;
    offAndSync();
  };

  useEffect(() => {
    const channel = addons.getChannel();
    const onMode = (p: { mode: ToolMode }) => setMode(p?.mode ?? 'off');
    channel.on(EVT_TOOL_MODE, onMode);
    return () => { channel.off(EVT_TOOL_MODE, onMode); document.body.style.cursor = ''; };
  }, []);

  // Load stored comment pins and reset transient state when the story changes
  useEffect(() => {
    setPins([]);
    setComposing(null);
    editingRef.current = null;
    if (storyId) {
      fetch(`http://localhost:4321/api/comments?storyId=${encodeURIComponent(storyId)}`)
        .then(r => r.json())
        .then(data => {
          if (data.pins?.length) {
            setPins(data.pins.map((p: any) => ({ n: p.n, box: undefined, text: p.text, sessionId: p.sessionId })));
          }
        })
        .catch(() => {});
    }
  }, [storyId]);

  useEffect(() => {
    const root = document.getElementById('storybook-root') ?? document.body;
    const busy = () => composingRef.current || !!editingRef.current;
    const onMove = (e: MouseEvent) => {
      if (modeRef.current === 'off' || busy()) return;
      const el = e.target as Element | null;
      if (el && root.contains(el)) setHover(el.getBoundingClientRect());
    };
    const onClick = (e: MouseEvent) => {
      const m = modeRef.current;
      if (m === 'off' || busy()) return;
      const el = e.target as Element | null;
      if (!el || !root.contains(el)) return;
      e.preventDefault();
      e.stopPropagation();
      const target = buildTarget(el, root, storyId, component);

      if (m === 'comment') {
        composingRef.current = true;
        setComposing({ target, box: target.box as Box });
        setText('');
      } else if (m === 'copy') {
        const payload = describe(target);
        try { navigator.clipboard?.writeText(payload); } catch { /* clipboard blocked */ }
        addons.getChannel().emit(EVT_COPIED, { ok: true, selector: target.selector });
        setPins((p) => [...p, { n: p.length + 1, box: target.box as Box, text: 'copied' }]);
        flash(`copied <${target.tag}>`);
        offAndSync();
      } else if (m === 'text') {
        const he = el as HTMLElement;
        editingRef.current = { el: he, from: (he.textContent ?? '').trim() };
        he.contentEditable = 'true';
        he.style.outline = `2px solid ${ACCENT}`;
        he.focus();
        // place caret at the end
        const sel = window.getSelection?.();
        if (sel) { const r = document.createRange(); r.selectNodeContents(he); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
      }
    };
    const onEditKey = (e: KeyboardEvent) => {
      if (!editingRef.current) return;
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); endEdit(true); }
      else if (e.key === 'Escape') { e.preventDefault(); endEdit(false); }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editingRef.current) cancel(); };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onEditKey, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onEditKey, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [storyId, component]);

  const cancel = () => { composingRef.current = false; setComposing(null); setText(''); };
  const send = () => {
    if (!composing || !text.trim()) return;
    addons.getChannel().emit(EVT_COMMENT_SUBMIT, { target: composing.target, instruction: text.trim() });
    setPins((p) => [...p, { n: p.length + 1, box: composing.box, text: text.trim() }]);
    cancel();
    offAndSync();
  };

  const popLeft = composing ? Math.min(composing.box.x, window.innerWidth - 300) : 0;
  const popTop = composing ? Math.min(composing.box.y + composing.box.height + 8, window.innerHeight - 130) : 0;
  const active = mode !== 'off';

  return (
    <>
      {pins.map((p) => (
        <div key={`pin-${p.n}`} onClick={p.sessionId ? () => { addons.getChannel().emit(EVT_CHAT_MODE, { enabled: true, sessionId: p.sessionId }); } : undefined}
          title={p.text}
          style={{ position: 'fixed', top: p.box ? p.box.y - 10 : 10 + (p.n - 1) * 28, left: p.box ? p.box.x - 10 : 10, width: 20, height: 20, borderRadius: 999,
            background: p.sessionId ? '#7c3aed' : ACCENT, color: '#fff', font: '11px/20px sans-serif', textAlign: 'center', zIndex: 99997,
            boxShadow: '0 1px 4px rgba(0,0,0,.4)', cursor: p.sessionId ? 'pointer' : 'default' }}>{p.n}</div>
      ))}

      {(active || toast) && (
        <div style={{ position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 99999, background: '#111', color: '#fff', font: '12px sans-serif', padding: '5px 10px', borderRadius: 6, pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.4)' }}>
          {toast ?? (composing ? 'emdesign: type your comment' : HINTS[mode])}
        </div>
      )}

      {active && hover && !composing && !editingRef.current && (
        <div style={{ position: 'fixed', top: hover.top, left: hover.left, width: hover.width, height: hover.height, outline: `2px solid ${ACCENT}`, background: 'rgba(37,99,235,0.12)', zIndex: 99998, pointerEvents: 'none' }} />
      )}

      {composing && (
        <>
          <div style={{ position: 'fixed', top: composing.box.y, left: composing.box.x, width: composing.box.width, height: composing.box.height, outline: `2px solid ${ACCENT}`, background: 'rgba(37,99,235,0.12)', zIndex: 99998, pointerEvents: 'none' }} />
          <div style={{ position: 'fixed', top: popTop, left: popLeft, width: 280, zIndex: 100000, background: '#1c1c1f', color: '#fff', border: '1px solid #333', borderRadius: 8, padding: 10, boxShadow: '0 6px 24px rgba(0,0,0,.5)', font: '13px sans-serif' }}>
            <div style={{ opacity: 0.7, fontSize: 11, marginBottom: 6 }}>&lt;{composing.target.tag}&gt; {composing.target.text ? `“${composing.target.text.slice(0, 32)}”` : ''}</div>
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="what should change here?" rows={3} style={{ width: '100%', boxSizing: 'border-box', background: '#0f0f10', color: '#fff', border: '1px solid #333', borderRadius: 4, padding: 6, font: '13px sans-serif', resize: 'vertical' }} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
              <button onClick={cancel} style={{ cursor: 'pointer', background: 'transparent', color: '#aaa', border: '1px solid #444', borderRadius: 4, padding: '4px 10px' }}>Cancel</button>
              <button onClick={send} disabled={!text.trim()} style={{ cursor: 'pointer', background: ACCENT, color: '#fff', border: 0, borderRadius: 4, padding: '4px 12px', opacity: text.trim() ? 1 : 0.5 }}>Send (⌘↵)</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** Global decorator (registered via previewAnnotations) — mounts the overlay alongside every story. */
export const decorators = [
  (Story: React.ComponentType, context: { id?: string; title?: string }) => (
    <>
      <Story />
      <ToolOverlay storyId={context?.id} component={context?.title?.split('/').pop()} />
    </>
  ),
];
