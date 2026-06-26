import { describe, expect, it } from 'vitest';
import { computeComposite, decideRound, selectFallbackRound, DEFAULT_WEIGHTS } from './scoreboard.js';
import type { RoundState } from './scoreboard.js';

describe('computeComposite', () => {
  it('returns 0 for empty scores', () => {
    expect(computeComposite({})).toBe(0);
  });

  it('returns the score directly for a single scorer', () => {
    expect(computeComposite({ visual: 0.8 })).toBe(0.8);
    expect(computeComposite({ tokens: 0.5 })).toBe(0.5);
  });

  it('computes weighted mean for multiple scores', () => {
    // tokens: 0.3, visual: 0.25 → total 0.55, redistributed: tokens 0.3/0.55=0.545, visual 0.25/0.55=0.455
    // composite = 1.0 * 0.545 + 0.5 * 0.455 = 0.545 + 0.227 = 0.773
    const result = computeComposite({ tokens: 1.0, visual: 0.5 });
    expect(result).toBeCloseTo(0.773, 2);
  });

  it('ignores absent scores, redistributing weights proportionally', () => {
    // Three scorers present: tokens(0.3), visual(0.25), vision(0.25) = total 0.8
    // tokens: 0.3/0.8=0.375, visual: 0.25/0.8=0.3125, vision: 0.25/0.8=0.3125
    // composite = 1.0*0.375 + 0.5*0.3125 + 0.2*0.3125 = 0.375 + 0.156 + 0.0625 = 0.59375
    const result = computeComposite({ tokens: 1.0, visual: 0.5, vision: 0.2 });
    expect(result).toBeCloseTo(0.594, 3);
  });

  it('handles high and low extremes', () => {
    expect(computeComposite({ tokens: 1, visual: 1, vision: 1, llm: 1, a11y: 1 })).toBeCloseTo(1.0, 3);
    expect(computeComposite({ tokens: 0, visual: 0, vision: 0 })).toBeCloseTo(0, 3);
  });

  it('handles partial scores with custom weights', () => {
    const weights = { tokens: 0.5, visual: 0.5, vision: 0, llm: 0, a11y: 0 };
    expect(computeComposite({ tokens: 0.8 }, weights)).toBe(0.8);
    expect(computeComposite({ tokens: 0.8, visual: 0.4 }, weights)).toBeCloseTo(0.6, 3);
  });
});

describe('decideRound', () => {
  const cfg = { scoreThreshold: 0.8 };

  it('returns ship when composite >= threshold and no blocking issues', () => {
    expect(decideRound(0.9, 0, cfg)).toBe('ship');
    expect(decideRound(0.8, 0, cfg)).toBe('ship');
  });

  it('returns revise when mustFix > 0 regardless of composite', () => {
    expect(decideRound(0.9, 1, cfg)).toBe('revise');
    expect(decideRound(1.0, 5, cfg)).toBe('revise');
  });

  it('returns revise when composite < threshold', () => {
    expect(decideRound(0.7, 0, cfg)).toBe('revise');
    expect(decideRound(0.0, 0, cfg)).toBe('revise');
  });

  it('dual gate: high composite cannot override mustFix', () => {
    // This is the critical invariant from the architecture docs
    const scores = { tokens: 0.95, visual: 1.0, vision: 0.95, llm: 0.9 };
    const composite = computeComposite(scores);
    expect(composite).toBeGreaterThan(0.8);
    expect(decideRound(composite, 1, cfg)).toBe('revise');
  });

  it('returns revise on exact boundary edge case', () => {
    // Just below threshold due to floating point
    expect(decideRound(0.7999999, 0, cfg)).toBe('revise');
    expect(decideRound(0.8000001, 0, cfg)).toBe('ship');
  });
});

describe('selectFallbackRound', () => {
  const makeRound = (n: number, composite: number): RoundState => ({
    n, scores: { visual: composite }, mustFix: 0, composite,
  });

  it('returns null for empty rounds', () => {
    expect(selectFallbackRound([], 'fail')).toBeNull();
  });

  it('returns null for fail policy', () => {
    const rounds = [makeRound(1, 0.5)];
    expect(selectFallbackRound(rounds, 'fail')).toBeNull();
  });

  it('returns last round for ship_last policy', () => {
    const rounds = [makeRound(1, 0.5), makeRound(2, 0.7), makeRound(3, 0.6)];
    const result = selectFallbackRound(rounds, 'ship_last');
    expect(result?.n).toBe(3);
    expect(result?.composite).toBe(0.6);
  });

  it('returns round with highest composite for ship_best policy', () => {
    const rounds = [makeRound(1, 0.5), makeRound(2, 0.9), makeRound(3, 0.7)];
    const result = selectFallbackRound(rounds, 'ship_best');
    expect(result?.n).toBe(2);
    expect(result?.composite).toBe(0.9);
  });

  it('ties broken by highest round number', () => {
    const rounds = [makeRound(1, 0.8), makeRound(2, 0.8)];
    const result = selectFallbackRound(rounds, 'ship_best');
    expect(result?.n).toBe(2);
  });
});
