import type { DesignReviewRule, RenderedReviewRule, Rule } from '@emdesign/dsr';
import { TAILWIND_DOCTOR_RULES } from './doctor/index.js';
import { TAILWIND_RENDERED_RULES } from './rendered/index.js';
import { TAILWIND_SOURCE_RULES } from './source/index.js';

export { TAILWIND_DOCTOR_RULES } from './doctor/index.js';
export { TAILWIND_RENDERED_RULES } from './rendered/index.js';
export { TAILWIND_SOURCE_RULES } from './source/index.js';

export const ALL_TAILWIND_DOCTOR_RULES: DesignReviewRule[] = TAILWIND_DOCTOR_RULES;
export const ALL_TAILWIND_RENDERED_RULES: RenderedReviewRule[] = TAILWIND_RENDERED_RULES;
export const ALL_TAILWIND_SOURCE_RULES: Rule[] = TAILWIND_SOURCE_RULES;
