/**
 * Rendered rule: detect non-standard responsive breakpoint usage.
 *
 * Scans rendered DOM node classes for max-*: and min-[…]: breakpoint
 * prefixes, flagging non-standard patterns against the DS breakpoint
 * contract. If no DS breakpoint contract exists, passes silently.
 */

import type { RenderedReviewRule, RenderedReviewContext } from '@emdesign/dsr';
import { validateBreakpoint } from '../../resolve-token.js';

/** Regex to extract breakpoint prefixes from class strings. */
const BREAKPOINT_RE = /(max-(?:sm|md|lg|xl|2xl)|min-\[[^\]]+\]):/g;

/** Extract breakpoint definitions from the DS design spec (heuristic: section rows). */
function extractDSBreakpoints(ds: RenderedReviewContext['ds']): Record<string, string> {
  const bps: Record<string, string> = {};
  const sections = ds.sections();
  const bpSection = sections.find(
    (s) => /breakpoints?|responsive|viewport/i.test(s.title),
  );
  if (bpSection && bpSection.tableRows > 0) {
    // If the section title itself contains a breakpoint name/value, use it
    const titleMatch = bpSection.title.match(/\b(sm|md|lg|xl|2xl)\s*[:=]\s*(\d+)\s*px?\b/i);
    if (titleMatch) bps[titleMatch[1].toLowerCase()] = `${titleMatch[2]}px`;
  }
  return bps;
}

export const breakpointUsageRule: RenderedReviewRule = {
  id: 'tailwind-breakpoint-usage',
  category: 'tailwind',
  title: 'Breakpoint usage follows DS contract',
  severity: 'P2',
  target: 'no non-standard breakpoint prefixes',
  check: ({ ds, renders }: RenderedReviewContext) => {
    const breakpoints = extractDSBreakpoints(ds);
    const bad: string[] = [];

    for (const snap of renders) {
      for (const n of snap.nodes) {
        let m: RegExpExecArray | null;
        BREAKPOINT_RE.lastIndex = 0;
        while ((m = BREAKPOINT_RE.exec(n.classes)) !== null) {
          const prefix = m[1];
          const result = validateBreakpoint(prefix, breakpoints);
          if (!result.valid) {
            bad.push(`${n.selector} uses ${prefix}: — ${result.suggestion}`);
          }
        }
      }
    }

    const top = bad.slice(0, 10);
    return {
      pass: bad.length === 0,
      detail: bad.length
        ? `${bad.length} non-standard breakpoint usage(s) (showing ${top.length})`
        : 'all breakpoint usage follows DS contract',
      fix: top.length
        ? `Replace non-standard breakpoints: ${top.join('; ')}`
        : undefined,
    };
  },
};
