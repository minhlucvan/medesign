/**
 * Rendered rule: detect elements with excessive Tailwind utility density.
 *
 * Flags elements whose class string contains more than the threshold
 * of Tailwind utility classes (default: 10), suggesting component
 * extraction or composition.
 */

import type { RenderedReviewRule, RenderedReviewContext } from '@emdesign/dsr';

const DEFAULT_THRESHOLD = 10;

/** Count Tailwind-like utilities (lowercase, hyphenated patterns). */
function countTailwindUtilities(classes: string): number {
  if (!classes) return 0;
  return classes
    .split(/\s+/)
    .filter((c) => /^[a-z][\w-]*/.test(c) && !c.startsWith('_') && !c.startsWith('@'))
    .length;
}

export const utilityDensityRule: RenderedReviewRule = {
  id: 'tailwind-utility-density',
  category: 'tailwind',
  title: 'Avoid excessive Tailwind utility density',
  severity: 'P2',
  target: `≤${DEFAULT_THRESHOLD} utilities per element`,
  check: ({ renders }: RenderedReviewContext) => {
    const bad: string[] = [];
    for (const snap of renders) {
      for (const n of snap.nodes) {
        const count = countTailwindUtilities(n.classes);
        if (count > DEFAULT_THRESHOLD) {
          bad.push(`${n.selector} (${n.tag}) has ${count} utilities — extract into a component`);
        }
      }
    }
    const top = bad.slice(0, 10);
    return {
      pass: bad.length === 0,
      detail: bad.length
        ? `${bad.length} element(s) exceed ${DEFAULT_THRESHOLD} utilities (showing ${top.length})`
        : 'all elements within utility density threshold',
      fix: top.length
        ? `Extract sub-components or use composition: ${top.join('; ')}`
        : undefined,
    };
  },
};
