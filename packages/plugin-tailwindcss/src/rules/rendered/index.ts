import type { RenderedReviewRule } from '@emdesign/dsr';
import { utilityDensityRule } from './utility-density.js';
import { darkVariantsRule } from './dark-variants.js';
import { interactiveStatesRule } from './interactive-states.js';
import { colorDisciplineRule } from './color-discipline.js';
import { spacingHygieneRule } from './spacing-hygiene.js';
import { breakpointUsageRule } from './breakpoint-usage.js';

export const TAILWIND_RENDERED_RULES: RenderedReviewRule[] = [
  utilityDensityRule,
  darkVariantsRule,
  interactiveStatesRule,
  colorDisciplineRule,
  spacingHygieneRule,
  breakpointUsageRule,
];
