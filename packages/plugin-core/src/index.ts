/**
 * @emdesign/plugin-core — universal, always-on design-system rules.
 *
 * Provides two rule categories:
 *  1. `doctorRules()` — stack-agnostic **logical** DS rules (spacing scale, palette coherence,
 *     naming convention, etc.). Always aggregated into every doctor run.
 *     → See `./rules/doctor/index.ts`
 *  2. `renderedDoctorRules()` — **geometry/contrast** rules that run against render-probe DOM
 *     snapshots (overlap, overflow, off-scale spacing, WCAG contrast, tap-target size,
 *     type-scale sprawl). Always-on for any project with a running Storybook.
 *     → See `./rules/rendered/index.ts`
 *
 * Shared helpers in `./helpers/index.ts` provide CSS parsing, color math, and
 * design system introspection used across all rules.
 */
import type { MedesignPlugin } from '@emdesign/plugin-api';
import { CORE_DOCTOR_RULES } from './rules/doctor/index.js';
import { CORE_RENDERED_RULES } from './rules/rendered/index.js';

export { CORE_DOCTOR_RULES } from './rules/doctor/index.js';
export { CORE_RENDERED_RULES } from './rules/rendered/index.js';

export const corePlugin: MedesignPlugin = {
  id: 'core',
  kind: 'styling',
  doctorRules: () => CORE_DOCTOR_RULES,
  renderedDoctorRules: () => CORE_RENDERED_RULES,
};

export default corePlugin;
