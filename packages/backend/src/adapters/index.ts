/**
 * FrameworkAdapter — the per-framework surface. Everything else in the server is framework-
 * agnostic (visual test, screenshot, critique gate, token/section graph, addon, MCP/HTTP, gates),
 * so adding a tech stack = adding an adapter. React/Tailwind is implemented; others are stubs.
 */
import type { DesignSystem } from '../designContext.js';
import { lintComponent, lintTokenReferences, type Finding, type LintOptions } from '../lint/index.js';

export interface FrameworkAdapter {
  id: string;
  /** Component file extension for this stack. */
  fileExt: string;
  /** Import specifier the generated code uses for design-system primitives. */
  primitiveImport: string;
  /** Stack-specific generation rules injected into the agent prompt. */
  codegenInstructions(ds: DesignSystem): string;
  /** Framework-specific consistency rules + the token self-check. */
  lint(source: string, opts: LintOptions): Finding[];
  /** A starter story for a generated component (this renderer's story format). */
  storyTemplate(name: string): string;
  /** Whether this adapter implements code parsing for the knowledge graph yet. */
  parsesCode: boolean;
}

import { frameworkToStack, type RepoPaths } from '../paths.js';
import { composeStack, type EffectiveAdapter } from '../plugins/compose.js';
import { availablePlugins } from '../plugins/registry.js';

/**
 * Compat shim over the plugin system. `getAdapter` resolves a legacy single `framework` id to its
 * stack; `effectiveAdapter` composes a project's resolved plugin stack (the preferred entry point).
 */
export function getAdapter(framework: string): EffectiveAdapter {
  return composeStack(frameworkToStack(framework));
}

/** Compose the effective adapter from a project's resolved plugin stack. */
export function effectiveAdapter(paths: RepoPaths): EffectiveAdapter {
  return composeStack(paths.plugins?.length ? paths.plugins : frameworkToStack(paths.framework));
}

export function availableFrameworks(): Array<{ id: string; implemented: boolean }> {
  return availablePlugins().filter((p) => p.kind === 'framework').map((p) => ({ id: p.id, implemented: p.implemented }));
}

export { availablePlugins } from '../plugins/registry.js';

/** Shared token self-check + react rules, reused by the react adapter. */
export function runReactLint(source: string, opts: LintOptions): Finding[] {
  return [...lintComponent(source, opts), ...lintTokenReferences(source, opts.declaredTokens ?? [])];
}
