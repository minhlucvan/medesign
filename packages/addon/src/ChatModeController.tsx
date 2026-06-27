/**
 * ChatModeController — manages the chat sidebar toggle and panel.
 *
 * When chat is active, hides the story tree and preview panel, and renders
 * the ChatSidebar as an overlay in the sidebar container. A toggle button
 * is always portaled into the sidebar header.
 * Mounted from Tool.tsx (the toolbar component) since Storybook 8.x TOOLEXTRA
 * doesn't reliably render its children.
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { addons } from '@storybook/manager-api';
import { EVT_CHAT_MODE } from './channel';
import { ChatSidebar } from './sessions/ChatSidebar';

// ── CSS injection for chat mode — split layout ─────────────────────

const CHAT_CSS_ID = 'emdesign-chat-css';

function buildChatCSS(isDark: boolean): string {
  const theme = isDark ? `
    --background: 200 4.23% 13.92% !important;
    --foreground: 200 4.23% 90% !important;
    --primary: 210 30% 40% !important;
    --primary-foreground: 210 20% 96% !important;
    --muted: 200 4.23% 18% !important;
    --muted-foreground: 200 4.23% 60% !important;
    --border: 200 4.23% 21% !important;
    --input: 200 4.23% 21% !important;
    background: transparent !important;
  ` : `
    --background: 210 17% 98% !important;
    --foreground: 210 11% 20% !important;
    --primary: 206 100% 50% !important;
    --primary-foreground: 0 0% 100% !important;
    --muted: 210 17% 98% !important;
    --muted-foreground: 208 10% 40% !important;
    --border: 206 44% 90% !important;
    --input: 206 44% 90% !important;
    background: transparent !important;
  `;
  return `
  /* Hide the story tree and search — keep sidebar + canvas visible */
  .emdesign-chat-active #storybook-explorer-tree,
  .emdesign-chat-active .sidebar-subheading,
  .emdesign-chat-active .sidebar-item,
  .emdesign-chat-active #storybook-explorer-searchfield,
  .emdesign-chat-active label[for="storybook-explorer-searchfield"],
  .emdesign-chat-active #storybook-explorer-menu,
  .emdesign-chat-active .search-field,
  .emdesign-chat-active div:has(> .search-field),
  .emdesign-chat-active div:has(> [class*="yeohsa"]) {
    display: none !important;
  }
  /* Make the scroll-area fill the sidebar */
  .emdesign-chat-active [data-radix-scroll-area-viewport] {
    height: 100% !important;
    flex: 1 !important;
    overflow: hidden !important;
  }
  .emdesign-chat-active [data-radix-scroll-area-content] {
    min-height: 100% !important;
    display: flex;
    flex-direction: column;
  }
  .emdesign-chat-active [data-radix-scroll-area-content] > div {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  /* Keep sidebar-header exactly as-is — no position changes */
  .emdesign-chat-active .sidebar-header {
    flex-shrink: 0;
  }
  /* Chat theme: follows Storybook sidebar theme */
  .emdesign-chat-active .emdesign-chat-root {${theme}
  }
  .emdesign-chat-active [class*="sidebar"]::-webkit-scrollbar { width: 6px; }
  .emdesign-chat-active [class*="sidebar"]::-webkit-scrollbar-track { background: transparent; }
  .emdesign-chat-active [class*="sidebar"]::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
  .emdesign-chat-active [class*="sidebar"]::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
  `;
}

function injectChatCSS(enabled: boolean) {
  let style = document.getElementById(CHAT_CSS_ID);
  if (!enabled) {
    document.body.classList.remove('emdesign-chat-active');
    style?.remove();
    return;
  }
  if (!style) {
    // Detect theme from Storybook sidebar background
    let isDark = true;
    const sidebar = document.querySelector('.sidebar-container');
    if (sidebar) {
      const bg = getComputedStyle(sidebar).backgroundColor;
      const rgb = bg.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const lum = 0.299 * Number(rgb[0]) + 0.587 * Number(rgb[1]) + 0.114 * Number(rgb[2]);
        isDark = lum < 128;
      }
    } else {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    style = document.createElement('style');
    style.id = CHAT_CSS_ID;
    style.textContent = buildChatCSS(isDark);
    document.head.appendChild(style);
  }
  document.body.classList.add('emdesign-chat-active');
}

// ── Toggle button style ────────────────────────────────────────────

const toggleBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  borderRadius: 4,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  flexShrink: 0,
  marginLeft: 'auto',
  fontSize: 14,
  lineHeight: 1,
};

// ── Component ──────────────────────────────────────────────────────

export function ChatModeController() {
  const [visible, setVisible] = useState(false);
  const [contentEl, setContentEl] = useState<HTMLElement | null>(null);
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  // Listen for chat mode toggle (sessionId optionally embedded)
  useEffect(() => {
    const channel = addons.getChannel();
    const handler = (evt: { enabled: boolean; sessionId?: string }) => {
      setVisible(evt.enabled);
      if (evt.sessionId) setPendingSessionId(evt.sessionId);
      injectChatCSS(evt.enabled);
    };
    channel.on(EVT_CHAT_MODE, handler);
    return () => {
      channel.off(EVT_CHAT_MODE, handler);
      if (visible) injectChatCSS(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    const findElements = () => {
      // Target the inner content wrapper (below header) so chat flows naturally
      const content = document.querySelector('[class*="sidebar"] [data-radix-scroll-area-content] > div') as HTMLElement | null;
      if (content) setContentEl(content);
      const header = document.querySelector('.sidebar-header') as HTMLElement | null;
      if (header) setHeaderEl(header);
    };
    findElements();
    const t = setTimeout(findElements, 500);
    return () => clearTimeout(t);
  }, []);

  const toggleChat = () => {
    const next = !visible;
    // Only emit the event — the handler manages state + CSS
    const channel = addons.getChannel();
    channel.emit(EVT_CHAT_MODE, { enabled: next });
  };

  return (
    <>
      {/* Always-portaled toggle button into sidebar header */}
      {headerEl && createPortal(
        <button onClick={toggleChat}
          title={visible ? 'Close chat panel' : 'Open chat panel'}
          style={toggleBtnStyle}>
          {visible ? '✕' : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          )}
        </button>,
        headerEl
      )}
      {/* Chat panel portaled into the sidebar content area (below header, natural flow) */}
      {visible && contentEl && createPortal(
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingTop: 12 }}>
          <ChatSidebar onClose={toggleChat} defaultSessionId={pendingSessionId} />
        </div>,
        contentEl
      )}
      {/* Clear pending session after passing it to ChatSidebar */}
      {pendingSessionId && setPendingSessionId(null)}
    </>
  );
}
