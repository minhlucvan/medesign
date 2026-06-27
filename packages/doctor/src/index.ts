/**
 * @emdesign/doctor — rule-based design-system linting over the dsr/graph data model.
 * Runs the built-in production-readiness ruleset + any plugin-contributed DesignReviewRules and
 * reports findings (severity · detail · fix · where) + an X/Y "rules passed" summary.
 */
export { CORE_RULES } from './rules.js';
export { lintDesignSystem } from './lint.js';
export type { DoctorReport, DoctorFinding } from './lint.js';
export { renderReport } from './render.js';
export { lintRendered, mergeReports } from './rendered.js';
export { lintCharters, lintFrameworkCharters } from './charters.js';
