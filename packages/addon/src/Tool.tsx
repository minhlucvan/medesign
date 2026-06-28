import React, { useRef, useState } from 'react';
import { IconButton, Separator } from '@storybook/components';
import { useChannel } from '@storybook/manager-api';
import { styled } from '@storybook/theming';
import { api } from './api';
import { EVT_TOOL_MODE, EVT_COMMENT_SUBMIT, EVT_TEXT_SUBMIT, EVT_CHAT_MODE, EVT_ELEMENT_SELECTED, EVT_WAND_TRIGGER, EVT_PLACE_TRIGGER, type ToolMode, type CommentTarget, type ElementSelectedPayload, type WandTriggerPayload, type PlaceTriggerPayload } from './channel';
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
    mode: 'reference',
    title: 'emdesign: reference an element into chat',
    label: 'Reference',
    icon: <path d="M3 3h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8l-2 2v-2H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 3v2h6V6H5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />,
  },
  {
    mode: 'text',
    title: 'emdesign: edit text inline',
    label: 'Edit text',
    icon: <path d="M2.5 2.5h11M8 2.5v11" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />,
  },
  {
    mode: 'wand',
    title: 'emdesign: auto-fix an element (wand) — Shift+click for vision critique',
    label: 'Auto-fix',
    icon: <path d="M7.5 1.5L9 5l3.5 1.5L9 8l-1.5 3.5L6 8l-3.5-1.5L6 5l1.5-3.5Zm4 9l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5.5-1Zm-8-6l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5.5-1Z" fill="currentColor" />,
  },
  {
    mode: 'place',
    title: 'emdesign: place a component at this location — click an element, choose a component, and it\'s inserted',
    label: 'Place',
    icon: <path d="M8 2a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2H9v4a1 1 0 1 1-2 0V9H3a1 1 0 1 1 0-2h4V3a1 1 0 0 1 1-1Z" fill="currentColor" />,
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
        const session = await api.createSession({
          type: 'change-request',
          instruction: prompt,
          scope: p.target.storyId ? `story:${p.target.storyId}` : 'global',
          origin: 'comment',
          elementContext: {
            selector: p.target.selector || '',
            tag: p.target.tag || '',
            text: p.target.text,
            component: p.target.component,
          },
        });
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
    [EVT_WAND_TRIGGER]: async (p: WandTriggerPayload) => {
      try {
        const session = await api.createSession({
          type: 'wand',
          instruction: `Auto-fix component "${p.component}" at ${p.selector} (<${p.tag}>)${p.vision ? ' with vision critique' : ''}`,
          scope: p.storyId ? `story:${p.storyId}` : 'global',
          origin: 'wand',
          elementContext: {
            selector: p.selector,
            tag: p.tag,
            text: p.text,
            component: p.component,
            rect: p.rect,
            vision: p.vision,
          },
        });
        await api.submitIntent({
          type: 'wand',
          instruction: `Auto-fix ${p.component}`,
          target: { selector: p.selector, tag: p.tag, text: p.text, component: p.component, storyId: p.storyId },
          payload: { mode: 'guided', vision: p.vision, sessionId: session.id },
        });
      } catch { /* backend down */ }
    },
    [EVT_PLACE_TRIGGER]: async (p: PlaceTriggerPayload) => {
      try {
        const session = await api.createSession({
          type: 'place',
          instruction: `Place component "${p.selectedComponent}" ${p.placementMode} ${p.selector} (<${p.tag}>)`,
          scope: p.storyId ? `story:${p.storyId}` : 'global',
          origin: 'place',
          elementContext: {
            selector: p.selector,
            tag: p.tag,
            text: p.text,
            component: p.component,
            rect: p.rect,
            placementMode: p.placementMode,
            selectedComponent: p.selectedComponent,
          },
        });
        await api.submitIntent({
          type: 'place',
          instruction: `Place ${p.selectedComponent} ${p.placementMode} ${p.selector}`,
          target: { selector: p.selector, tag: p.tag, text: p.text, component: p.component, storyId: p.storyId },
          payload: { placementMode: p.placementMode, selectedComponent: p.selectedComponent, sessionId: session.id },
        });
        // Placement runs in background — user can open chat optionally to see progress
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
