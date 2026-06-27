/**
 * Rendered rule: detect elements missing dark: variant for color utilities.
 *
 * Checks each rendered DOM node for color-affecting utilities (bg-, text-,
 * border-, ring-) and ensures corresponding dark: prefixed variants exist.
 * Skips elements with only structural/display utilities and elements where
 * no dark theme is declared.
 */

import type { RenderedReviewRule, RenderedReviewContext } from '@emdesign/dsr';
import { hasColorUtilities } from '../../resolve-token.js';

/** Regex to extract individual Tailwind utility classes from the class string. */
const UTILITY_RE = /([a-z][\w-]+(?:\[[^\]]+\])?)/g;

/** Color utility prefixes that need dark: counterparts. */
const COLOR_PREFIXES = ['bg-', 'text-', 'border-', 'ring-', 'outline-', 'from-', 'via-', 'to-'];

function getColorUtilities(classes: string): string[] {
  const found: string[] = [];
  let m: RegExpExecArray | null;
  UTILITY_RE.lastIndex = 0;
  while ((m = UTILITY_RE.exec(classes)) !== null) {
    for (const prefix of COLOR_PREFIXES) {
      if (m[1].startsWith(prefix)) {
        found.push(m[1]);
        break;
      }
    }
  }
  return found;
}

export const darkVariantsRule: RenderedReviewRule = {
  id: 'tailwind-dark-variants',
  category: 'tailwind',
  title: 'Color utilities have dark: variants when dark theme exists',
  severity: 'P1',
  target: 'all color utilities have dark: counterparts',
  check: ({ ds, renders }: RenderedReviewContext) => {
    // Check if the DS has a dark theme
    const themes = ds.themes();
    const hasDark = themes.some((t) => t.name?.toLowerCase() === 'dark');
    if (!hasDark) {
      return { pass: true, detail: 'No dark theme declared — dark variant checks skipped' };
    }

    const bad: string[] = [];
    for (const snap of renders) {
      for (const n of snap.nodes) {
        if (!hasColorUtilities(n.classes)) continue;

        const colorUtils = getColorUtilities(n.classes);
        const missing: string[] = [];

        for (const util of colorUtils) {
          const darkKey = `dark:${util}`;
          if (!n.classes.includes(darkKey)) {
            missing.push(darkKey);
          }
        }

        if (missing.length > 0) {
          bad.push(`${n.selector} missing dark: variants: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` +${missing.length - 5} more` : ''}`);
        }
      }
    }

    const top = bad.slice(0, 10);
    return {
      pass: bad.length === 0,
      detail: bad.length
        ? `${bad.length} element(s) missing dark: variants`
        : 'all color utilities have dark: variants',
      fix: top.length
        ? `Add dark: prefixed variants: ${top.join('; ')}`
        : undefined,
    };
  },
};
