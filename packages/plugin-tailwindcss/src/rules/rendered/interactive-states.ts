/**
 * Rendered rule: detect interactive elements missing state variants.
 *
 * Checks buttons, links, inputs, selects, and textareas for hover,
 * focus, focus-visible, and active state variant classes on their
 * color utilities. Skips disabled elements.
 */

import type { RenderedReviewRule, RenderedReviewContext } from '@emdesign/dsr';
import { isInteractiveTag, isDisabled, hasColorUtilities } from '../../resolve-token.js';

/** State variant prefixes that should be present on interactive elements. */
const REQUIRED_STATES = ['hover:', 'focus:', 'focus-visible:', 'active:'] as const;

export const interactiveStatesRule: RenderedReviewRule = {
  id: 'tailwind-interactive-states',
  category: 'tailwind',
  title: 'Interactive elements have hover/focus/active state variants',
  severity: 'P2',
  target: 'hover:, focus:, focus-visible:, active: present on color utilities',
  check: ({ renders }: RenderedReviewContext) => {
    const findings: string[] = [];

    for (const snap of renders) {
      for (const n of snap.nodes) {
        if (!isInteractiveTag(n.tag, n.classes)) continue;
        if (isDisabled(n.classes)) continue;
        if (!hasColorUtilities(n.classes)) continue;

        const missing: string[] = [];

        for (const state of REQUIRED_STATES) {
          if (!n.classes.includes(state)) {
            missing.push(state);
          }
        }

        if (missing.length > 0) {
          findings.push(`${n.selector} (${n.tag}) missing state variants: ${missing.join(', ')}`);
        }
      }
    }

    const top = findings.slice(0, 10);
    return {
      pass: findings.length === 0,
      detail: findings.length
        ? `${findings.length} interactive element(s) missing state variants (showing ${top.length})`
        : 'all interactive elements have required state variants',
      fix: top.length
        ? `Add state variants to interactive elements: ${top.join('; ')}`
        : undefined,
    };
  },
};
