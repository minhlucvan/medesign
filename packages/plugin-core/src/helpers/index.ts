/**
 * Utility helpers for plugin-core rules.
 *
 * Shared helpers for CSS parsing, color math, DOM analysis, and design system
 * introspection used across all doctor and rendered rules.
 */
import type { RenderNode, RenderedReviewContext } from '@emdesign/plugin-api';

/** Parse a CSS px value like "16px" → 16. Returns 0 for invalid/non-px. */
export function parsePx(v: string): number {
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v.trim());
  return m ? Number(m[1]) : 0;
}

/** Check if a value is a nonzero px measurement. */
export function isPx(v: string): boolean {
  return /^-?\d+(?:\.\d+)?px$/.test(v.trim());
}

/** Parse a hex color (#xxx, #xxxxxx) or rgb/rgba function → [r, g, b] or null. */
export function parseColor(v: string): [number, number, number] | null {
  const s = v.trim().toLowerCase();

  // rgb(255, 0, 128) or rgba(255, 0, 128, 0.5)
  const rgbMatch = /^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
  }

  // #xxx or #xxxxxx
  let h = s;
  if (!h.startsWith('#')) return null;
  h = h.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length < 6) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** sRGB luminance (WCAG relative luminance). */
export function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio between two colors. */
export function contrastRatio(a: string, b: string): number | null {
  const ha = parseColor(a), hb = parseColor(b);
  if (!ha || !hb) return null;
  const la = luminance(ha), lb = luminance(hb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Is this resolved color transparent or near-transparent? */
export function isTransparent(v: string): boolean {
  const t = v.trim().toLowerCase().replace(/\s/g, '');
  if (t === 'transparent' || t === 'rgba(0,0,0,0)') return true;
  // Catch bare rgb(0,0,0) used as transparent by some design systems
  if (/^rgba?\(0,0,0(,\s*0(\.\d+)?)?\)$/.test(t.replace(/\s/g, ''))) return true;
  return false;
}

/** Resolve the effective background color for a text node by walking ancestors. */
export function resolveBackground(node: RenderNode, allNodes: RenderNode[]): string {
  if (!isTransparent(node.styles.backgroundColor)) {
    return node.styles.backgroundColor;
  }
  // Walk up by matching parentSelector
  const parent = allNodes.find((n) => n.selector === node.parentSelector);
  if (parent) return resolveBackground(parent, allNodes);
  return '#ffffff'; // fallback to white
}

/** Does the node look interactive? */
export function isInteractive(node: RenderNode): boolean {
  const tag = node.tag.toLowerCase();
  if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea') return true;
  if (node.classes && /\b(btn|button|clickable|interactive)\b/i.test(node.classes)) return true;
  return false;
}

/** Extract --space-unit value from the design system (defaults to 8px). */
export function spaceUnit(ds: RenderedReviewContext['ds']): number {
  const spaceToken = ds.tokens().find((t) => t.role === 'space-unit' || t.name === '--space-unit');
  if (spaceToken) {
    const px = parsePx(spaceToken.value);
    if (px > 0) return px;
  }
  return 8; // sensible default
}

/** Count distinct fontSize values in a render snapshot. */
export function distinctFontSizes(snapshot: { nodes: RenderNode[] }): number {
  const sizes = new Set<string>();
  for (const n of snapshot.nodes) {
    const px = n.styles.fontSize;
    if (px) sizes.add(px);
  }
  return sizes.size;
}
