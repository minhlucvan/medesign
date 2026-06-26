import React, { useRef, useState } from 'react';
import { IconButton, Separator } from '@storybook/components';
import { useChannel } from '@storybook/manager-api';
import { styled } from '@storybook/theming';
import { api } from './api';
import { EVT_TOOL_MODE, EVT_COMMENT_SUBMIT, EVT_TEXT_SUBMIT, EVT_CHAT_MODE, type ToolMode, type CommentTarget } from './channel';
import { useStudioState } from './ui';
import { ChatModeController } from './ChatModeController';

const Chip = styled.span(({ theme }) => ({ font: `11px ${theme.typography.fonts.base}`, color: theme.textMutedColor, padding: '0 6px' }));

const TOOLS: Array<{ mode: Exclude<ToolMode, 'off'>; title: string; label: string; icon: React.ReactNode }> = [
  {
    mode: 'comment',
    title: 'emdesign: comment on an element',
    label: 'Comment',
    icon: <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v5A1.5 1.5 0 0 1 12.5 10H6.5l-3 3v-3H3.5A1.5 1.5 0 0 1 2 8.5v-5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />,
  },
  {
    mode: 'copy',
    title: 'emdesign: copy an element’s identifier context',
    label: 'Copy',
    icon: <path d="M5.5 5.5V3.2A1.2 1.2 0 0 1 6.7 2h6.1A1.2 1.2 0 0 1 14 3.2v6.1a1.2 1.2 0 0 1-1.2 1.2h-2.3M3.2 5.5h6.1A1.2 1.2 0 0 1 10.5 6.7v6.1A1.2 1.2 0 0 1 9.3 14H3.2A1.2 1.2 0 0 1 2 12.8V6.7A1.2 1.2 0 0 1 3.2 5.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />,
  },
  {
    mode: 'text',
    title: 'emdesign: edit text inline (pen)',
    label: 'Edit text',
    icon: <path d="M9.5 3.5l3 3L6 13l-3.2.6L3.4 10l6.1-6.5Zm0 0l1.6-1.6a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4L12.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />,
  },
];

/** Toolbar: comment / copy / pen mode group + the active design-system chip. */
export function Tool() {
  const [mode, setMode] = useState<ToolMode>('off');
  const modeRef = useRef<ToolMode>('off');
  const { state } = useStudioState(3000);

  // The canvas→backend bridge lives here (always mounted in story view): a comment or an inline pen
  // edit from the preview overlay becomes a typed intent. Also stay in sync when the preview turns off.
  const emit = useChannel({
    [EVT_TOOL_MODE]: (p: { mode: ToolMode }) => { modeRef.current = p?.mode ?? 'off'; setMode(modeRef.current); },
    [EVT_COMMENT_SUBMIT]: async (p: { target: CommentTarget; instruction: string }) => {
      try {
        // Build a structured prompt with element context
        const prompt = `Update component "${p.target.component || 'unknown'}": ${p.instruction}\n\nTarget element: <${p.target.tag}${p.target.selector ? ' ' + p.target.selector : ''}>\n- Text: "${p.target.text || ''}"\n- Story: ${p.target.storyId || ''}`;
        const session = await api.createSession({ type: 'change-request', instruction: prompt });
        // Persist the comment pin with session reference
        await api.storeComment({
          storyId: p.target.storyId || '',
          selector: p.target.selector || '',
          text: p.instruction,
          tag: p.target.tag,
          component: p.target.component,
          sessionId: session.id,
        }).catch(() => {});
        emit(EVT_CHAT_MODE, { enabled: true, sessionId: session.id });
      } catch { /* backend down */ }
    },
    [EVT_TEXT_SUBMIT]: async (p: { target: CommentTarget; from: string; to: string }) => {
      try {
        await api.submitIntent({
          type: 'edit-text',
          instruction: `Replace the text of ${p.target.selector} — was "${p.from}" — with: "${p.to}"`,
          target: p.target,
          payload: { textEdit: { from: p.from, to: p.to } },
        });
      } catch { /* backend down */ }
    },
  });

  const select = (m: Exclude<ToolMode, 'off'>) => {
    const next: ToolMode = modeRef.current === m ? 'off' : m;
    modeRef.current = next;
    setMode(next);
    emit(EVT_TOOL_MODE, { mode: next });
  };

  return (
    <>
      <Separator />
      {TOOLS.map((t) => (
        <IconButton key={`emdesign-${t.mode}`} active={mode === t.mode} title={t.title} onClick={() => select(t.mode)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>{t.icon}</svg>
        </IconButton>
      ))}
      {state?.activeDesignSystem && <Chip>◆ {state.activeDesignSystem}</Chip>}
      <ChatModeController />
    </>
  );
}
