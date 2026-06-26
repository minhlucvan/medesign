import type { TokenKind } from '../schema.js';

export const COLOR_VALUE = /(#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\([^)]*\))/;

/** A standalone single color value (not a shadow/gradient string containing rgba). */
export function isSingleColor(value: string): boolean {
  const v = value.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(v) || /^(?:rgb|rgba|hsl|hsla|oklch)\([^)]*\)$/.test(v);
}

/** Infer a token kind from its custom-property name. */
export function tokenKind(name: string): TokenKind {
  if (name.startsWith('color-')) return 'color';
  if (name.startsWith('font-') || name.startsWith('text-') || name.startsWith('leading-') || name.startsWith('tracking-')) return 'type';
  if (name.startsWith('space')) return 'spacing';
  if (name.startsWith('radius')) return 'radius';
  if (name.startsWith('shadow') || name.startsWith('focus')) return 'shadow';
  if (name.startsWith('motion') || name.startsWith('ease')) return 'motion';
  return 'layout';
}

/** 1-based line number of `index` within `text`. */
export function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

/** Tailwind semantic color-class suffixes → token role name (matches apps/studio/tailwind.config.js). */
export const TW_COLOR_ROLES = ['accent-hover', 'accent', 'surface-raised', 'surface', 'text-muted', 'text', 'border'];

/** First font family in a `--font-*` value, e.g. `"Newsreader", Georgia, serif` → `Newsreader`. */
export function firstFontFamily(value: string): string | null {
  const m = value.match(/^\s*["']?([^",']+)["']?/);
  return m ? m[1].trim() : null;
}
