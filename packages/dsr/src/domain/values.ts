/**
 * Value objects — immutable, identity-less domain primitives.
 */

/** The canonical semantic token roles every design system MUST declare. */
export const SEMANTIC_TOKEN_ROLES = [
  'color-surface',
  'color-surface-raised',
  'color-text',
  'color-text-muted',
  'color-accent',
  'color-accent-hover',
  'color-border',
  'radius',
  'space-unit',
  'font-sans',
  'shadow-raised',
] as const;

export type TokenRole = (typeof SEMANTIC_TOKEN_ROLES)[number];

const ROLE_SET = new Set<string>(SEMANTIC_TOKEN_ROLES);

/** True if `name` (without a leading `--`) is a required semantic token role. */
export function isSemanticToken(name: string): boolean {
  return ROLE_SET.has(name.replace(/^--/, ''));
}

export type TokenKind = 'color' | 'type' | 'spacing' | 'radius' | 'shadow' | 'motion' | 'layout';

export type Severity = 'P0' | 'P1' | 'P2';

export interface Provenance {
  file: string;
  line?: number;
}

/** A diagnostic produced by a rule (the unit of validation/lint output). */
export interface Diagnostic {
  ruleId: string;
  severity: Severity;
  message: string;
  scope: RuleScope;
  target?: string; // node id / component name
  where?: Provenance;
  fix?: string;
  snippet?: string;
}

export type RuleScope = 'token' | 'component' | 'system' | 'artifact';

/** A located reference (find-references / find-affected result). */
export interface Reference {
  id: string;
  label: string;
  name?: string;
  via: string[]; // edge labels traversed
  depth: number;
  where?: Provenance;
}

export interface Conflict {
  kind: 'duplicate-role' | 'name-collision' | 'theme-override' | 'orphan-token' | 'unresolved-var' | 'missing-role';
  severity: Severity;
  message: string;
  subjects: string[];
}

export function severityRank(s: Severity): number {
  return s === 'P0' ? 0 : s === 'P1' ? 1 : 2;
}
