/** Channel events shared between the manager panel and the preview overlay. */
export const ADDON_ID = 'emdesign';

/** The active canvas tool. `off` disables the picker; the others change what a click does. */
export type ToolMode = 'off' | 'comment' | 'copy' | 'text';

export const EVT_TOOL_MODE = 'emdesign/tool-mode'; // manager → preview: { mode: ToolMode }
export const EVT_COMMENT_SUBMIT = 'emdesign/comment-submit'; // preview → manager: { target, instruction }
export const EVT_TEXT_SUBMIT = 'emdesign/text-submit'; // preview → manager: { target, from, to } (the pen)
export const EVT_COPIED = 'emdesign/copied'; // preview → manager: { ok, selector } (toolbar copy confirmation)
export const EVT_CHAT_MODE = 'emdesign/chat-mode'; // toolbar → manager: { enabled: boolean; sessionId?: string }

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
