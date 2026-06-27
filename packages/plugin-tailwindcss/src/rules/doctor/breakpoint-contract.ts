/**
 * Doctor rule: check that the DESIGN.md breakpoints section is populated.
 *
 * This gates the rendered breakpoint-usage checks. If no breakpoint
 * contract exists, rendered breakpoint rules skip validation.
 */

import type { DesignReviewRule, ReviewContext } from '@emdesign/dsr';

export const breakpointContractRule: DesignReviewRule = {
  id: 'tailwind-breakpoint-contract',
  category: 'contract',
  title: 'Breakpoint section in DESIGN.md is populated',
  severity: 'P2',
  target: '≥2 breakpoint definitions in DESIGN.md',
  check: ({ ds }: ReviewContext) => {
    // Look for a breakpoints section
    const sections = ds.sections();
    const bpSection = sections.find(
      (s) => /breakpoints?|responsive|viewport/i.test(s.title),
    );

    if (!bpSection || (bpSection.wordCount < 10 && bpSection.tableRows === 0)) {
      return {
        pass: true, // Always pass — advisory
        detail: !bpSection
          ? 'No breakpoint section found in DESIGN.md — rendered breakpoint checks will be skipped'
          : 'Breakpoint section has minimal content — consider defining named breakpoints',
        fix: !bpSection
          ? 'Add a "Breakpoints" section to DESIGN.md with at least 2 breakpoint definitions (e.g. sm: 640px, md: 768px, lg: 1024px).'
          : 'Add at least 2 named breakpoints with pixel values to the breakpoints table in DESIGN.md.',
      };
    }

    return {
      pass: true,
      detail: `${bpSection.title} section found with ${bpSection.tableRows} rows`,
    };
  },
};
