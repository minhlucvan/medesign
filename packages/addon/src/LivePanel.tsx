import React, { useState } from 'react';
import { useChannel } from '@storybook/manager-api';
import { api } from './api';
import { EVT_TOOL_MODE, EVT_COMMENT_SUBMIT, EVT_TEXT_SUBMIT, type ToolMode, type CommentTarget } from './channel';
import { useStudioState, Section, SectionTitle, Row, Muted, Btn, Textarea, Pill, ErrorBanner } from './ui';
import type { StudioState } from './constants';

/** The slim, story-scoped live loop: scores, diff, comments, quick actions. */
export function LivePanel() {
  const { state, error, refresh } = useStudioState();
  const [mode, setMode] = useState<ToolMode>('off');
  const [changeReq, setChangeReq] = useState('');

  const emit = useChannel({
    // a comment submitted from the in-canvas popover → post the intent
    [EVT_COMMENT_SUBMIT]: async (p: { target: CommentTarget; instruction: string }) => {
      try { await api.submitIntent({ type: 'comment', instruction: p.instruction, target: p.target }); refresh(); } catch { /* backend down */ }
    },
    // an inline text edit from the pen → an element-scoped edit-text intent
    [EVT_TEXT_SUBMIT]: async (p: { target: CommentTarget; from: string; to: string }) => {
      try {
        await api.submitIntent({
          type: 'edit-text',
          instruction: `Replace the text of ${p.target.selector} — was "${p.from}" — with: "${p.to}"`,
          target: p.target,
          payload: { textEdit: { from: p.from, to: p.to } },
        });
        refresh();
      } catch { /* backend down */ }
    },
    [EVT_TOOL_MODE]: (p: { mode: ToolMode }) => setMode(p?.mode ?? 'off'),
  });

  const toggleComment = () => { const next: ToolMode = mode === 'comment' ? 'off' : 'comment'; setMode(next); emit(EVT_TOOL_MODE, { mode: next }); };
  const commenting = mode === 'comment';

  if (error) return <div style={{ padding: 12 }}><ErrorBanner error={error} /></div>;

  return (
    <div style={{ padding: 12 }}>
      <Row gap={8} wrap>
        <Btn primary={commenting} onClick={toggleComment}>{commenting ? '● Commenting — click an element' : '🖈 Comment on element'}</Btn>
        <Muted>{state?.activeDesignSystem ?? '—'} · {state?.currentComponent ?? 'no component'}</Muted>
      </Row>

      <CritiqueBar state={state} />
      <DiffBox state={state} />

      <Section>
        <SectionTitle>Quick change request</SectionTitle>
        <Textarea rows={2} value={changeReq} onChange={(e) => setChangeReq(e.target.value)} placeholder="e.g. make the CTA the accent color" />
        <Row gap={8} style={{ marginTop: 6 }}>
          <Btn primary disabled={!changeReq.trim()} onClick={async () => { await api.submitIntent({ type: 'change-request', instruction: changeReq.trim() }); setChangeReq(''); refresh(); }}>Send</Btn>
          <Btn disabled={!state?.currentComponent} onClick={async () => { if (state?.currentComponent) { await api.capture(state.currentComponent); refresh(); } }}>Capture</Btn>
        </Row>
      </Section>

      <Muted>More in the <strong>medesign</strong> tab (design systems · queue · composers).</Muted>
    </div>
  );
}

export function CritiqueBar({ state }: { state: StudioState | null }) {
  const c = state?.lastCritique;
  if (!c) return null;
  const ship = c.decision === 'ship';
  const sources: Array<['visual' | 'tokens' | 'vision' | 'llm', string]> = [['tokens', 'rule'], ['visual', 'visual'], ['vision', 'vision'], ['llm', 'LLM']];
  return (
    <Section>
      <Row gap={8} wrap>
        <SectionTitle style={{ margin: 0 }}>Critique</SectionTitle>
        <Pill tone={ship ? 'ok' : 'warn'}>{ship ? 'SHIP' : 'CONTINUE'}</Pill>
        <Muted>composite {c.composite.toFixed(2)}</Muted>
        {c.mustFix > 0 && <Pill tone="bad">{c.mustFix} must-fix</Pill>}
      </Row>
      <Row gap={12} wrap style={{ marginTop: 6 }}>
        {sources.map(([k, label]) => (
          <Muted key={k} style={{ opacity: c.scores[k] == null ? 0.4 : 1 }}>{label}: {c.scores[k] != null ? (c.scores[k] as number).toFixed(2) : '—'}</Muted>
        ))}
      </Row>
    </Section>
  );
}

export function DiffBox({ state }: { state: StudioState | null }) {
  const diff = state?.lastDiff;
  if (!diff) return null;
  return (
    <Section>
      <Row gap={8}><SectionTitle style={{ margin: 0 }}>Visual</SectionTitle><Pill tone={diff.status === 'pass' ? 'ok' : diff.status === 'changed' ? 'warn' : 'muted'}>{diff.status}</Pill></Row>
      {diff.diffPng && <img src={`${diff.diffPng}?t=${Date.now()}`} alt="visual diff" style={{ maxWidth: '100%', marginTop: 6, borderRadius: 4 }} />}
    </Section>
  );
}
