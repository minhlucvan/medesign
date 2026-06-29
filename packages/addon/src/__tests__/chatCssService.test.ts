/**
 * chatCssService — unit tests (RED step).
 *
 * Tests for the chat CSS injection service that separates CSS logic
 * from the ChatModeController React component. The service provides
 * pure functions: buildChatCSS (returns CSS string) and injectChatCSS
 * (creates/removes a style element in document.head).
 *
 * Drawn from delta specs: chat-controller/spec.md.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildChatCSS, injectChatCSS } from '../services/chatCssService';

// ── buildChatCSS ─────────────────────────────────────────────────────────

describe('buildChatCSS', () => {
  it('light mode returns CSS with light background tokens', () => {
    const css = buildChatCSS(false);
    expect(css).toContain('--background: 210 17% 98%');
    expect(css).toContain('--foreground: 210 11% 20%');
    expect(css).toContain('--primary: 206 100% 50%');
    expect(css).toContain('!important');
  });

  it('dark mode returns CSS with dark background tokens', () => {
    const css = buildChatCSS(true);
    expect(css).toContain('--background: 200 4.23% 13.92%');
    expect(css).toContain('--foreground: 200 4.23% 90%');
    expect(css).toContain('--primary: 210 30% 40%');
    expect(css).toContain('!important');
  });

  it('hides story tree and sidebar items', () => {
    const css = buildChatCSS(false);
    expect(css).toContain('.sidebar-item');
    expect(css).toContain('.sidebar-subheading');
    expect(css).toContain('#storybook-explorer-tree');
    expect(css).toContain('.search-field');
    expect(css).toContain('display: none');
  });

  it('includes scroll-area flex layout rules', () => {
    const css = buildChatCSS(false);
    expect(css).toContain('[data-radix-scroll-area-content]');
    expect(css).toContain('flex: 1');
    expect(css).toContain('flex-direction: column');
  });

  it('includes scrollbar styling', () => {
    const css = buildChatCSS(false);
    expect(css).toContain('::-webkit-scrollbar');
  });

  it('preserves sidebar header', () => {
    const css = buildChatCSS(false);
    expect(css).toContain('.sidebar-header');
    expect(css).toContain('flex-shrink: 0');
  });

  it('returns valid CSS syntax with opening and closing braces', () => {
    const css = buildChatCSS(false);
    expect(css.length).toBeGreaterThan(200);
    expect(css).toContain('{');
    expect(css).toContain('}');
  });
});

// ── injectChatCSS ────────────────────────────────────────────────────────

describe('injectChatCSS', () => {
  const STYLE_ID = 'emdesign-chat-css';

  beforeEach(() => {
    const existing = document.getElementById(STYLE_ID);
    if (existing) existing.remove();
    document.body.classList.remove('emdesign-chat-active');
  });

  afterEach(() => {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
    document.body.classList.remove('emdesign-chat-active');
  });

  it('creates a style element in document.head when enabled', () => {
    injectChatCSS(true);
    const styleEl = document.getElementById(STYLE_ID);
    expect(styleEl).not.toBeNull();
    expect(styleEl!.tagName).toBe('STYLE');
    expect(document.head.contains(styleEl)).toBe(true);
  });

  it('adds emdesign-chat-active class to body when enabled', () => {
    injectChatCSS(true);
    expect(document.body.classList.contains('emdesign-chat-active')).toBe(true);
  });

  it('removes the style element from head when disabled', () => {
    injectChatCSS(true);
    expect(document.getElementById(STYLE_ID)).not.toBeNull();

    injectChatCSS(false);
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });

  it('removes emdesign-chat-active class from body when disabled', () => {
    injectChatCSS(true);
    expect(document.body.classList.contains('emdesign-chat-active')).toBe(true);

    injectChatCSS(false);
    expect(document.body.classList.contains('emdesign-chat-active')).toBe(false);
  });

  it('does not leak style elements after repeated add/remove cycles', () => {
    injectChatCSS(true);
    injectChatCSS(false);
    injectChatCSS(true);
    injectChatCSS(false);
    injectChatCSS(true);

    const matches = document.querySelectorAll(`#${STYLE_ID}`);
    expect(matches.length).toBe(1);
  });

  it('removal is idempotent when no style element exists', () => {
    expect(document.getElementById(STYLE_ID)).toBeNull();
    expect(() => injectChatCSS(false)).not.toThrow();
  });
});
