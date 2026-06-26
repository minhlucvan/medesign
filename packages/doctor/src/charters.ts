/**
 * Charter lint — evaluate story-level charters for the doctor pipeline.
 *
 * Follows the same pattern as `lintRendered()` in rendered.ts: takes charter
 * results and produces a DoctorReport with a `charter` category.
 */

import type { Severity } from '@emdesign/dsr';
import type { DoctorFinding, DoctorReport } from './lint.js';
import type { StoryCharterResult } from '@emdesign/dsr';

const RANK: Record<Severity, number> = { P0: 0, P1: 1, P2: 2 };

function letter(r: number): string {
  return r >= 0.9 ? 'A' : r >= 0.8 ? 'B' : r >= 0.7 ? 'C' : r >= 0.6 ? 'D' : 'F';
}

/**
 * Convert an array of per-component/per-story StoryCharterResults into a single
 * DoctorReport with the `charter` category.
 *
 * Each finding in the StoryCharterResult becomes a DoctorFinding.
 * The report is additive — it can be merged into a full GradeReport via mergeReports.
 */
export function lintCharters(
  id: string,
  results: StoryCharterResult[],
): DoctorReport {
  const all: DoctorFinding[] = [];

  for (const result of results) {
    for (const f of result.findings) {
      all.push({
        ruleId: `charter/${f.charterName}`,
        category: 'charter',
        title: f.message,
        severity: f.severity,
        pass: f.pass,
        detail: f.message,
        target: `${f.component}/${f.story}`,
        fix: f.pass ? undefined : f.fix,
      });
    }
  }

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
    id: `${id}:charters`,
    passed,
    total,
    ratio,
    grade: letter(ratio),
    findings,
    passes,
    byCategory,
  };
}
