import type { Rule } from '@emdesign/dsr';
import { hardcodedColorsRule } from './hardcoded-colors.js';
import { arbitraryValuesRule } from './arbitrary-values.js';
import { importantModifierRule } from './important-modifier.js';

export const TAILWIND_SOURCE_RULES: Rule[] = [
  hardcodedColorsRule,
  arbitraryValuesRule,
  importantModifierRule,
];
