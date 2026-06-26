import type { RenderedReviewRule, RenderedReviewContext, Severity } from '@medesign/dsr';
import type { DoctorFinding, DoctorReport } from './lint.js';

const RANK: Record<Severity, number> = { P0: 0, P1: 1, P2: 2 };

function letter(r: number): string { return r >= 0.9 ? 'A' : r >= 0.8 ? 'B' : r >= 0.7 ? 'C' : r >= 0.6 ? 'D' : 'F'; }

/**
 * Run the rendered-artifact lint rules (geometry/contrast/overlap/etc.) against one or more
 * render snapshots. Returns a DoctorReport with the same shape as lintDesignSystem().
 *
 * The report's `id` is decorated with ":rendered" to distinguish it from the static DS report.
 */
export function lintRendered(
  id: string,
  ctx: RenderedReviewContext,
  pluginRenderedRules: RenderedReviewRule[] = [],
): DoctorReport {
  const rules = pluginRenderedRules; // Unlike lintDesignSystem, there's no core set for rendered.
  const all: DoctorFinding[] = rules.map((r) => {
    const res = r.check(ctx);
    return {
      ruleId: r.id,
      category: r.category,
      title: r.title,
      severity: r.severity,
      pass: res.pass,
      detail: res.detail,
      target: r.target,
      fix: res.pass ? undefined : res.fix,
    };
  });
  const findings = all.filter((f) => !f.pass).sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  const passes = all.filter((f) => f.pass);
  const byCategory: Record<string, { passed: number; total: number }> = {};
  for (const f of all) {
    const c = (byCategory[f.category] ??= { passed: 0, total: 0 });
    c.total++;
    if (f.pass) c.passed++;
  }
  const passed = passes.length;
  const total = all.length;
  const ratio = total ? passed / total : 0;
  return {
    id: `${id}:rendered`,
    passed,
    total,
    ratio,
    grade: letter(ratio),
    findings,
    passes,
    byCategory,
  };
}

/**
 * Merge a static (DESIGN.md + graph) DoctorReport with a rendered (DOM probe) DoctorReport.
 * Categories and grades are additive; findings and passes are concatenated.
 *
 * Use this to produce a single unified report for consumers (gate, CLI output, panel).
 */
export function mergeReports(staticReport: DoctorReport, renderedReport: DoctorReport): DoctorReport {
  const mergedFindings = [...staticReport.findings, ...renderedReport.findings].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  const passes = [...staticReport.passes, ...renderedReport.passes];
  const byCategory: Record<string, { passed: number; total: number }> = {
    ...staticReport.byCategory,
  };
  // Merge rendered categories into static categories
  for (const [cat, stats] of Object.entries(renderedReport.byCategory)) {
    if (byCategory[cat]) {
      byCategory[cat] = {
        passed: byCategory[cat].passed + stats.passed,
        total: byCategory[cat].total + stats.total,
      };
    } else {
      byCategory[cat] = { ...stats };
    }
  }
  const passed = staticReport.passed + renderedReport.passed;
  const total = staticReport.total + renderedReport.total;
  const ratio = total ? passed / total : 0;
  return {
    id: staticReport.id,
    passed,
    total,
    ratio,
    grade: letter(ratio),
    findings: mergedFindings,
    passes,
    byCategory,
  };
}
