import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, type RepoPaths } from '../paths.js';
import { computeComposite, decideRound, type RoleScores } from './scoreboard.js';

const DEFAULT_THRESHOLD = 0.8;

export interface ScoreInput {
  scores: RoleScores;
  /** Count of blocking issues (P0 lint, failed build, blocking a11y). */
  mustFix: number;
  threshold?: number;
  /** When set, applies the no-regression ratchet against this component's stored baseline. */
  component?: string;
}

export interface ScoreResult {
  composite: number;
  decision: 'ship' | 'continue';
  threshold: number;
  mustFix: number;
  baseline: number | null;
  ratchetPass: boolean;
}

/**
 * The single authoritative gate. Combines the four feedback sources into a composite,
 * applies the dual gate (`composite >= threshold && mustFix === 0`), and a per-component
 * no-regression ratchet (a passing component may only replace its baseline if it scores
 * at least as high). Mirrors open-design's critique semantics.
 */
export function scoreComponent(paths: RepoPaths, input: ScoreInput): ScoreResult {
  const threshold = input.threshold ?? DEFAULT_THRESHOLD;
  const composite = computeComposite(input.scores);
  const gate = decideRound(composite, input.mustFix, { scoreThreshold: threshold });

  let baseline: number | null = null;
  let ratchetPass = true;
  if (input.component) {
    baseline = readBaseline(paths, input.component);
    ratchetPass = baseline == null || composite >= baseline - 1e-9;
  }

  const decision: 'ship' | 'continue' = gate === 'ship' && ratchetPass ? 'ship' : 'continue';

  // On ship, ratchet the baseline upward (never down).
  if (decision === 'ship' && input.component && (baseline == null || composite > baseline)) {
    writeBaseline(paths, input.component, composite);
  }

  return { composite, decision, threshold, mustFix: input.mustFix, baseline, ratchetPass };
}

function baselineFile(paths: RepoPaths): string {
  return path.join(paths.medesignDir, 'baselines.json');
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
  ensureDir(paths.medesignDir);
  let all: Record<string, number> = {};
  try {
    all = JSON.parse(fs.readFileSync(baselineFile(paths), 'utf8'));
  } catch {
    /* first baseline */
  }
  all[component] = composite;
  fs.writeFileSync(baselineFile(paths), JSON.stringify(all, null, 2));
}
