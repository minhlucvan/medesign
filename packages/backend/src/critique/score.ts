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
 * Baseline data stored per component. Tracks composite and all per-source scores so the
 * ratchet can enforce non-regression on every dimension independently.
 */
interface ComponentBaseline {
  composite: number;
  perSource: Partial<Record<string, number>>;
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

  // 4. Ratchet check — composite AND per-source non-regression
  let baseline: number | null = null;
  let ratchetPass = true;
  if (input.component) {
    const bl = readBaselineFull(paths, input.component);
    baseline = bl?.composite ?? null;

    // Composite ratchet
    if (bl !== null) {
      if (composite < bl.composite - 1e-9) {
        ratchetPass = false;
        unsatisfiedConditions.push(`composite (${composite.toFixed(3)}) below stored baseline (${bl.composite}) — regression`);
      }
      // Per-source ratchet — each source must be >= its stored baseline
      for (const [key, rawScore] of Object.entries(bl.perSource)) {
        const baseScore = rawScore as number | undefined;
        if (baseScore === undefined) continue;
        const current = input.scores[key as keyof RoleScores];
        if (current !== undefined && current < baseScore - 1e-9) {
          if (ratchetPass) { // only add the first per-source regression msg if composite already passed
            unsatisfiedConditions.push(`per-source regression: ${key} (${current.toFixed(2)}) below baseline (${baseScore})`);
          }
          ratchetPass = false;
        }
      }
    }
  }

  // Decide: ship only when ALL conditions pass
  const allPass = unsatisfiedConditions.length === 0;
  const decision: Verdict = allPass ? 'ship' : 'revise';

  // On ship, ratchet the baseline upward (never down) — both composite and per-source.
  if (decision === 'ship' && input.component) {
    writeBaselineFull(paths, input.component, composite, input.scores);
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

/** Read full baseline data (composite + per-source) for a component. */
function readBaselineFull(paths: RepoPaths, component: string): ComponentBaseline | null {
  try {
    const all = JSON.parse(fs.readFileSync(baselineFile(paths), 'utf8')) as Record<string, ComponentBaseline | number>;
    const entry = all[component];
    if (entry === undefined) return null;
    // Backward compat: old format stored just a number (composite only)
    if (typeof entry === 'number') return { composite: entry, perSource: {} };
    return entry as ComponentBaseline;
  } catch {
    return null;
  }
}

/** Write full baseline data (composite + per-source) for a component, only if new composite >= stored. */
function writeBaselineFull(paths: RepoPaths, component: string, composite: number, scores: RoleScores): void {
  ensureDir(paths.emdesignDir);
  let all: Record<string, ComponentBaseline | number> = {};
  try {
    all = JSON.parse(fs.readFileSync(baselineFile(paths), 'utf8'));
  } catch {
    /* first baseline */
  }

  const existing = all[component];
  const existingComposite = typeof existing === 'number' ? existing : (existing as ComponentBaseline | undefined)?.composite ?? -1;

  // Only ratchet upward
  if (composite >= existingComposite - 1e-9) {
    const perSource: Partial<Record<string, number>> = {};
    for (const [key, val] of Object.entries(scores)) {
      if (typeof val === 'number') perSource[key] = val;
    }

    // Merge: keep existing per-source scores that are still >= current (don't regress individual scores)
    if (typeof existing === 'object') {
      for (const [key, rawVal] of Object.entries((existing as ComponentBaseline).perSource)) {
        const existingVal = rawVal as number | undefined;
        if (existingVal === undefined) continue;
        const currentVal = perSource[key];
        if (currentVal === undefined || currentVal < existingVal) {
          perSource[key] = existingVal;
        }
      }
    }

    all[component] = { composite, perSource };
    fs.writeFileSync(baselineFile(paths), JSON.stringify(all, null, 2));
  }
}
