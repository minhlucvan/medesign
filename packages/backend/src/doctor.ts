import { detectConflicts } from '@medesign/dsr';
import { lintDesignSystem, lintRendered, mergeReports, renderReport, type DoctorReport } from '@medesign/doctor';
import { normalizeDsRef, type RepoPaths } from './paths.js';
import { runtimeFor } from './runtime.js';
import { buildAndSave } from './graph.js';
import { effectiveAdapter } from './adapters/index.js';
import { renderSnapshot } from './renderProbe.js';
import type { RenderSnapshotOutput } from './renderProbe.js';
import type { RenderedReviewContext, RenderedReviewRule, RenderSnapshot } from '@medesign/dsr';

export interface GradeReport extends DoctorReport {
  /** Production-ready when no P0/P1 finding remains. */
  matchesGrade: boolean;
  /** Whether render-lint was skipped. */
  renderLintSkipped?: boolean;
  /** Render-lint skip/reason message. */
  renderLintNote?: string;
}

/** Tolerance for Storybook to be considered "reachable" (3s). */
const STORYBOOK_TIMEOUT_MS = 3_000;

/**
 * Optional overrides for gradeDesignSystem.
 */
export interface GradeOptions {
  /** Skip the rendered-artifact lint entirely. */
  skipRenderLint?: boolean;
  /** Themes to capture for render-lint. */
  renderThemes?: ('light' | 'dark')[];
  /** Explicit component names to render (default: derive from graph primitives). */
  components?: string[];
}

/**
 * Extract component names from the graph's primitive/story nodes.
 * Returns a set of deduplicated names, e.g. "Button", "Card", "PricingTiers".
 */
function componentNamesFromGraph(graph: import('@medesign/graph').Graph): string[] {
  const names = new Set<string>();

  // 1. Primitives — node id format: `${dsId}/${Name}`
  for (const n of graph.nodes({ label: 'primitive' })) {
    const parts = n.id.split('/');
    const name = parts[parts.length - 1];
    if (name) names.add(name);
  }

  // 2. Artifacts — same structure
  for (const n of graph.nodes({ label: 'artifact' })) {
    const parts = n.id.split('/');
    const name = parts[parts.length - 1];
    if (name) names.add(name);
  }

  // 3. Story nodes — extract name from storyOf edges
  for (const n of graph.nodes({ label: 'story' })) {
    // Stories link to their owning primitive/artifact via storyOf edges.
    // The story node id format: `${dsId}/${Name}.stories#${exportName}`
    const afterSlash = n.id.split('/').pop() ?? '';
    const name = afterSlash.split('.stories')[0];
    if (name) names.add(name);
  }

  return Array.from(names);
}

/**
 * `ds doctor` — orchestrates the rule-based design-system linter, now including rendered-artifact
 * lint (DOM geometry/contrast via render-probe + plugin-core renderedDoctorRules).
 *
 * Async because it may run Playwright to capture render snapshots. Degrades gracefully if Storybook
 * is not running (rendered lint is skipped with an info-level note).
 */
export async function gradeDesignSystem(paths: RepoPaths, ref: string, opts: GradeOptions = {}): Promise<GradeReport> {
  const id = normalizeDsRef(ref);
  buildAndSave(paths, id); // rebuild graph.json with the stack's graph parsers (e.g. plugin-css)
  const ds = runtimeFor(paths).load(id);
  const conflicts = detectConflicts(ds);
  const stats = ds.graph.stats();
  const adapter = effectiveAdapter(paths);
  const rules = adapter.doctorRules();
  const staticReport = lintDesignSystem(id, { ds, conflicts, stats }, rules);

  // ---- rendered-artifact lint (best-effort) ----
  let renderReportResult: DoctorReport | null = null;
  let renderLintSkipped = false;
  let renderLintNote: string | undefined;

  if (!opts.skipRenderLint) {
    // Determine components to render
    const components = opts.components && opts.components.length > 0
      ? opts.components
      : componentNamesFromGraph(ds.graph);

    if (components.length === 0) {
      renderLintSkipped = true;
      renderLintNote = 'no primitives/stories found in graph (render-lint skipped)';
    } else {
      // Try to reach Storybook quickly; skip gracefully on failure
      let storybookReachable = false;
      try {
        const baseUrl = paths.storybookUrl || process.env.MEDESIGN_STORYBOOK_URL || 'http://localhost:6006';
        const resp = await fetch(baseUrl, { signal: AbortSignal.timeout(STORYBOOK_TIMEOUT_MS) });
        storybookReachable = resp.ok;
      } catch {
        storybookReachable = false;
      }

      if (!storybookReachable) {
        renderLintSkipped = true;
        renderLintNote = 'Storybook not reachable (render-lint skipped — start Storybook to enable rendered checks)';
      } else {
        // Gather render snapshots for discovered components (best-effort, limited to 8)
        const allSnapshots: RenderSnapshotOutput[] = [];
        const themes = opts.renderThemes ?? ['light', 'dark'];
        const toRender = components.slice(0, 8);
        for (const component of toRender) {
          try {
            const snapshots = await renderSnapshot(paths, component, { story: 'default', themes });
            allSnapshots.push(...snapshots);
          } catch {
            // Individual component failures are non-fatal
            continue;
          }
        }

        if (allSnapshots.length > 0) {
          // Map to RenderSnapshot format for the context
          const renders: RenderSnapshot[] = allSnapshots.map((s) => ({
            component: s.component,
            storyId: s.storyId,
            url: s.url,
            theme: s.theme,
            viewport: s.viewport,
            root: s.root,
            nodes: s.nodes,
          }));

          const renderCtx: RenderedReviewContext = { ds, renders };
          const renderedRules: RenderedReviewRule[] = adapter.renderedDoctorRules();
          renderReportResult = lintRendered(id, renderCtx, renderedRules);
        } else {
          renderLintSkipped = true;
          renderLintNote = 'no render snapshots captured (render-lint skipped)';
        }
      }
    }
  }

  // ---- compose final report ----
  const finalReport = renderReportResult && !renderLintSkipped
    ? mergeReports(staticReport, renderReportResult)
    : staticReport;

  return {
    ...finalReport,
    matchesGrade: finalReport.findings.every((f) => f.severity === 'P2'),
    renderLintSkipped,
    renderLintNote,
  };
}

/** Render a GradeReport as human-readable text. Delegates to @medesign/doctor's renderReport. */
export const renderGrade = renderReport;
