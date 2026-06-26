/**
 * Benchmark report generation and comparison logic.
 *
 * Takes BenchmarkTestResult[] from a run, aggregates into a summary,
 * compares against a previous run, and generates markdown reports.
 */
import type {
  BenchmarkScore,
  BenchmarkTestResult,
  BenchmarkSummary,
  BenchmarkTotals,
  BenchmarkComparison,
  TestComparison,
  BenchmarkConfig,
} from './benchmark-types.js';
import { BLACK_BOX_WEIGHTS, WHITE_BOX_WEIGHTS, BENCHMARK_PASS_THRESHOLD, BLACK_BOX_MIN, WHITE_BOX_MIN } from './benchmark-types.js';

/** Compute black-box composite from individual scores. */
export function blackBoxComposite(scores: Pick<BenchmarkScore['blackBox'], 'general' | 'visual' | 'functional' | 'accessibility'>): number {
  const present = Object.keys(scores).filter((k) => typeof scores[k as keyof typeof scores] === 'number') as (keyof typeof scores)[];
  if (present.length === 0) return 0;
  const totalWeight = present.reduce((s, k) => s + BLACK_BOX_WEIGHTS[k as keyof typeof BLACK_BOX_WEIGHTS], 0);
  if (totalWeight === 0) return 0;
  return present.reduce((s, k) => s + (BLACK_BOX_WEIGHTS[k as keyof typeof BLACK_BOX_WEIGHTS] / totalWeight) * (scores[k] as number), 0);
}

/** Compute white-box composite from individual metrics. */
export function whiteBoxComposite(metrics: Pick<BenchmarkScore['whiteBox'], 'tokenCompliance' | 'typescript' | 'complexity' | 'patterns'>): number {
  const present = Object.keys(metrics).filter((k) => typeof metrics[k as keyof typeof metrics] === 'number') as (keyof typeof metrics)[];
  if (present.length === 0) return 0;
  const totalWeight = present.reduce((s, k) => s + WHITE_BOX_WEIGHTS[k as keyof typeof WHITE_BOX_WEIGHTS], 0);
  if (totalWeight === 0) return 0;
  return present.reduce((s, k) => s + (WHITE_BOX_WEIGHTS[k as keyof typeof WHITE_BOX_WEIGHTS] / totalWeight) * (metrics[k] as number), 0);
}

/** Determine if a single test passes. */
export function testPasses(result: BenchmarkTestResult): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (result.overall < BENCHMARK_PASS_THRESHOLD) reasons.push(`overall (${result.overall.toFixed(2)}) < ${BENCHMARK_PASS_THRESHOLD}`);
  if (result.blackBox.composite < BLACK_BOX_MIN) reasons.push(`black-box (${result.blackBox.composite.toFixed(2)}) < ${BLACK_BOX_MIN}`);
  if (result.whiteBox.composite < WHITE_BOX_MIN) reasons.push(`white-box (${result.whiteBox.composite.toFixed(2)}) < ${WHITE_BOX_MIN}`);
  return { pass: reasons.length === 0, reasons };
}

/** Determine overall score: 0.6 × blackBox + 0.4 × whiteBox. */
export function overallScore(blackBoxComposite: number, whiteBoxComposite: number): number {
  return 0.6 * blackBoxComposite + 0.4 * whiteBoxComposite;
}

/** Aggregate multiple test results into a summary. */
export function aggregateResults(tests: BenchmarkTestResult[], config: BenchmarkConfig): BenchmarkSummary {
  const passed = tests.filter((t) => t.pass);
  const totals: BenchmarkTotals = {
    testsPassed: passed.length,
    testsFailed: tests.length - passed.length,
    totalRounds: tests.reduce((s, t) => s + t.rounds, 0),
    totalDurationMs: tests.reduce((s, t) => s + t.durationMs, 0),
    avgComposite: tests.length ? tests.reduce((s, t) => s + t.overall, 0) / tests.length : 0,
    avgRounds: tests.length ? tests.reduce((s, t) => s + t.rounds, 0) / tests.length : 0,
    avgDurationMs: tests.length ? tests.reduce((s, t) => s + t.durationMs, 0) / tests.length : 0,
    avgBlackBox: tests.length ? tests.reduce((s, t) => s + t.blackBox.composite, 0) / tests.length : 0,
    avgWhiteBox: tests.length ? tests.reduce((s, t) => s + t.whiteBox.composite, 0) / tests.length : 0,
  };

  return {
    runId: config.runId,
    timestamp: config.timestamp,
    config,
    tests,
    totals,
    passRate: tests.length ? passed.length / tests.length : 0,
  };
}

/** Compare two benchmark runs. */
export function compareRuns(current: BenchmarkSummary, previous: BenchmarkSummary): BenchmarkComparison {
  const prevMap = new Map(previous.tests.map((t) => [t.name, t]));
  const tests: TestComparison[] = [];
  let regressed = 0;
  let improved = 0;

  for (const cur of current.tests) {
    const prev = prevMap.get(cur.name);
    if (!prev) continue; // new test, no comparison

    const deltas = {
      overall: cur.overall - prev.overall,
      blackBox: cur.blackBox.composite - prev.blackBox.composite,
      whiteBox: cur.whiteBox.composite - prev.whiteBox.composite,
      rounds: cur.rounds - prev.rounds,
      durationMs: cur.durationMs - prev.durationMs,
    };
    const isRegressed = deltas.overall < -0.02 || deltas.rounds > 2;
    if (isRegressed) regressed++;
    else if (deltas.overall > 0.02) improved++;

    tests.push({
      name: cur.name,
      complexity: cur.complexity,
      current: { overall: cur.overall, blackBox: cur.blackBox.composite, whiteBox: cur.whiteBox.composite, rounds: cur.rounds, durationMs: cur.durationMs },
      previous: { overall: prev.overall, blackBox: prev.blackBox.composite, whiteBox: prev.whiteBox.composite, rounds: prev.rounds, durationMs: prev.durationMs },
      deltas,
      regressed: isRegressed,
    });
  }

  // Trends
  const avgOverallDelta = tests.length ? tests.reduce((s, t) => s + t.deltas.overall, 0) / tests.length : 0;
  const avgRoundsDelta = tests.length ? tests.reduce((s, t) => s + t.deltas.rounds, 0) / tests.length : 0;
  const avgDurationDelta = tests.length ? tests.reduce((s, t) => s + t.deltas.durationMs, 0) / tests.length : 0;

  return {
    currentRunId: current.runId,
    previousRunId: previous.runId,
    tests,
    summary: {
      compositeTrend: avgOverallDelta > 0.01 ? 'up' : avgOverallDelta < -0.01 ? 'down' : 'stable',
      roundsTrend: avgRoundsDelta < -0.5 ? 'up' : avgRoundsDelta > 0.5 ? 'down' : 'stable',
      durationTrend: avgDurationDelta < -1000 ? 'up' : avgDurationDelta > 1000 ? 'down' : 'stable',
      regressedTests: regressed,
      improvedTests: improved,
    },
  };
}

/** Generate a human-readable markdown report from a benchmark summary. */
export function generateMarkdownReport(summary: BenchmarkSummary, comparison?: BenchmarkComparison): string {
  const lines: string[] = [];
  lines.push('# Benchmark Report');
  lines.push('');
  lines.push(`**Run:** ${summary.runId}`);
  lines.push(`**Date:** ${summary.timestamp}`);
  lines.push(`**Config:** ${summary.config.description}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Tests passed | ${summary.totals.testsPassed}/${summary.tests.length} (${(summary.passRate * 100).toFixed(0)}%) |`);
  lines.push(`| Avg overall score | ${summary.totals.avgComposite.toFixed(3)} |`);
  lines.push(`| Avg black-box | ${summary.totals.avgBlackBox.toFixed(3)} |`);
  lines.push(`| Avg white-box | ${summary.totals.avgWhiteBox.toFixed(3)} |`);
  lines.push(`| Avg rounds to done | ${summary.totals.avgRounds.toFixed(1)} |`);
  lines.push(`| Avg duration | ${(summary.totals.avgDurationMs / 1000 / 60).toFixed(1)}m |`);
  lines.push(`| Total duration | ${(summary.totals.totalDurationMs / 1000 / 60).toFixed(1)}m |`);
  lines.push('');

  // Per-test table
  lines.push('## Per-Test Results');
  lines.push('');
  lines.push('| Test | Complexity | Overall | Black-box | White-box | Rounds | Duration | Pass |');
  lines.push('|------|-----------|---------|-----------|-----------|--------|----------|------|');
  for (const t of summary.tests) {
    const status = t.pass ? '✅' : '❌';
    lines.push(`| ${t.name} | ${t.complexity} | ${t.overall.toFixed(3)} | ${t.blackBox.composite.toFixed(3)} | ${t.whiteBox.composite.toFixed(3)} | ${t.rounds} | ${(t.durationMs / 1000).toFixed(0)}s | ${status} |`);
  }
  lines.push('');

  // Failures detail
  const failures = summary.tests.filter((t) => !t.pass);
  if (failures.length > 0) {
    lines.push('## Failures');
    lines.push('');
    for (const f of failures) {
      lines.push(`### ${f.name}`);
      lines.push('');
      for (const r of f.reasons || []) {
        lines.push(`- ❌ ${r}`);
      }
      if (f.stoppedReason) lines.push(`- ⏹ Stopped: ${f.stoppedReason}`);
      lines.push('');

      // Black-box details
      lines.push('**Black-box breakdown:**');
      lines.push(`- General: ${f.blackBox.general.toFixed(3)}`);
      lines.push(`- Visual: ${f.blackBox.visual.toFixed(3)} (${f.blackBox.visualStatus || 'n/a'})`);
      lines.push(`- Functional: ${f.blackBox.functional.toFixed(3)}`);
      lines.push(`- Accessibility: ${f.blackBox.accessibility.toFixed(3)}`);
      lines.push(`- Composite: ${f.blackBox.composite.toFixed(3)}`);
      lines.push('');

      // White-box details
      lines.push('**White-box breakdown:**');
      lines.push(`- Token compliance: ${f.whiteBox.tokenCompliance.toFixed(3)} (${f.whiteBox.rawHexCount} raw hex, ${f.whiteBox.unresolvedVarCount} unresolved vars)`);
      lines.push(`- TypeScript: ${f.whiteBox.typescript.toFixed(3)} (${f.whiteBox.anyCount} any, ${f.whiteBox.tsIgnoreCount} @ts-ignore)`);
      lines.push(`- Complexity: ${f.whiteBox.complexity.toFixed(3)} (${f.whiteBox.linesOfCode} LOC, ${f.whiteBox.maxConditionalDepth} max conditional depth)`);
      lines.push(`- Patterns: ${f.whiteBox.patterns.toFixed(3)} (${f.whiteBox.patternViolations.length} violations)`);
      lines.push('');
    }
  }

  // Comparison
  if (comparison) {
    lines.push('## Comparison with Previous Run');
    lines.push('');
    lines.push(`**Previous run:** ${comparison.previousRunId}`);
    lines.push('');
    lines.push(`| Trend | Direction |`);
    lines.push(`|-------|-----------|`);
    const trendIcon = (t: string) => t === 'up' ? '↑' : t === 'down' ? '↓' : '→';
    lines.push(`| Composite | ${trendIcon(comparison.summary.compositeTrend)} ${comparison.summary.compositeTrend} |`);
    lines.push(`| Rounds | ${trendIcon(comparison.summary.roundsTrend)} ${comparison.summary.roundsTrend} |`);
    lines.push(`| Duration | ${trendIcon(comparison.summary.durationTrend)} ${comparison.summary.durationTrend} |`);
    lines.push(`| Regressed tests | ${comparison.summary.regressedTests} |`);
    lines.push(`| Improved tests | ${comparison.summary.improvedTests} |`);
    lines.push('');

    if (comparison.tests.some((t) => t.regressed)) {
      lines.push('### Regressions');
      lines.push('');
      lines.push('| Test | Overall Δ | Rounds Δ | Duration Δ |');
      lines.push('|------|-----------|----------|------------|');
      for (const t of comparison.tests.filter((tc) => tc.regressed)) {
        const od = t.deltas.overall > 0 ? `+${t.deltas.overall.toFixed(3)}` : t.deltas.overall.toFixed(3);
        const rd = t.deltas.rounds > 0 ? `+${t.deltas.rounds}` : `${t.deltas.rounds}`;
        const dd = t.deltas.durationMs > 0 ? `+${(t.deltas.durationMs / 1000).toFixed(0)}s` : `${(t.deltas.durationMs / 1000).toFixed(0)}s`;
        lines.push(`| ${t.name} | ${od} | ${rd} | ${dd} |`);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`*Generated by emdesign benchmark runner at ${new Date().toISOString()}*`);

  return lines.join('\n');
}
