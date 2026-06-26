/**
 * @medesign/dsr — the DDD domain layer over @medesign/graph.
 * Load/read/manage a design system like a typed code library: aggregates, value objects, a rule
 * engine, validation, references, conflicts, cache, and history. Design as code.
 */

// value objects (+ back-compat token-role exports)
export {
  SEMANTIC_TOKEN_ROLES,
  isSemanticToken,
  severityRank,
} from './domain/values.js';
export type {
  TokenRole, TokenKind, Severity, Provenance, Diagnostic, RuleScope, Reference, Conflict,
} from './domain/values.js';

// domain aggregate + entity views
export { DesignSystem, Token, Component, Theme, parseDeclaredTokens } from './domain/designSystem.js';
export type { RawAssets, ContextView, SectionView } from './domain/designSystem.js';
export type { DesignReviewRule, ReviewContext, ReviewFinding } from './rules/review.js';

// rules
export { RuleEngine, renderDiagnostics, countMustFix, diagnosticsScore } from './rules/engine.js';
export type { Rule, RuleContext } from './rules/engine.js';
export { componentLint, tokenReferenceLint } from './rules/lint.js';
export type { ComponentLintOptions } from './rules/lint.js';

// rendered-artifact rules (render-probe snapshots + deterministic geometry/contrast lint)
export type {
  RenderNode,
  RenderSnapshot,
  RenderedReviewContext,
  RenderedReviewRule,
} from './rules/rendered.js';

// services
export { Repository } from './services/repository.js';
export type { RepoConfig } from './services/repository.js';
export { detectConflicts } from './services/conflicts.js';
export { snapshot, listSnapshots, diffSnapshots, diffAgainstLatest } from './services/history.js';
export type { Snapshot, HistoryDiff } from './services/history.js';

// runtime facade
export { DesignSystemRuntime, createRuntime } from './runtime.js';
export type { RuntimeConfig, ValidationResult } from './runtime.js';
