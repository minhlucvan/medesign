/**
 * chatCssService — Chat CSS injection service.
 *
 * Separates CSS logic from the ChatModeController React component.
 * Pure functions: buildChatCSS returns a CSS string, injectChatCSS
 * creates/removes a style element in document.head.
 *
 * Restored from the original inline CSS in ChatModeController.tsx after
 * the commit 89cd0c0 extraction lost ~90% of the rules (theme vars,
 * scroll-area flex layout, scrollbar styling, comprehensive element hiding).
 */

const STYLE_ID = 'emdesign-chat-css';

/**
 * Build the CSS string for the chat overlay.
 * @param isDark - true for dark mode, false for light mode
 * @returns CSS string
 */
export function buildChatCSS(isDark: boolean): string {
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
  body.emdesign-chat-active #storybook-explorer-tree,
  body.emdesign-chat-active .sidebar-subheading,
  body.emdesign-chat-active .sidebar-item,
  body.emdesign-chat-active #storybook-explorer-searchfield,
  body.emdesign-chat-active label[for="storybook-explorer-searchfield"],
  body.emdesign-chat-active #storybook-explorer-menu,
  body.emdesign-chat-active .search-field,
  body.emdesign-chat-active div:has(> .search-field),
  body.emdesign-chat-active div:has(> [class*="yeohsa"]) {
    display: none !important;
  }
  /* Scroll-area viewport — keep unchanged so no reflow on toggle */
  body.emdesign-chat-active [data-radix-scroll-area-viewport] {
    overflow: hidden scroll !important;
  }
  body.emdesign-chat-active [data-radix-scroll-area-content] {
    min-height: 100% !important;
    display: flex;
    flex-direction: column;
  }
  body.emdesign-chat-active [data-radix-scroll-area-content] > div {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  /* Keep sidebar-header exactly as-is — no position changes */
  body.emdesign-chat-active .sidebar-header {
    flex-shrink: 0;
  }
  /* Chat theme: follows Storybook sidebar theme */
  body.emdesign-chat-active .emdesign-chat-root {${theme}
  }
  body.emdesign-chat-active [class*="sidebar"]::-webkit-scrollbar { width: 6px; }
  body.emdesign-chat-active [class*="sidebar"]::-webkit-scrollbar-track { background: transparent; }
  body.emdesign-chat-active [class*="sidebar"]::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
  body.emdesign-chat-active [class*="sidebar"]::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
  `;
}

/**
 * Inject or remove the chat CSS style element.
 * @param enabled - true to add, false to remove
 */
export function injectChatCSS(enabled: boolean): void {
  const existing = document.getElementById(STYLE_ID);

  if (enabled) {
    if (existing) return; // already injected — no-op

    // Detect theme from Storybook sidebar background (luminance-based)
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
      try {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } catch {
        isDark = true; // fallback to dark when matchMedia unavailable
      }
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = buildChatCSS(isDark);
    document.head.appendChild(style);
    document.body.classList.add('emdesign-chat-active');
  } else {
    if (existing) existing.remove();
    document.body.classList.remove('emdesign-chat-active');
  }
}
