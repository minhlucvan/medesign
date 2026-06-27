/**
 * ChatSidebar — shadcn-chatbot-kit styled. Messages fill available space.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { addons } from '@storybook/manager-api';
import { injectShadcnVars, css, MessageList, useAutoScroll, QuestionCard, PromptSuggestions } from '@emdesign/chat-ui';
import type { Message, Question, PromptSuggestion } from '@emdesign/chat-ui';
import { api } from '../api';
import { BACKEND_URL, CHAT_MODES } from '../constants';
import { EVT_ELEMENT_SELECTED, EVT_VIEW_CONTEXT } from '../channel';
import type { SessionSummary, ChatStartMode } from '../constants';
import type { ElementSelectedPayload, ViewContextPayload } from '../channel';

let varsInjected = false;

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function sanitizeText(text: string): string {
  return text
    .replace(/<\/?(command-name|system-reminder|local-command-caveat)[^>]*>/gi, '')
    .replace(/Caveat:.*?assume otherwise\./s, '')
    .trim();
}

function extractText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return sanitizeText(content);
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => sanitizeText(b.text ?? ''))
      .join('\n');
  }
  return '';
}

/**
 * Process Claude conversation messages sequentially.
 * Groups consecutive tool-only messages into a single collapsible "tool group".
 */
function processMessages(rawMessages: any[]): Message[] {
  const result: Message[] = [];
  const pendingTools: any[] = []; // tool_use waiting for tool_result
  let pendingToolGroup: Message | null = null; // accumulating tool-only messages

  function flushToolGroup() {
    if (!pendingToolGroup) return;
    const calls = pendingToolGroup.toolCalls || [];
    if (!calls.length) { pendingToolGroup = null; return; }
    const hasResults = calls.some((t: any) => t.state === 'result');
    if (hasResults) result.push(pendingToolGroup);
    pendingToolGroup = null;
  }

  for (const raw of rawMessages) {
    if (raw.type !== 'user' && raw.type !== 'assistant') continue;
    const isUser = raw.type === 'user';
    const blocks = raw.message?.content;

    let text = '';
    let reasoning: string | undefined;
    let hasText = false;

    if (typeof blocks === 'string') {
      text = sanitizeText(blocks);
      hasText = !!text;
    } else if (Array.isArray(blocks)) {
      for (const block of blocks) {
        if (block.type === 'text' && block.text?.trim()) {
          text += (text ? '\n\n' : '') + sanitizeText(block.text);
          hasText = true;
        } else if (block.type === 'thinking' && block.thinking?.trim()) {
          reasoning = block.thinking;
        } else if (block.type === 'tool_use') {
          pendingTools.push({ state: 'call', toolName: block.name || 'unknown', result: block.input || {} });
        } else if (block.type === 'tool_result') {
          const content = typeof block.content === 'string'
            ? block.content
            : Array.isArray(block.content)
              ? block.content.map((c: any) => typeof c === 'string' ? c : c.text || '').join('\n')
              : '';
          const pending = pendingTools.find(t => t.state === 'call');
          if (pending) {
            pending.state = 'result';
            pending.result = { output: content.trim().slice(0, 500) };
          }
        }
      }
    }

    // Collect completed tools
    const completed = pendingTools.filter(t => t.state === 'result');
    pendingTools.splice(0, pendingTools.length, ...pendingTools.filter(t => t.state !== 'result'));

    // Helper: accumulate tool results into the pending tool group
    const accumulateTools = () => {
      const toolCalls = [
        ...completed.map(t => ({ state: 'result' as const, toolName: t.toolName, result: t.result })),
        ...pendingTools.filter(t => t.state === 'call').map(t => ({ state: 'call' as const, toolName: t.toolName, result: t.result })),
      ];
      if (toolCalls.length === 0) return;
      if (!pendingToolGroup) {
        pendingToolGroup = {
          id: `tg-${Date.now()}-${Math.random()}`,
          role: 'assistant', content: '',
          createdAt: raw.timestamp ? new Date(raw.timestamp) : undefined,
          toolCalls: [],
        };
      }
      for (const tc of toolCalls) pendingToolGroup.toolCalls!.push(tc);
    };

    // User messages: flush tool group, create message (skip empty tool-result-only)
    if (isUser) {
      accumulateTools(); // save any completed tools before skipping
      flushToolGroup();
      if (hasText) {
        result.push({
          id: raw.uuid || `u-${Date.now()}-${Math.random()}`,
          role: 'user', content: text,
          createdAt: raw.timestamp ? new Date(raw.timestamp) : undefined,
        });
      }
      continue;
    }

    // Tool-only assistant message: accumulate into tool group
    if (!hasText) {
      accumulateTools();
      continue;
    }

    // Has text: flush tool group, create message with any completed tools
    flushToolGroup();
    const msg: Message = {
      id: raw.uuid || `a-${Date.now()}-${Math.random()}`,
      role: 'assistant',
      content: text,
      createdAt: raw.timestamp ? new Date(raw.timestamp) : undefined,
      reasoning,
    };
    if (completed.length > 0) {
      msg.toolCalls = completed.map(t => ({
        state: 'result' as const,
        toolName: t.toolName,
        result: t.result,
      }));
    }
    result.push(msg);
  }

  flushToolGroup();

  // Post-process: merge consecutive tool-only messages into one group
  const merged: Message[] = [];
  let toolAccumulator: Message | null = null;
  for (const msg of result) {
    if (!msg.content && msg.toolCalls?.length && msg.role === 'assistant') {
      // Tool-only message — merge
      if (!toolAccumulator) {
        toolAccumulator = { ...msg, toolCalls: [...(msg.toolCalls || [])] };
      } else {
        toolAccumulator.toolCalls = [...(toolAccumulator.toolCalls || []), ...(msg.toolCalls || [])];
      }
    } else {
      if (toolAccumulator) {
        merged.push(toolAccumulator);
        toolAccumulator = null;
      }
      merged.push(msg);
    }
  }
  if (toolAccumulator) merged.push(toolAccumulator);

  return merged;
}

// ── Styles ─────────────────────────────────────────────────────────

const rootStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', color: css('--foreground') };
const S = {
  muted: { color: css('--muted-foreground') },
  input: {
    width: '100%', padding: '5px 8px', borderRadius: 4, fontSize: 13,
    border: `1px solid ${css('--input')}`, background: css('--background'),
    color: css('--foreground'), outline: 'none', boxSizing: 'border-box' as const,
    fontFamily: `"Nunito Sans", -apple-system, ".SFNSText-Regular", "San Francisco", "system-ui", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif`,
  },
};

/** A session list item with origin badge. */
function SessionItem({ session, onClick }: { session: SessionSummary; onClick: () => void }) {
  const s = session as any;
  const originBadge = s.origin === 'comment' ? '💭' : s.origin === 'chat' ? '💬' : null;
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '5px 6px 4px 8px', border: 'none', borderRadius: 4, background: 'transparent', color: 'inherit', cursor: 'pointer', gap: 6, fontSize: 14, fontWeight: 400, minHeight: 28, lineHeight: '20px' }}>
      {originBadge && <span style={{ flexShrink: 0, fontSize: 13, opacity: 0.6 }}>{originBadge}</span>}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 14, fontWeight: 400, color: css('--foreground'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '20px' }}>{session.display}</div>
      </div>
      <span style={{ fontSize: 11, color: css('--muted-foreground'), opacity: 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}>{formatTime(session.timestamp)}</span>
    </button>
  );
}

export function ChatSidebar({ onClose, defaultSessionId }: { onClose?: () => void; defaultSessionId?: string | null }) {
  if (!varsInjected) { injectShadcnVars(); varsInjected = true; }

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [emSessions, setEmSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [files, setFiles] = useState<File[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNewPicker, setShowNewPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingNewScope, setPendingNewScope] = useState<{ scope: string; origin: string; intentType?: string } | null>(null);
  const skipConversationLoadRef = useRef(false);
  const autoSendRef = useRef<string | null>(null);
  const autoIntentTypeRef = useRef<string | undefined>(undefined);
  const [selectedElement, setSelectedElement] = useState<ElementSelectedPayload | null>(null);
  const [viewContext, setViewContext] = useState<ViewContextPayload | null>(null);
  const [filterTab, setFilterTab] = useState<'project' | 'story' | 'design-system'>('story');
  const [pendingQuestion, setPendingQuestion] = useState<{
    questions: Question[];
    state: 'interactive' | 'pending' | 'answered' | 'expired';
    sessionId: string;
  } | null>(null);

  // Listen for element selections from the preview iframe
  useEffect(() => {
    const channel = addons.getChannel();
    const onElementSelected = (payload: ElementSelectedPayload) => {
      setSelectedElement(payload);
    };
    channel.on(EVT_ELEMENT_SELECTED, onElementSelected);
    return () => { channel.off(EVT_ELEMENT_SELECTED, onElementSelected); };
  }, []);

  // Listen for view context changes from the preview iframe
  useEffect(() => {
    const channel = addons.getChannel();
    const onViewContext = (payload: ViewContextPayload) => {
      setViewContext(payload);
    };
    channel.on(EVT_VIEW_CONTEXT, onViewContext);
    return () => { channel.off(EVT_VIEW_CONTEXT, onViewContext); };
  }, []);

  // Clear selection on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedElement(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    Promise.all([
      api.listSessions(),
      api.getHealth().catch(() => null),
    ]).then(([r, health]) => {
      const root = health?.paths?.root ?? '';
      // Only show sessions belonging to this project workspace
      const allRaw = r.claudeSessions ?? [];
      const filtered = root ? allRaw.filter((s: any) => s.project && s.project.startsWith(root)) : allRaw;
      setSessions(filtered);
      setEmSessions(r.emdesignSessions ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const allSessions = useMemo(() => {
    const map = new Map<string, SessionSummary>();
    for (const s of sessions) map.set(s.id, s);
    for (const s of emSessions) map.set(s.id, s);
    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [sessions, emSessions]);

  // Navigate to a session from an external event (e.g. comment submit → chat session)
  useEffect(() => {
    if (defaultSessionId && defaultSessionId !== activeSessionId) {
      const session = allSessions.find(s => s.id === defaultSessionId);
      if (session?.display && session.display.length > 0) {
        autoSendRef.current = session.display;
      }
      setActiveSessionId(defaultSessionId);
    }
  }, [defaultSessionId, activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    // Skip loading if this session was just created via pendingNewScope
    if (skipConversationLoadRef.current) { skipConversationLoadRef.current = false; setMsgLoading(false); return; }
    setMsgLoading(true);
    api.getSessionConversation(activeSessionId).then((raw: any) => {
      let converted = processMessages(raw as any[]);
      let autoText = autoSendRef.current;
      autoSendRef.current = null;
      // If no messages but session has display text, show it as the first user message
      if (converted.length === 0) {
        const session = allSessions.find(s => s.id === activeSessionId);
        if (session?.display && session.display.length > 0 && session.display.length < 500) {
          converted = [{ id: `init-${activeSessionId}`, role: 'user' as const, content: session.display, createdAt: new Date(session.timestamp) }];
          if (!autoText) autoText = session.display;
        }
      }
      setMessages(converted);
      setMsgLoading(false);
      // Auto-send the instruction if this session was created from a comment
      if (autoText && !sending) {
        setSending(true);
        setStreaming(true);
        const asstId = `a-${Date.now()}`;
        setMessages(prev => [...prev, { id: asstId, role: 'assistant', content: '', createdAt: new Date() }]);
        fetch(`${BACKEND_URL}/api/chat/stream`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: autoText, interactive: true, sessionId: activeSessionId || undefined }),
        }).then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const reader = res.body?.getReader();
          if (!reader) throw new Error('No response body');
          const decoder = new TextDecoder();
          let buffer = '', assistantText = '';
          let streamDone = false;
          let idleTimer: ReturnType<typeof setTimeout> | null = null;
          while (!streamDone) {
            const result = await Promise.race([
              reader.read().then(r => ({ ...r, timedOut: false })),
              new Promise<{ done: false; value: undefined; timedOut: true }>(resolve => {
                idleTimer = setTimeout(() => resolve({ done: false, value: undefined, timedOut: true }), 15000);
              }),
            ]);
            if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
            if (result.timedOut) { streamDone = true; setStreaming(false); break; }
            if (result.done) break;
            buffer += decoder.decode(result.value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'text') { assistantText += data.text; setMessages(prev => prev.map(m => m.id === asstId ? { ...m, content: assistantText } : m)); }
                else if (data.type === 'question') {
                  setPendingQuestion({ questions: data.questions, state: 'interactive', sessionId: activeSessionId || '' });
                } else if (data.type === 'question_timeout') {
                  setPendingQuestion(prev => prev ? { ...prev, state: 'expired' } : null);
                } else if (data.type === 'done') { streamDone = true; setStreaming(false); break; }
              } catch { /* skip */ }
            }
          }
          if (!assistantText) setMessages(prev => prev.map(m => m.id === asstId ? { ...m, content: '(no response)' } : m));
        }).catch(() => {}).finally(() => { setStreaming(false); setSending(false); });
      }
    }).catch(() => setMsgLoading(false));
  }, [activeSessionId, allSessions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allSessions;
    const q = search.toLowerCase();
    return allSessions.filter(s => s.display.toLowerCase().includes(q) || s.projectName.toLowerCase().includes(q));
  }, [allSessions, search]);

  // Split sessions into project (global) and story-scoped
  const projectSessions = useMemo(() => filtered.filter((s: any) => !s.scope || s.scope === 'global'), [filtered]);
  const storySessions = useMemo(() => filtered.filter((s: any) => s.scope && s.scope !== 'global'), [filtered]);
  const displaySessions = filterTab === 'project' || filterTab === 'design-system' ? projectSessions : storySessions;

  const activeSession = activeSessionId ? allSessions.find(s => s.id === activeSessionId) : null;

  const uploadFiles = useCallback(async (fileList: File[]): Promise<string[]> => {
    const paths: string[] = [];
    for (const file of fileList) {
      const form = new FormData();
      form.append('file', file);
      try {
        const res = await fetch(`${BACKEND_URL}/api/upload`, { method: 'POST', body: form });
        const data = await res.json();
        if (data.ok) paths.push(data.path);
      } catch (e) {
        console.error('Upload failed:', file.name, e);
      }
    }
    return paths;
  }, []);

  // Create a new session from a mode pill click
  const handleCreateSession = useCallback(async (startMode: ChatStartMode) => {
    const mode = CHAT_MODES.find(m => m.id === startMode)!;
    setCreateError(null);
    setCreating(true);
    try {
      // Scope the session based on the active tab
      const scope = filterTab === 'story' && viewContext
        ? `story:${viewContext.storyId}`
        : 'global';
      const session = await api.createSession({
        type: mode.intentType ?? 'chat',
        scope,
        origin: 'chat',
      });
      // Add to local sessions list (prepend, dedupe)
      setSessions(prev => {
        const exists = prev.find(s => s.id === session.id);
        return exists ? prev : [session, ...prev];
      });
      setActiveSessionId(session.id);
      setShowNewPicker(false);
    } catch (e) {
      setCreateError(`Failed to create session: ${(e as Error).message}`);
    }
    setCreating(false);
  }, [filterTab, viewContext]);

  // ── Prompt suggestions per tab ──────────────────────────────────
  const STORY_SUGGESTIONS: PromptSuggestion[] = [
    { title: 'Polish this component', action: 'Polish this component to match the design system' },
    { title: 'Add a new variant', action: 'Add a new variant/story for this component' },
    { title: 'Fix accessibility issues', action: 'Fix accessibility issues in this component' },
    { title: 'Review the design', action: 'Review the design of this component against the design system' },
  ];
  const PROJECT_SUGGESTIONS: PromptSuggestion[] = [
    { title: 'Create a new component', action: 'Create a new React component following the design system' },
    { title: 'Create a new page/view', action: 'Create a new page or view composing existing components' },
    { title: 'Request a design change', action: 'Request a change to the design' },
    { title: 'Update design tokens', action: 'Update the design system tokens' },
  ];
  const DS_SUGGESTIONS: PromptSuggestion[] = [
    { title: 'Update color tokens', action: 'Update the color tokens in the design system' },
    { title: 'Customize typography', action: 'Customize the typography scale in the design system' },
    { title: 'Add new components', action: 'Add new components to the design system library' },
    { title: 'Import a design system', action: 'Import a new design system from a base or reference' },
  ];

  const currentSuggestions = filterTab === 'story' ? STORY_SUGGESTIONS
    : filterTab === 'project' ? PROJECT_SUGGESTIONS
    : DS_SUGGESTIONS;

  const handleSuggestionClick = useCallback(async (action: string) => {
    if (sending) return;
    const scope = filterTab === 'story' && viewContext ? `story:${viewContext.storyId}` : 'global';
    // Create session directly
    try {
      const session = await api.createSession({ type: 'chat', scope, origin: 'chat' });
      setSessions(prev => { const exists = prev.find(s => s.id === session.id); return exists ? prev : [session, ...prev]; });
      setPendingNewScope(null);
      skipConversationLoadRef.current = true;
      setActiveSessionId(session.id);
      // Set input text and trigger send
      suggestionTriggeredRef.current = true;
      setInput(action);
    } catch (e) {
      console.error('Failed to create session:', e);
    }
  }, [filterTab, viewContext, sending]);

  // Send message → stream response from Claude via SSE
  const handleSend = useCallback(async () => {
    if ((!input.trim() && !files?.length) || sending) return;
    const text = input.trim();
    const currentFiles = files;
    setInput('');
    console.log('[chat] sending...');

    // If this is a pending new conversation, create the session first
    if (pendingNewScope) {
      const scope = pendingNewScope.scope;
      setCreating(true);
      try {
        const session = await api.createSession({
          type: 'chat',
          scope,
          origin: pendingNewScope.origin,
        });
        setSessions(prev => {
          const exists = prev.find(s => s.id === session.id);
          return exists ? prev : [session, ...prev];
        });
        skipConversationLoadRef.current = true;
        setActiveSessionId(session.id);
        setPendingNewScope(null);
      } catch (e) {
        setCreateError(`Failed to create session: ${(e as Error).message}`);
        setCreating(false);
        setSending(false);
        return;
      }
      setCreating(false);
    }

    setSending(true);
    setStreaming(true);
    setPendingQuestion(null); // clear any stale pending question

    // Add user message
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text || '(file upload)', createdAt: new Date() };
    setMessages(prev => [...prev, userMsg]);

    // Add placeholder assistant message for streaming
    const asstId = `a-${Date.now()}`;
    setMessages(prev => [...prev, { id: asstId, role: 'assistant', content: '', createdAt: new Date() }]);

    try {
      let extra = '';
      if (currentFiles?.length) {
        const paths = await uploadFiles(currentFiles);
        if (paths.length) extra = `\n\nAttached:\n${paths.map(p => `- ${p}`).join('\n')}`;
      }
      setFiles(null);

      // Append view context as system metadata if available
      const contextMeta = viewContext ? {
        component: viewContext.component,
        story: viewContext.storyName,
        viewport: `${viewContext.viewport.width}x${viewContext.viewport.height}`,
        designSystem: viewContext.designSystem,
        tokens: viewContext.tokens,
      } : undefined;
      const contextSuffix = contextMeta ? `\n\n[Context: viewing ${contextMeta.component} in "${contextMeta.story}" @ ${contextMeta.viewport}${contextMeta.tokens?.length ? `, tokens: ${contextMeta.tokens.join(', ')}` : ''}]` : '';

      const res = await fetch(`${BACKEND_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text + extra + contextSuffix,
          interactive: true,
          sessionId: activeSessionId || undefined,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';
      let streamDone = false;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;

      while (!streamDone) {
        // Race reader.read() against a 15s idle timeout
        const result = await Promise.race([
          reader.read().then(r => ({ ...r, timedOut: false })),
          new Promise<{ done: false; value: undefined; timedOut: true }>(resolve => {
            idleTimer = setTimeout(() => resolve({ done: false, value: undefined, timedOut: true }), 15000);
          }),
        ]);
        if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
        if (result.timedOut) {
          console.log('[chat] idle timeout — forcing stream end');
          streamDone = true;
          setStreaming(false);
          break;
        }
        if (result.done) break;
        const value = result.value!;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            console.log('[chat] SSE event:', data.type, data.text?.slice(0,30));
            if (data.type === 'text') {
              assistantText += data.text;
              setMessages(prev => prev.map(m => m.id === asstId ? { ...m, content: assistantText } : m));
            } else if (data.type === 'question') {
              setPendingQuestion({
                questions: data.questions,
                state: 'interactive',
                sessionId: activeSessionId || '',
              });
            } else if (data.type === 'question_timeout') {
              setPendingQuestion(prev => prev ? { ...prev, state: 'expired' } : null);
            } else if (data.type === 'done') {
              console.log('[chat] DONE received — hiding typing');
              streamDone = true;
              setStreaming(false);
              break;
            } else if (data.type === 'error') {
              setMessages(prev => prev.map(m => m.id === asstId ? { ...m, content: `Error: ${data.error}` } : m));
            }
          } catch { /* skip */ }
        }
      }
      console.log('[chat] while loop exited, streamDone:', streamDone);

      if (!assistantText) {
        setMessages(prev => prev.map(m => m.id === asstId ? { ...m, content: '(no response)' } : m));
      }
    } catch (e) {
      setMessages(prev => prev.map(m =>
        m.id === asstId ? { ...m, content: `Error: ${(e as Error).message}` } : m
      ));
    }
    setStreaming(false);
    setSending(false);
  }, [input, files, sending, uploadFiles, pendingNewScope]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value), []);

  // When activeSessionId changes AND input was set by a suggestion, trigger send
  const suggestionTriggeredRef = useRef(false);
  useEffect(() => {
    if (activeSessionId && input.trim() && suggestionTriggeredRef.current) {
      suggestionTriggeredRef.current = false;
      const t = setTimeout(() => {
        // Find and submit the form
        const form = document.querySelector('.emdesign-chat-root form') as HTMLFormElement | null;
        if (form) form.requestSubmit();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [activeSessionId, input]);

  // Auto-scroll for message area
  const { containerRef: msgRef, handleScroll: msgScroll } = useAutoScroll([messages, msgLoading, activeSessionId]);

  // Show typing during streaming, hide when stream ends (regardless of sending state)
  const showTyping = streaming;
  const { containerRef: listRef, handleScroll: listScroll } = useAutoScroll([displaySessions]);

  if (loading) return <div className="emdesign-chat-root" style={{ ...rootStyle, padding: 20, textAlign: 'center', fontSize: 12, ...S.muted }}>Loading...</div>;

  return (
    <div className="emdesign-chat-root" style={rootStyle}>

      {/* ── Header ── */}
      {activeSession && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 4px', flexShrink: 0 }}>
          <button onClick={() => setActiveSessionId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14, color: css('--muted-foreground'), lineHeight: '20px' }}>←</button>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: 13, fontWeight: 400, color: css('--foreground'), lineHeight: '20px' }}>{activeSession.display}</span>
        </div>
      )}
      {pendingNewScope && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 4px', flexShrink: 0 }}>
          <button onClick={() => { setPendingNewScope(null); setMessages([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14, color: css('--muted-foreground'), lineHeight: '20px' }}>←</button>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 400, color: css('--foreground'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '20px' }}>
            {pendingNewScope.scope === 'global' ? '💬 New Project Chat' : `📖 New Story Chat${viewContext ? `: ${viewContext.component}` : ''}`}
          </span>
        </div>
      )}

      {/* ── Session list ── */}
      {!activeSession && !pendingNewScope ? (
        <>
          {/* ── Search + New button row ── */}
          <div style={{ display: 'flex', gap: 6, height: 32 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '2px', borderRadius: 6, boxShadow: `0 0 0 1px ${css('--border')} inset`, background: 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 28, height: 28 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: css('--muted-foreground') }}><path fill-rule="evenodd" clip-rule="evenodd" d="M9.544 10.206a5.5 5.5 0 11.662-.662.5.5 0 01.148.102l3 3a.5.5 0 01-.708.708l-3-3a.5.5 0 01-.102-.148zM10.5 6a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" fill="currentColor"/></svg>
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find components" style={{ flex: 1, border: 'none', background: 'transparent', color: css('--foreground'), fontSize: 13, fontFamily: `"Nunito Sans", -apple-system, ".SFNSText-Regular", "San Francisco", "system-ui", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif`, outline: 'none', padding: 0, lineHeight: '28px', height: 28 }} />
            </div>
            <button onClick={() => {
              const scope = filterTab === 'story' && viewContext ? `story:${viewContext.storyId}` : 'global';
              setPendingNewScope({ scope, origin: 'chat' });
            }}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '0 7px', borderRadius: 6, height: 32, minHeight: 32,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', lineHeight: '12px',
                border: 'none', background: css('--background'), color: css('--muted-foreground'),
                boxShadow: `0 0 0 1px ${css('--border')} inset`,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
              <span style={{ fontSize: 14, lineHeight: 1, fontWeight: 400 }}>+</span> New
            </button>
          </div>

          {/* ── Tab filters ── */}
          <div style={{ display: 'flex', gap: 0, padding: '0 8px', marginTop: 8, marginBottom: 4 }}>
            {(['story', 'project', 'design-system'] as const).map(tab => (
              <button key={tab} onClick={() => setFilterTab(tab)}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  border: 'none', textTransform: 'uppercase', letterSpacing: '1.76px',
                  transition: 'all 0.12s',
                  background: 'transparent',
                  color: filterTab === tab ? css('--foreground') : css('--muted-foreground'),
                  opacity: filterTab === tab ? 1 : 0.7,
                  lineHeight: '16px',
                }}>
                {tab === 'story' ? `📖 Story${viewContext ? `: ${viewContext.component}` : ''}`
                 : tab === 'project' ? '💬 Project'
                 : '🎨 Design System'}
              </button>
            ))}
          </div>

          <div ref={listRef} onScroll={listScroll} className="emdesign-scroll" style={{ flex: 1, overflow: 'auto' }}>
            {displaySessions.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, ...S.muted }}>{search ? 'No matches' : 'No sessions'}</div>
            ) : (
              displaySessions.slice(0, 50).map(s => (
                <SessionItem key={s.id} session={s} onClick={() => setActiveSessionId(s.id)} />
              ))
            )}
          </div>
        </>
      ) : (
        /* ── Conversation view ── */
        <>
          <div ref={msgRef} onScroll={msgScroll} className="emdesign-scroll" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {msgLoading ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, ...S.muted }}>Loading...</div>
            ) : messages.length === 0 && !pendingNewScope ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, ...S.muted }}>No messages in this session</div>
            ) : messages.length === 0 && pendingNewScope ? (
              <div style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 600, marginBottom: 12, color: css('--foreground'), fontSize: 13 }}>
                  {pendingNewScope.scope === 'global' ? '💬 Project Chat' : `📖 Story Chat${viewContext ? `: ${viewContext.component}` : ''}`}
                </div>
                <PromptSuggestions
                  label="Try asking..."
                  suggestions={currentSuggestions}
                  append={handleSuggestionClick}
                />
                <div style={{ marginTop: 12, fontSize: 10, color: css('--muted-foreground'), opacity: 0.6 }}>
                  Or type a message to start the conversation
                </div>
              </div>
            ) : (
              <MessageList messages={messages} isTyping={showTyping} />
            )}

            {/* ── Pending Question Card ── */}
            {pendingQuestion && pendingQuestion.state !== 'answered' && (
              <div style={{ padding: '0 10px' }}>
                {pendingQuestion.state === 'interactive' && (
                  <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>
                    The AI is waiting for your answer...
                  </div>
                )}
                {pendingQuestion.state === 'expired' && (
                  <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>
                    ⏱ Question expired
                  </div>
                )}
                <QuestionCard
                  questions={pendingQuestion.questions}
                  state={pendingQuestion.state}
                  onSubmit={(answers) => {
                    setPendingQuestion(prev => prev ? { ...prev, state: 'pending' } : null);
                    const sid = pendingQuestion.sessionId;
                    fetch(`\${BACKEND_URL}/api/chat/answer`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ sessionId: sid, answers }),
                    }).then(res => {
                      if (res.ok) {
                        setPendingQuestion(prev => prev ? { ...prev, state: 'answered' } : null);
                      } else {
                        setPendingQuestion(prev => prev ? { ...prev, state: 'interactive' } : null);
                      }
                    }).catch(() => {
                      setPendingQuestion(prev => prev ? { ...prev, state: 'interactive' } : null);
                    });
                  }}
                  onCancel={() => {
                    const sid = pendingQuestion.sessionId;
                    fetch(`\${BACKEND_URL}/api/chat/answer/cancel`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ sessionId: sid }),
                    }).catch(() => {});
                    setPendingQuestion(null);
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Context chip ── */}
          {viewContext && !selectedElement && (
            <div style={{ padding: '2px 8px 2px 10px', borderTop: `1px solid ${css('--border')}`, background: css('--muted') }}>
              <div style={{ fontSize: 11, color: css('--muted-foreground'), lineHeight: '24px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: `"Nunito Sans", -apple-system, ".SFNSText-Regular", "San Francisco", "system-ui", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif` }}>
                👁 Viewing: {viewContext.component} @ {viewContext.viewport.width}×{viewContext.viewport.height}
              </div>
            </div>
          )}

          {/* ── Selected element card ── */}
          {selectedElement && (
            <div style={{ padding: '4px 8px', borderTop: `1px solid ${css('--border')}`, background: css('--muted') }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, padding: '4px 6px', borderRadius: 'var(--radius)', border: `1px solid ${css('--primary')}33`, background: `${css('--primary')}11` }}>
                <span style={{ flexShrink: 0, fontSize: 13, lineHeight: '18px' }}>🔍</span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, color: css('--foreground'), fontSize: 11, lineHeight: '18px' }}>&lt;{selectedElement.tag}&gt;
                    {selectedElement.emdesignComponent && <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 4 }}>({selectedElement.emdesignComponent})</span>}
                  </div>
                  {selectedElement.text && <div style={{ color: css('--muted-foreground'), fontSize: 10, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{selectedElement.text.slice(0, 80)}"</div>}
                  <div style={{ color: css('--muted-foreground'), fontSize: 9, lineHeight: '14px', marginTop: 2 }}>{selectedElement.selector}</div>
                </div>
                <button onClick={() => setSelectedElement(null)} style={{ background: 'none', border: 'none', color: css('--muted-foreground'), cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: '18px', flexShrink: 0 }}>✕</button>
              </div>
            </div>
          )}

          {/* ── Input ── */}
          <div style={{ padding: '6px 8px', borderTop: `1px solid ${css('--border')}`, flexShrink: 0 }}>
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
              <input ref={fileInputRef} type="file" multiple onChange={(e) => { if (e.target.files) setFiles(Array.from(e.target.files)); e.target.value = ''; }} style={{ display: 'none' }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                <textarea value={input} onChange={handleInputChange}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Type a message..." rows={1}
                  style={{
                    flex: 1, resize: 'none', padding: '7px 10px', borderRadius: 6,
                    border: 'none', boxShadow: `0 0 0 1px ${css('--input')} inset`,
                    background: css('--background'), color: css('--foreground'),
                    fontSize: 13, lineHeight: 1.4, fontFamily: `"Nunito Sans", -apple-system, ".SFNSText-Regular", "San Francisco", "system-ui", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif`,
                    outline: 'none', maxHeight: 80, overflow: 'auto',
                  }} />
                <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach file"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 'var(--radius)', border: `1px solid ${css('--border')}`, background: 'transparent', color: css('--muted-foreground'), cursor: 'pointer', flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </button>
                {sending ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 'var(--radius)', background: css('--muted'), flexShrink: 0 }}>
                    <span style={{ fontSize: 9, ...S.muted }}>...</span>
                  </div>
                ) : (
                  <button type="submit" disabled={!input.trim() && !files?.length}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 'var(--radius)', border: 'none', flexShrink: 0,
                      background: input.trim() || files?.length ? css('--primary') : css('--muted'),
                      color: input.trim() || files?.length ? css('--primary-foreground') : css('--muted-foreground'),
                      cursor: input.trim() || files?.length ? 'pointer' : 'default', opacity: input.trim() || files?.length ? 1 : 0.5 }}>
                    ↑
                  </button>
                )}
              </div>
              {files && files.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 5px', borderRadius: 'var(--radius)', background: css('--muted'), fontSize: 9, color: css('--foreground') }}>
                      <span style={{ maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <button type="button" onClick={() => setFiles(prev => prev ? prev.filter((_, j) => j !== i) : null)} style={{ background: 'none', border: 'none', color: css('--muted-foreground'), cursor: 'pointer', padding: 0, fontSize: 10 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </form>
          </div>
        </>
      )}
    </div>
  );
}
