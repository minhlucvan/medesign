/** Channel events shared between the manager panel and the preview overlay. */
export const ADDON_ID = 'medesign';

/** The active canvas tool. `off` disables the picker; the others change what a click does. */
export type ToolMode = 'off' | 'comment' | 'copy' | 'text';

export const EVT_TOOL_MODE = 'medesign/tool-mode'; // manager → preview: { mode: ToolMode }
export const EVT_COMMENT_SUBMIT = 'medesign/comment-submit'; // preview → manager: { target, instruction }
export const EVT_TEXT_SUBMIT = 'medesign/text-submit'; // preview → manager: { target, from, to } (the pen)
export const EVT_COPIED = 'medesign/copied'; // preview → manager: { ok, selector } (toolbar copy confirmation)

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
