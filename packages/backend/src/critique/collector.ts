/**
 * ScoreCollector — automated score collection for the critique gate.
 *
 * Instead of the agent calling 3-4 separate MCP tools and manually constructing a
 * `RoleScores` object, the ScoreCollector runs all deterministic checks in one call
 * and returns pre-populated scores ready for `scoreComponent`.
 *
 * The agent still supplies `mustFix` (from lint P0 count) and `component` (for ratchet
 * tracking). Vision and LLM scores are optional — they're expensive and require API keys.
 */

import type { RepoPaths } from '../paths.js';
import type { RoleScores } from './scoreboard.js';
import { tokenScore, lintComponent, type LintOptions, type Finding } from '../lint/index.js';
import { runVisualTest, toVisualScore, checkStorybookHealth } from '../visualTest.js';
import { readConfig } from '../paths.js';

export interface CollectOptions {
  /** Component name (PascalCase) to test and lint. */
  component: string;

  /** Generated component source code for linting. If omitted, lint is skipped. */
  source?: string;

  /** Lint options (declared tokens, exemptions, display face binding). */
  lintOpts?: LintOptions;

  /** Whether to run the visual test. Default: true. */
  runVisual?: boolean;

  /** Whether to check Storybook health before visual test. Default: true. */
  healthCheck?: boolean;
}

export interface CollectResult {
  /** Automatically collected scores (may be partial). */
  scores: RoleScores;
  /** Lint findings (if source was provided). */
  findings: Finding[];
  /** Number of blocking (P0) findings. */
  mustFix: number;
  /** Visual test status, if run. */
  visualStatus?: string;
  /** Any errors encountered during collection (non-fatal — partial scores are still usable). */
  errors: string[];
}

/**
 * Collect all deterministic scores for a component in one call.
 *
 * Runs the lint (if `source` provided) and the visual test (if `runVisual` is true, the
 * default). Returns pre-populated scores that the agent can pass directly to
 * `evaluate_component` (or that `evaluate_component` can call internally).
 *
 * Vision and LLM scores are intentionally NOT collected here — they require
 * external API keys and are best handled as separate, explicit agent steps.
 */
export async function collectScores(
  paths: RepoPaths,
  opts: CollectOptions,
): Promise<CollectResult> {
  const errors: string[] = [];
  const scores: RoleScores = {};
  let findings: Finding[] = [];
  let mustFix = 0;

  // ── 1. Lint ──────────────────────────────────────────────────────
  if (opts.source) {
    findings = lintComponent(opts.source, opts.lintOpts);
    mustFix = findings.filter((f) => f.severity === 'P0').length;
    scores.tokens = tokenScore(findings);
  }

  // ── 2. Visual test ───────────────────────────────────────────────
  if (opts.runVisual !== false) {
    try {
      // Quick health check before launching a browser
      if (opts.healthCheck !== false) {
        const healthError = await checkStorybookHealth(
          paths.storybookUrl || process.env.EMDESIGN_STORYBOOK_URL || 'http://localhost:6006',
        );
        if (healthError) {
          errors.push(`Storybook health check failed (${healthError}) — visual score set to 0`);
          scores.visual = 0;
        }
      }

      if (scores.visual === undefined) {
        const diff = await runVisualTest(paths, opts.component);
        scores.visual = toVisualScore(diff.status);
        if (diff.status === 'error') {
          errors.push(`Visual test returned error — visual score set to 0`);
        }
      }
    } catch (e) {
      errors.push(`Visual test threw: ${(e as Error).message}`);
      scores.visual = 0;
    }
  }

  return { scores, findings, mustFix, errors };
}
