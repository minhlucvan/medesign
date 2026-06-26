/**
 * Rule registry — the canonical metadata for every consistency-lint rule, consumed by the graph
 * (rule nodes, `governs`/`violates` edges, and where-to-fix remediation).
 *
 * Mirrors the rule ids emitted by `@medesign/backend`'s linter
 * (`packages/backend/src/lint/`). Keep the ids in sync; this module owns the remediation +
 * applicability metadata the graph needs.
 */
export type Severity = 'P0' | 'P1' | 'P2';

export interface RuleDef {
  id: string;
  severity: Severity;
  message: string;
  /** Which nodes the rule governs. */
  appliesTo: 'all' | 'headings';
  /** Where-to-fix guidance. `tokenRole` names the role the fix should reference, if any. */
  remediation: { text: string; tokenRole?: string; sectionHint?: string };
}

export const RULES: RuleDef[] = [
  {
    id: 'off-token-color',
    severity: 'P1',
    message: 'Raw hex used where a token role exists.',
    appliesTo: 'all',
    remediation: { text: 'Reference a token role (e.g. bg-accent / text-surface) instead of raw hex.', sectionHint: 'Color' },
  },
  {
    id: 'unresolved-token',
    severity: 'P0',
    message: 'var(--x) does not resolve to a declared token.',
    appliesTo: 'all',
    remediation: { text: 'Use a declared role, or add the token to tokens.css.', sectionHint: 'Tokens' },
  },
  {
    id: 'ai-default-indigo',
    severity: 'P0',
    message: 'Solid AI-default indigo used outside token definitions.',
    appliesTo: 'all',
    remediation: { text: 'Use the design-system accent token, not a raw indigo hex.', tokenRole: 'color-accent', sectionHint: 'Color' },
  },
  {
    id: 'purple-gradient',
    severity: 'P0',
    message: 'Indigo/violet/purple gradient — the AI-default look.',
    appliesTo: 'all',
    remediation: { text: 'Use the solid accent token; drop the gradient.', tokenRole: 'color-accent', sectionHint: 'Color' },
  },
  {
    id: 'trust-gradient',
    severity: 'P0',
    message: 'Blue→cyan "trust gradient" hero cliché.',
    appliesTo: 'all',
    remediation: { text: 'Use a flat surface + accent from the design system.', tokenRole: 'color-surface', sectionHint: 'Color' },
  },
  {
    id: 'emoji-icon',
    severity: 'P0',
    message: 'Emoji used as an icon.',
    appliesTo: 'all',
    remediation: { text: 'Use a real icon or omit it.', sectionHint: 'Anti-patterns' },
  },
  {
    id: 'left-accent-card',
    severity: 'P0',
    message: 'Rounded card with a colored left border.',
    appliesTo: 'all',
    remediation: { text: 'Hairline border on all sides + the design-system shadow.', tokenRole: 'shadow-raised', sectionHint: 'Components' },
  },
  {
    id: 'sans-display',
    severity: 'P0',
    message: 'Sans-serif family on a display heading.',
    appliesTo: 'headings',
    remediation: { text: 'Headings must use the display font.', tokenRole: 'font-display', sectionHint: 'Typography' },
  },
  {
    id: 'invented-metric',
    severity: 'P0',
    message: 'Invented marketing metric.',
    appliesTo: 'all',
    remediation: { text: 'Remove fabricated metrics; use real copy or none.', sectionHint: 'Voice & Brand' },
  },
  {
    id: 'filler-copy',
    severity: 'P0',
    message: 'Filler/placeholder copy.',
    appliesTo: 'all',
    remediation: { text: 'Write real, specific copy.', sectionHint: 'Voice & Brand' },
  },
  {
    id: 'external-image',
    severity: 'P1',
    message: 'External placeholder image host.',
    appliesTo: 'all',
    remediation: { text: 'Use a local asset or a neutral solid block.' },
  },
  {
    id: 'accent-overuse',
    severity: 'P1',
    message: 'Accent used more than ~2 times per screen.',
    appliesTo: 'all',
    remediation: { text: 'Reserve the accent for the single most important element.', tokenRole: 'color-accent', sectionHint: 'Color' },
  },
];

export const RULES_BY_ID: Record<string, RuleDef> = Object.fromEntries(RULES.map((r) => [r.id, r]));
