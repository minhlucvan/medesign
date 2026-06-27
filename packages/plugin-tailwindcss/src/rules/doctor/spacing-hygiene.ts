/**
 * Doctor rule: check that --space-unit token is declared.
 *
 * This gates the rendered spacing-hygiene checks. If no --space-unit
 * is declared, the rendered rule passes silently.
 */

import type { DesignReviewRule, ReviewContext } from '@emdesign/dsr';

export const spacingUnitDeclaredRule: DesignReviewRule = {
  id: 'tailwind-spacing-unit-declared',
  category: 'contract',
  title: 'Spacing scale token declared as --space-unit',
  severity: 'P2',
  target: '--space-unit declared in tokens.css',
  check: ({ ds }: ReviewContext) => {
    const has = ds.tokens().some((t) => t.role === 'space-unit' || t.name === '--space-unit');
    return {
      pass: true, // Always pass — advisory: if missing, rendered checks skip
      detail: has
        ? '--space-unit found'
        : 'no --space-unit token — rendered spacing checks will be skipped',
      fix: has
        ? undefined
        : 'Declare --space-unit in tokens.css (e.g. 8px) to enable spacing-hygiene checks.',
    };
  },
};
