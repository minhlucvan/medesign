import type { DesignSystem } from '../domain/designSystem.js';
import type { Severity, Provenance, Conflict } from '../domain/values.js';

/**
 * The vocabulary for rule-based DESIGN-SYSTEM review (the doctor). A review rule is a single
 * production-readiness check that queries the rich data model (the DesignSystem aggregate + graph
 * stats + conflicts) and returns a finding with an actionable fix. Core ships a set; plugins
 * (css/react/tailwind/…) contribute their own via `doctorRules()`.
 */
export interface ReviewContext {
  ds: DesignSystem;
  /** Relational issues (orphan tokens, dangling theme overrides, …). */
  conflicts: Conflict[];
  /** Graph node/edge counts by label — includes any plugin-contributed node types. */
  stats: Record<string, number>;
}

export interface ReviewFinding {
  pass: boolean;
  /** The observed state, e.g. "10 rows" or "no [data-theme] block". */
  detail: string;
  /** How to improve — only when `pass` is false. */
  fix?: string;
  where?: Provenance;
}

export interface DesignReviewRule {
  id: string;
  /** Grouping for the report, e.g. 'contract' | 'depth' | 'theming' | 'a11y' | 'react' | 'tailwind' | 'css'. */
  category: string;
  title: string;
  /** Severity when the check fails (passing rules emit none). */
  severity: Severity;
  /** Human-readable target, e.g. '>= 14 rows'. */
  target: string;
  check(ctx: ReviewContext): ReviewFinding;
}
