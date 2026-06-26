import { describe, expect, it } from 'vitest';
import { tokenScore, countMustFix, renderFindingsForAgent } from './index.js';
import type { Finding } from './index.js';

const p0: Finding = { severity: 'P0', id: 'off-token-color', message: 'Raw hex used' };
const p1: Finding = { severity: 'P1', id: 'external-image', message: 'External image host' };
const p2: Finding = { severity: 'P2', id: 'unconventional-spacing', message: 'Unconventional spacing value' };

describe('tokenScore', () => {
  it('returns 1.0 for no findings', () => {
    expect(tokenScore([])).toBe(1.0);
  });

  it('penalizes P0 findings heavily', () => {
    const score = tokenScore([p0]);
    expect(score).toBeCloseTo(0.66, 2);
  });

  it('penalizes P1 findings moderately', () => {
    const score = tokenScore([p1]);
    expect(score).toBeCloseTo(0.88, 2);
  });

  it('penalizes P2 findings lightly', () => {
    const score = tokenScore([p2]);
    expect(score).toBeCloseTo(0.96, 2);
  });

  it('accumulates multiple findings', () => {
    const score = tokenScore([p0, p0, p1, p2]);
    // 1 - (0.34 + 0.34 + 0.12 + 0.04) = 1 - 0.84 = 0.16
    expect(score).toBeCloseTo(0.16, 2);
  });

  it('clamps to 0 (never negative)', () => {
    const manyP0 = Array.from({ length: 10 }, () => p0);
    const score = tokenScore(manyP0);
    expect(score).toBe(0);
  });

  it('returns 0 for many severe findings', () => {
    const score = tokenScore([p0, p0, p0, p0]);
    // 1 - 4*0.34 = 1 - 1.36 = clamped to 0
    expect(score).toBe(0);
  });
});

describe('countMustFix', () => {
  it('counts P0 findings only', () => {
    expect(countMustFix([p0])).toBe(1);
    expect(countMustFix([p1])).toBe(0);
    expect(countMustFix([p2])).toBe(0);
    expect(countMustFix([p0, p0, p1, p2])).toBe(2);
  });

  it('returns 0 for empty array', () => {
    expect(countMustFix([])).toBe(0);
  });
});

describe('renderFindingsForAgent', () => {
  it('returns PASS message for no findings', () => {
    expect(renderFindingsForAgent([])).toContain('PASS');
  });

  it('includes P0 count in output', () => {
    const output = renderFindingsForAgent([p0, p1]);
    expect(output).toContain('1 blocking');
    expect(output).toContain('off-token-color');
  });

  it('sorts findings by severity', () => {
    const output = renderFindingsForAgent([p1, p0, p2]);
    const p0Pos = output.indexOf(p0.id);
    const p1Pos = output.indexOf(p1.id);
    expect(p0Pos).toBeLessThan(p1Pos); // P0 should come before P1
  });
});
