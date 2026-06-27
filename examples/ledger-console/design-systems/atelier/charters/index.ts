/**
 * Atelier Element Charters — aggregator.
 *
 * Exports all Element Charters for the Atelier design system.
 * Each charter is a first-class, testable contract that validates
 * design-system-specific behavioral expectations.
 */
import type { ElementCharter } from '@emdesign/dsr';
import { buttonPadding } from './button-padding.js';
import { headingFont } from './heading-font.js';
import { accentUsage } from './accent-usage.js';
import { noOverlap } from './no-overlap.js';

export default [
  buttonPadding,
  headingFont,
  accentUsage,
  noOverlap,
] satisfies ElementCharter[];
