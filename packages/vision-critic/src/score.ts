import type { VisionAxes, VisionFinding } from './types.js';

/**
 * Default weights for computing the overall vision score from axes.
 * Hierarchy and polish are weighted higher per the critic instructions.
 */
export const VISION_AXIS_WEIGHTS: Record<keyof VisionAxes, number> = {
  hierarchy: 0.25,
  balance: 0.20,
  spacingRhythm: 0.20,
  onBrand: 0.15,
  polish: 0.20,
};

/**
 * Compute the overall vision score (0..1) from per-axis scores.
 * Only present axes contribute; weights are redistributed proportionally
 * (mirrors scoreboard.ts computeComposite logic).
 */
export function computeVisionScore(axes: Partial<VisionAxes>): number {
  const keys = Object.keys(axes) as (keyof VisionAxes)[];
  if (keys.length === 0) return 0;

  const totalWeight = keys.reduce((s, k) => s + (VISION_AXIS_WEIGHTS[k] ?? 0), 0);
  if (totalWeight === 0) return 0;

  return keys.reduce((s, k) => {
    const v = axes[k];
    return s + ((VISION_AXIS_WEIGHTS[k] ?? 0) / totalWeight) * (v ?? 0);
  }, 0);
}

/**
 * Count P0 findings from a findings list.
 * This feeds directly into the critique gate's mustFix counter.
 */
export function countP0Findings(findings: VisionFinding[]): number {
  return findings.filter((f) => f.severity === 'P0').length;
}

/** Map severity string to numeric rank for sorting. */
export function severityRank(s: string): number {
  switch (s) {
    case 'P0': return 0;
    case 'P1': return 1;
    case 'P2': return 2;
    default: return 3;
  }
}

/** Sort findings by severity (P0 first), then by region name. */
export function sortFindings(findings: VisionFinding[]): VisionFinding[] {
  return [...findings].sort((a, b) => {
    const r = severityRank(a.severity) - severityRank(b.severity);
    if (r !== 0) return r;
    return a.region.localeCompare(b.region);
  });
}
