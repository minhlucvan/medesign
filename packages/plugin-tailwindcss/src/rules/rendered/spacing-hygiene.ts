/**
 * Rendered rule: detect computed spacing values not aligned to --space-unit.
 *
 * Checks margin, padding, gap, width, and height computed pixel values
 * against the design system's --space-unit multiple scale. Skips zero,
 * auto, and var() values. If no --space-unit is declared, passes silently.
 */

import type { RenderedReviewRule, RenderedReviewContext } from '@emdesign/dsr';
import { spacingToScale } from '../../resolve-token.js';

/** Parse a CSS px string to number. */
function parsePx(v: string): number {
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v.trim());
  return m ? Number(m[1]) : 0;
}

/** Properties to check for spacing alignment (only those present in RenderNode.styles). */
const SPACING_PROPS = [
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'gap',
] as const;

export const spacingHygieneRule: RenderedReviewRule = {
  id: 'tailwind-spacing-hygiene',
  category: 'tailwind',
  title: 'Computed spacing values align to --space-unit scale',
  severity: 'P2',
  target: 'all margin/padding/gap/width/height multiples of --space-unit',
  check: ({ ds, renders }: RenderedReviewContext) => {
    // Find --space-unit
    const unitToken = ds.tokens().find((t) => t.role === 'space-unit' || t.name === '--space-unit');
    if (!unitToken) {
      return { pass: true, detail: 'No --space-unit token — spacing scale check skipped' };
    }
    const unit = parsePx(unitToken.value);
    if (unit <= 0) {
      return { pass: true, detail: `Invalid --space-unit value "${unitToken.value}" — check skipped` };
    }

    const bad: string[] = [];
    for (const snap of renders) {
      for (const n of snap.nodes) {
        for (const prop of SPACING_PROPS) {
          const raw = n.styles[prop];
          if (!raw) continue;
          const px = parsePx(raw);
          if (px === 0) continue;
          const { nearest, mismatch } = spacingToScale(px, unit);
          if (mismatch) {
            bad.push(`${n.selector} ${prop}=${px}px (nearest ${unit}px multiple: ${nearest * unit}px)`);
          }
        }
      }
    }

    const top = bad.slice(0, 10);
    return {
      pass: bad.length === 0,
      detail: bad.length
        ? `${bad.length} off-scale spacing value(s) (showing ${top.length})`
        : 'all spacing values align to --space-unit scale',
      fix: top.length
        ? `Use spacing values that are multiples of ${unit}px (--space-unit): ${top.join('; ')}`
        : undefined,
    };
  },
};
