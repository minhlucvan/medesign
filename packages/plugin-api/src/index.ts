/**
 * @medesign/plugin-api — the composable plugin contract.
 *
 * A project's stack (e.g. ["react","tailwind","shadcn"]) is a list of plugins that COMPOSE into one
 * effective adapter. Plugins are capability-typed:
 *  - framework  → the renderer (file extensions, code-parsing, primitive import) — most-specific wins
 *  - styling    → tokens/classes/theming/codegen/lint — contributions aggregate
 *  - library    → a component catalog + codegen/lint — contributions aggregate
 * Every hook is optional; the host (backend) aggregates the present ones across the ordered stack.
 *
 * This is a leaf package: it depends only on @medesign/dsr (for the lint Rule type) and uses
 * structural views of the design system / paths so plugin packages never depend back on the engine.
 */
import type { Rule, DesignReviewRule, RenderedReviewRule } from '@medesign/dsr';
import type { GraphParser } from '@medesign/graph';
export type { Rule, DesignReviewRule, RenderedReviewRule, ReviewContext, ReviewFinding, RenderedReviewContext, RenderSnapshot, RenderNode } from '@medesign/dsr';
export type { GraphParser, GraphParseCtx } from '@medesign/graph';

export type PluginKind = 'framework' | 'styling' | 'library';

/** Structural view of a design system the plugin hooks read (engine's DesignSystem is assignable). */
export interface PluginDesignSystem {
  id: string;
  name: string;
  designMd: string;
  tokensCss: string;
  declaredTokens: string[];
  primitives: string[];
  exemptions: string[];
  bindsDisplayFace: boolean;
}

/** Minimal project paths a plugin may need (engine's RepoPaths is assignable). */
export interface PluginPaths {
  root: string;
}

export interface ParseCtx {
  /** Absolute path to the design-system dir (DESIGN.md + tokens.css + code/). */
  dsDir: string;
  /** tokens.css contents. */
  tokensCss: string;
  /** Project root (where tailwind.config.* lives). */
  root: string;
}
export interface TokenInput { role: string; value: string; kind?: string }
export interface ThemeInput { theme: string; overrides: Array<{ role: string; value: string }> }
export interface FileEmit { path: string; content: string }

export interface MedesignPlugin {
  id: string;
  kind: PluginKind;
  /** Whether this plugin marks the stack as code-parseable (framework plugins). */
  parsesCode?: boolean;
  /** Component / story file extensions (framework plugins). */
  fileExt?: string;
  storyExt?: string;
  /** Import specifier generated code uses for primitives (framework plugins). */
  primitiveImport?: string;

  /** Stack-specific generation rules injected into the agent prompt (aggregated, ordered). */
  codegenInstructions?(ds: PluginDesignSystem): string;
  /** A starter story for this renderer (framework plugins). */
  storyTemplate?(name: string): string;
  /** Framework/library-specific lint rules, registered into the dsr RuleEngine. */
  lintRules?(): Rule[];

  /** Utility-suffix → token role map (e.g. { accent: 'color-accent' }) — the single source for the graph. */
  classRoles?(): Record<string, string>;
  /** Parse the styling source (tailwind.config / tokens.css) → token inputs. */
  parseTokens?(ctx: ParseCtx): TokenInput[];
  /** Parse theme overrides ([data-theme]/dark:) → theme inputs (populates the theming graph). */
  parseThemes?(ctx: ParseCtx): ThemeInput[];
  /** Generate styling config (e.g. tailwind.config.js) FROM the token contract. */
  emitConfig?(ds: PluginDesignSystem, paths: PluginPaths): FileEmit[];

  // ---- core-extension hooks: a plugin enriches the data model + the analysis ----
  /** Graph parsers run during buildGraph — emit nodes/edges (incl. plugin-specific node types). */
  graphParsers?(): GraphParser[];
  /** Declare the node labels this plugin contributes (documentation / discovery). */
  nodeTypes?(): string[];
  /** Production-readiness review rules the doctor runs (rule-based DS linting). */
  doctorRules?(): DesignReviewRule[];
  /** Rendered-artifact lint rules that run against render-probe snapshots (DOM geometry/contrast). */
  renderedDoctorRules?(): RenderedReviewRule[];
}
