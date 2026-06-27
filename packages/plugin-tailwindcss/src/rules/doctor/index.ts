import type { DesignReviewRule } from '@emdesign/dsr';
import { spacingUnitDeclaredRule } from './spacing-hygiene.js';
import { breakpointContractRule } from './breakpoint-contract.js';

export const TAILWIND_DOCTOR_RULES: DesignReviewRule[] = [
  spacingUnitDeclaredRule,
  breakpointContractRule,
];
