import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, type RepoPaths } from '../paths.js';
import { computeComposite, decideRound, type RoleScores, type Verdict } from './scoreboard.js';

const DEFAULT_THRESHOLD = 0.8;

export const DEFAULT_SOURCE_FLOORS: Record<string, number> = {
  vision: 0.7,
  llm: 0.7,
  tokens: 0.8,
  visual: 0.85,
  a11y: 0.8,
};

export interface ScoreInput {
  scores: RoleScores;
  /** Count of blocking issues (P0 lint, failed build, blocking a11y). */
  mustFix: number;
  threshold?: number;
  /** Per-source minimum floors. A score below its floor is an unsatisfied condition. */
  sourceFloors?: Record<string, number>;
  /** When set, applies the no-regression ratchet against this component's stored baseline. */
  component?: string;
}

export interface ScoreResult {
  composite: number;
  decision: Verdict;
  threshold: number;
  mustFix: number;
  perScore: Record<string, number | undefined>;
  unsatisfiedConditions: string[];
  baseline: number | null;
  ratchetPass: boolean;
}

/**
 * The single authoritative gate. Combines the five feedback sources into a composite,
 * checks per-source minimum floors, applies the dual gate (`composite >= threshold &&
 * mustFix === 0`), and a per-component no-regression ratchet.
 *
 * Returns an `unsatisfiedConditions` array listing every condition that failed so the
 * caller knows *exactly* what to fix — not just a single score.
 */
export function scoreComponent(paths: RepoPaths, input: ScoreInput): ScoreResult {
  const threshold = input.threshold ?? DEFAULT_THRESHOLD;
  const floors = input.sourceFloors ?? DEFAULT_SOURCE_FLOORS;

  const composite = computeComposite(input.scores);

  // Build unsatisfied-conditions list
  const unsatisfiedConditions: string[] = [];

  // 1. mustFix check
  if (input.mustFix > 0) {
    unsatisfiedConditions.push(`mustFix (${input.mustFix}) > 0 — blocking P0 issues must be resolved`);
  }

  // 2. Per-source floor check
  for (const [key, score] of Object.entries(input.scores)) {
    const floor = floors[key];
    if (floor !== undefined && typeof score === 'number' && score < floor - 1e-9) {
      unsatisfiedConditions.push(`${key} (${score.toFixed(2)}) below floor (${floor})`);
    }
  }

  // 3. Composite check
  if (composite < threshold - 1e-9) {
    unsatisfiedConditions.push(`composite (${composite.toFixed(3)}) below threshold (${threshold})`);
  }

  // 4. Ratchet check
  let baseline: number | null = null;
  let ratchetPass = true;
  if (input.component) {
    baseline = readBaseline(paths, input.component);
    ratchetPass = baseline == null || composite >= baseline - 1e-9;
    if (!ratchetPass) {
      unsatisfiedConditions.push(`composite (${composite.toFixed(3)}) below stored baseline (${baseline}) — regression`);
    }
  }

  // Decide: ship only when ALL conditions pass
  const allPass = unsatisfiedConditions.length === 0;
  const decision: Verdict = allPass ? 'ship' : 'revise';

  // On ship, ratchet the baseline upward (never down).
  if (decision === 'ship' && input.component && (baseline == null || composite > baseline)) {
    writeBaseline(paths, input.component, composite);
  }

  return {
    composite,
    decision,
    threshold,
    mustFix: input.mustFix,
    perScore: Object.fromEntries(
      (Object.keys(input.scores) as (keyof typeof input.scores)[]).map((k) => [k, input.scores[k]]),
    ),
    unsatisfiedConditions,
    baseline,
    ratchetPass,
  };
}

function baselineFile(paths: RepoPaths): string {
  return path.join(paths.emdesignDir, 'baselines.json');
}

function readBaseline(paths: RepoPaths, component: string): number | null {
  try {
    const all = JSON.parse(fs.readFileSync(baselineFile(paths), 'utf8')) as Record<string, number>;
    return all[component] ?? null;
  } catch {
    return null;
  }
}

function writeBaseline(paths: RepoPaths, component: string, composite: number): void {
  ensureDir(paths.emdesignDir);
  let all: Record<string, number> = {};
  try {
    all = JSON.parse(fs.readFileSync(baselineFile(paths), 'utf8'));
  } catch {
    /* first baseline */
  }
  all[component] = composite;
  fs.writeFileSync(baselineFile(paths), JSON.stringify(all, null, 2));
}
