/**
 * Charter lint — evaluate story-level and framework-level charters for the doctor pipeline.
 *
 * Two entry points:
 *  - lintCharters(results)       — story-level charter results (from StoryCharterRunner)
 *  - lintFrameworkCharters(...)  — framework-level ElementCharters run against render snapshots
 *
 * Both produce a DoctorReport with the `charter` category, mergeable via mergeReports().
 */

import type { Severity, ElementCharter, EcDomNode, EcFinding, RenderSnapshot } from '@emdesign/dsr';
import { buildDomTree, querySelectorAll, loadFrameworkCharters } from '@emdesign/dsr';
import type { DoctorFinding, DoctorReport } from './lint.js';
import type { StoryCharterResult } from '@emdesign/dsr';

const RANK: Record<Severity, number> = { P0: 0, P1: 1, P2: 2 };

function letter(r: number): string {
  return r >= 0.9 ? 'A' : r >= 0.8 ? 'B' : r >= 0.7 ? 'C' : r >= 0.6 ? 'D' : 'F';
}

function reportFromFindings(id: string, all: DoctorFinding[]): DoctorReport {
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
    id,
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

  return reportFromFindings(`${id}:charters`, all);
}

/**
 * Evaluate framework-level charters (geometry, spacing, etc.) against render snapshots.
 *
 * Framework charters ship with the engine and apply to ALL design systems and components.
 * They use the `ElementCharter` interface (same as DS-level charters) but are registered
 * automatically — they do not need to be loaded from a design system's charters/ directory.
 *
 * @param id — Report identifier (typically the design system id)
 * @param renders — Render snapshots to evaluate against
 * @param extraCharters — Optional additional framework charters beyond the built-in set
 * @returns DoctorReport with `charter` category, mergeable into GradeReport
 */
export function lintFrameworkCharters(
  id: string,
  renders: RenderSnapshot[],
  extraCharters?: ElementCharter[],
): DoctorReport {
  const all: DoctorFinding[] = [];

  // Load built-in framework charters + any extras
  const charters = [...loadFrameworkCharters(), ...(extraCharters ?? [])];
  if (charters.length === 0) {
    return {
      id: `${id}:framework-charters`,
      passed: 0,
      total: 0,
      ratio: 1,
      grade: 'A',
      findings: [],
      passes: [],
      byCategory: {},
    };
  }

  // Group charters by DOM-selector matcher type; skip graph-layer charters
  const domCharters = charters.filter(
    (c) => c.matcher.type === 'dom-selector' || c.matcher.type === 'dom-relation',
  );
  if (domCharters.length === 0) {
    return {
      id: `${id}:framework-charters`,
      passed: 0,
      total: 0,
      ratio: 1,
      grade: 'A',
      findings: [],
      passes: [],
      byCategory: {},
    };
  }

  for (const snap of renders) {
    // Build the DOM tree from the flat RenderNode array
    const roots = buildDomTree(snap);

    for (const charter of domCharters) {
      // Determine the matched elements based on matcher type
      let matchedElements: EcDomNode[] = [];

      if (charter.matcher.type === 'dom-selector') {
        matchedElements = querySelectorAll(charter.matcher.selector, roots);
      } else if (charter.matcher.type === 'dom-relation') {
        // For relation matchers, query the base then traverse
        const baseElements = querySelectorAll(charter.matcher.selector, roots);
        for (const el of baseElements) {
          switch (charter.matcher.relation) {
            case 'parent':
              if (el.parent && !matchedElements.includes(el.parent)) matchedElements.push(el.parent);
              break;
            case 'children':
              for (const child of el.children) {
                if (!matchedElements.includes(child)) matchedElements.push(child);
              }
              break;
            case 'siblings':
              for (const sib of el.siblings) {
                if (!matchedElements.includes(sib)) matchedElements.push(sib);
              }
              break;
            case 'ancestors': {
              let cur = el.parent;
              while (cur) {
                if (!matchedElements.includes(cur)) matchedElements.push(cur);
                cur = cur.parent;
              }
              break;
            }
          }
        }
      }

      // Build minimal context for the charter runner
      const ctx = {
        layer: 'dom' as const,
        graph: { nodes: () => [], edges: () => [], /* stub */ } as any,
        renders: [snap],
        matchedElements,
      };

      try {
        const findings: EcFinding[] = charter.run(ctx);

        for (const f of findings) {
          all.push({
            ruleId: f.id,
            category: 'charter',
            title: f.message,
            severity: f.severity,
            pass: false, // EcFinding[] only contains failures
            detail: f.message,
            target: f.target ?? snap.component,
            fix: f.remediation,
          });
        }

        // If no findings, it's a pass
        if (findings.length === 0) {
          all.push({
            ruleId: `framework/${charter.name}`,
            category: 'charter',
            title: `${charter.name}: pass`,
            severity: 'P2',
            pass: true,
            detail: `${charter.name}: no violations found in ${snap.component}/${snap.storyId}`,
            target: `${snap.component}`,
          });
        }
      } catch {
        // Charter threw unexpectedly — report as a finding rather than crashing
        all.push({
          ruleId: `framework/${charter.name}`,
          category: 'charter',
          title: `${charter.name}: evaluation error`,
          severity: 'P2',
          pass: false,
          detail: `${charter.name}: charter run() threw for ${snap.component}/${snap.storyId}`,
          target: snap.component,
          fix: 'Check the charter implementation for errors or edge cases.',
        });
      }
    }
  }

  return reportFromFindings(`${id}:framework-charters`, all);
}
