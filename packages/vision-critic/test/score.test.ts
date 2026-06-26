import { describe, it, expect } from 'vitest';
import { computeVisionScore, countP0Findings, sortFindings, VISION_AXIS_WEIGHTS } from '../src/score.js';
import type { VisionFinding } from '../src/types.js';

describe('VISION_AXIS_WEIGHTS', () => {
  it('sums to 1.0', () => {
    const total = Object.values(VISION_AXIS_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1.0);
  });
});

describe('computeVisionScore', () => {
  it('returns 0 for empty axes', () => {
    expect(computeVisionScore({})).toBe(0);
  });

  it('computes weighted mean for all 5 axes', () => {
    const score = computeVisionScore({
      hierarchy: 1.0,
      balance: 1.0,
      spacingRhythm: 1.0,
      onBrand: 1.0,
      polish: 1.0,
    });
    expect(score).toBeCloseTo(1.0);
  });

  it('redistributes weights when axes are missing', () => {
    const score = computeVisionScore({ hierarchy: 1.0 });
    expect(score).toBeCloseTo(1.0);
  });

  it('clamps values to 0..1', () => {
    const score = computeVisionScore({
      hierarchy: 2.0,
      balance: -0.5,
      spacingRhythm: 0.5,
      onBrand: 1.5,
      polish: 0.0,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('countP0Findings', () => {
  it('counts only P0 findings', () => {
    const findings: VisionFinding[] = [
      { severity: 'P0', region: 'a', issue: 'x', fix: 'y' },
      { severity: 'P1', region: 'b', issue: 'x', fix: 'y' },
      { severity: 'P0', region: 'c', issue: 'x', fix: 'y' },
      { severity: 'P2', region: 'd', issue: 'x', fix: 'y' },
    ];
    expect(countP0Findings(findings)).toBe(2);
  });

  it('returns 0 for empty list', () => {
    expect(countP0Findings([])).toBe(0);
  });
});

describe('sortFindings', () => {
  it('sorts P0 first, then P1, then P2', () => {
    const findings: VisionFinding[] = [
      { severity: 'P2', region: 'z', issue: 'x', fix: 'y' },
      { severity: 'P0', region: 'a', issue: 'x', fix: 'y' },
      { severity: 'P1', region: 'b', issue: 'x', fix: 'y' },
    ];
    const sorted = sortFindings(findings);
    expect(sorted[0].severity).toBe('P0');
    expect(sorted[1].severity).toBe('P1');
    expect(sorted[2].severity).toBe('P2');
  });
});
