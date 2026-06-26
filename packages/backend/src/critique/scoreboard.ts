/**
 * Per-component quality gate — adapted from open-design's critique/scoreboard.ts (Apache-2.0).
 *
 * emdesign replaces open-design's LLM panelists with DETERMINISTIC scorers (visual diff,
 * consistency lint, a11y). The gate semantics are identical and load-bearing:
 *   ships only if `composite >= threshold` AND `mustFix === 0`.
 * A great average score can never override a single blocking issue.
 */

// The feedback sources reduce to these scorer keys. `tokens` = programmatic/rule (lint +
// token contract); `visual` = pixel regression; `vision` = screenshot critique; `llm` =
// design-reviewer code/spec critique; `a11y` = accessibility. Human feedback enters as
// change-requests, not a scorer.
export type ScorerKey = 'visual' | 'tokens' | 'vision' | 'llm' | 'a11y';

export type RoleScores = Partial<Record<ScorerKey, number>>;

export interface RoundState {
  n: number;
  scores: RoleScores;
  mustFix: number;
  composite: number;
}

export const DEFAULT_WEIGHTS: Record<ScorerKey, number> = {
  tokens: 0.3,
  visual: 0.25,
  vision: 0.25,
  llm: 0.15,
  a11y: 0.05,
};

/**
 * Weighted mean over PRESENT scorers only, with weights redistributed proportionally so an
 * absent scorer doesn't drag the score to zero.
 */
export function computeComposite(scores: RoleScores, weights: Record<ScorerKey, number> = DEFAULT_WEIGHTS): number {
  const present = (Object.keys(scores) as ScorerKey[]).filter((k) => typeof scores[k] === 'number');
  if (present.length === 0) return 0;
  const totalWeight = present.reduce((s, r) => s + weights[r], 0);
  if (totalWeight === 0) return 0;
  return present.reduce((s, r) => s + (weights[r] / totalWeight) * (scores[r] as number), 0);
}

export interface DecideConfig {
  scoreThreshold: number; // 0..1
}

export type Verdict = 'ship' | 'revise';

/** The ship gate. Returns 'ship' only when BOTH composite >= threshold AND mustFix === 0.
 *  'revise' is unambiguous — blocking issues or below-threshold quality. */
export function decideRound(composite: number, mustFix: number, cfg: DecideConfig): Verdict {
  if (mustFix > 0) return 'revise';                           // blocking issues → hard stop, must fix
  if (composite < cfg.scoreThreshold - 1e-9) return 'revise'; // below threshold → must improve
  return 'ship';                                               // both pass → ready to ship
}

export type FallbackPolicy = 'fail' | 'ship_last' | 'ship_best';

/** When no clean ship arrived, recover by policy (best = highest composite, tie → highest round). */
export function selectFallbackRound(rounds: RoundState[], policy: FallbackPolicy): RoundState | null {
  if (rounds.length === 0 || policy === 'fail') return null;
  if (policy === 'ship_last') return rounds[rounds.length - 1];
  return rounds.reduce((best, r) => (r.composite > best.composite || (r.composite === best.composite && r.n > best.n) ? r : best));
}
