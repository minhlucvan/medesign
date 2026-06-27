/**
 * Rendered rule: detect computed colors that don't match --color-* tokens.
 *
 * Works against render-probe DOM snapshots. For each node, checks the
 * computed color and backgroundColor against known DS token values.
 * Catches colors injected via style={{}} that source-level parsing misses.
 *
 * Skips transparent, var() references, and elements whose computed color
 * resolves to a known DS token value.
 */

import type { RenderedReviewRule, RenderedReviewContext } from '@emdesign/dsr';

/** Parse a hex color #xxx or #xxxxxx → normalized string. */
function normalizeHex(v: string): string | null {
  const s = v.trim().toLowerCase();
  let h = s;
  if (!h.startsWith('#')) return null;
  h = h.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length < 6) return null;
  return `#${h.slice(0, 6)}`;
}

/** Parse rgb(…) string → normalized hex. */
function rgbToHex(v: string): string | null {
  const m = /^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v.trim().toLowerCase());
  if (!m) return null;
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(parseInt(m[1]))}${toHex(parseInt(m[2]))}${toHex(parseInt(m[3]))}`;
}

/** Resolve a computed color string to a normalized hex value. */
function resolveToHex(v: string): string | null {
  if (!v || v === 'transparent' || v === 'rgba(0, 0, 0, 0)') return null;
  if (v.startsWith('#')) return normalizeHex(v);
  if (v.startsWith('rgb')) return rgbToHex(v);
  return null;
}

/** Build a set of known DS token color values (normalized hex). */
function knownTokenHexValues(ds: RenderedReviewContext['ds']): Set<string> {
  const colors = new Set<string>();
  for (const t of ds.tokens()) {
    if (t.kind === 'color' || t.name?.startsWith('--color-')) {
      const hex = resolveToHex(t.value);
      if (hex) colors.add(hex);
    }
  }
  return colors;
}

export const colorDisciplineRule: RenderedReviewRule = {
  id: 'tailwind-color-discipline',
  category: 'tailwind',
  title: 'Computed colors match --color-* token values',
  severity: 'P1',
  target: 'no computed color outside DS token palette',
  check: ({ ds, renders }: RenderedReviewContext) => {
    const known = knownTokenHexValues(ds);

    // If no token colors declared, skip
    if (known.size === 0) {
      return { pass: true, detail: 'No --color-* token values found — color discipline check skipped' };
    }

    const bad: string[] = [];
    for (const snap of renders) {
      for (const n of snap.nodes) {
        // Check text color
        const fgHex = resolveToHex(n.styles.color);
        if (fgHex && !known.has(fgHex)) {
          bad.push(`${n.selector} text color ${n.styles.color} (${fgHex}) not in DS token palette`);
        }

        // Check background color
        const bgHex = resolveToHex(n.styles.backgroundColor);
        if (bgHex && !known.has(bgHex)) {
          // Skip html/body elements that may inherit page defaults
          if (n.tag === 'html' || n.tag === 'body') continue;
          bad.push(`${n.selector} background ${n.styles.backgroundColor} (${bgHex}) not in DS token palette`);
        }
      }
    }

    const top = bad.slice(0, 10);
    return {
      pass: bad.length === 0,
      detail: bad.length
        ? `${bad.length} off-token computed color(s) (showing ${top.length})`
        : 'all computed colors match DS token palette',
      fix: top.length
        ? `Use --color-* token-bound classes: ${top.join('; ')}`
        : undefined,
    };
  },
};
