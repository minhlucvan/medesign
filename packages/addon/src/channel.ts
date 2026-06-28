/** Channel events shared between the manager panel and the preview overlay. */
export const ADDON_ID = 'emdesign';

/** The active canvas tool. `off` disables the picker; the others change what a click does. */
export type ToolMode = 'off' | 'comment' | 'copy' | 'text' | 'reference' | 'wand';

export const EVT_TOOL_MODE = 'emdesign/tool-mode'; // manager → preview: { mode: ToolMode }
export const EVT_COMMENT_SUBMIT = 'emdesign/comment-submit'; // preview → manager: { target, instruction }
export const EVT_TEXT_SUBMIT = 'emdesign/text-submit'; // preview → manager: { target, from, to } (the pen)
export const EVT_COPIED = 'emdesign/copied'; // preview → manager: { ok, selector } (toolbar copy confirmation)
export const EVT_CHAT_MODE = 'emdesign/chat-mode'; // toolbar → manager: { enabled: boolean; sessionId?: string }

// ── EVT_WAND_TRIGGER ──────────────────────────────────────────────

/** Preview → Manager: sent when the user clicks an element in wand mode to trigger auto-fix. */
export const EVT_WAND_TRIGGER = 'emdesign/wand-trigger';

export interface WandTriggerPayload {
  component: string;
  tag: string;
  selector: string;
  text?: string;
  rect: { x: number; y: number; width: number; height: number };
  computedStyles: Record<string, string>;
  storyId?: string;
  vision: boolean;
}

// ── EVT_WAND_RESULT ───────────────────────────────────────────────

/** Manager → Preview/Manager: sent when the auto-fix workflow completes. */
export const EVT_WAND_RESULT = 'emdesign/wand-result';

export interface WandResultPayload {
  sessionId: string;
  status: 'running' | 'completed' | 'rolled-back' | 'error';
  diagnosticSummary?: {
    total: number;
    p0: number;
    p1: number;
    p2: number;
    fixable: number;
    needsHuman: number;
  };
  autoFixable?: Array<{ type: string; message: string; priority: string }>;
  needsHuman?: Array<{ type: string; message: string; priority: string }>;
  applied?: Array<{ message: string; status: string }>;
  gate?: string;
  improvements?: string[];
  elapsed?: number;
  error?: string;
}

// ── EVT_VIEW_CONTEXT ───────────────────────────────────────────────

/** Preview → Manager: sent on story change and viewport resize. */
export const EVT_VIEW_CONTEXT = 'emdesign/view-context';

export interface ViewContextPayload {
  component: string;
  storyId: string;
  storyName: string;
  viewport: { width: number; height: number };
  componentFile?: string;
  storyFile?: string;
  designSystem: string;
  tokens?: string[];
}

// ── EVT_ELEMENT_SELECTED ───────────────────────────────────────────

/** Preview → Manager: sent when the user clicks an element in reference mode. */
export const EVT_ELEMENT_SELECTED = 'emdesign/element-selected';

export interface ElementSelectedPayload {
  tag: string;
  text: string;
  selector: string;
  component: string;
  rect: { x: number; y: number; width: number; height: number };
  computedStyles: Record<string, string>;
  emdesignComponent?: string;
  tokenBindings?: string[];
}

/** A pointed-at element captured by the preview overlay. */
export interface CommentTarget {
  selector: string;
  box?: { x: number; y: number; width: number; height: number };
  text?: string;
  tag?: string;
  classes?: string;
  storyId?: string;
  component?: string;
}
