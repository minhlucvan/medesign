import fs from 'node:fs';
import path from 'node:path';
import type { VisionContext, CritiqueOptions } from '../types.js';
import type { VisionCritiqueResult } from '../types.js';

/**
 * Construct a VisionContext from component name + repo paths + options.
 * This is the bridge between the medesign backend paths and the vision providers.
 *
 * Reuses the same directory conventions as visualTest.ts and designContext.ts:
 * - Screenshots live in paths.screenshotsDir (default __screenshots__/)
 * - Design system is loaded from paths.designSystemsDir
 */

export interface VisionContextInput {
  /** Repository root path. */
  root: string;
  /** Screenshots directory path. */
  screenshotsDir: string;
  /** Design systems directory path. */
  designSystemsDir?: string;
  /** Optional: active design system id. */
  activeDsId?: string;
}

/**
 * Build VisionContext from component name and repo paths.
 * Loads the screenshot, optionally loads design system context + render snapshot + static findings.
 */
export function buildVisionContext(
  input: VisionContextInput,
  component: string,
  options: CritiqueOptions,
): VisionContext {
  const ctx: VisionContext = {
    component,
    screenshotPath: path.join(input.screenshotsDir, `${component}.actual.png`),
  };

  // Verify screenshot exists
  if (!fs.existsSync(ctx.screenshotPath)) {
    // Try .baseline.png as fallback
    const baseline = path.join(input.screenshotsDir, `${component}.baseline.png`);
    if (fs.existsSync(baseline)) {
      ctx.screenshotPath = baseline;
    }
  }

  // Load design system context if available
  if (input.designSystemsDir && input.activeDsId) {
    try {
      const dsDir = path.join(input.designSystemsDir, input.activeDsId);
      const designMd = readIfExists(path.join(dsDir, 'DESIGN.md'));
      const tokensCss = readIfExists(path.join(dsDir, 'tokens.css'));
      const dsParts: string[] = [];
      if (designMd) {
        // Only include first ~2k chars of DESIGN.md to stay within prompt limits.
        dsParts.push('=== DESIGN.md (excerpt) ===', designMd.slice(0, 2000));
      }
      if (tokensCss) {
        dsParts.push('=== tokens.css ===', tokensCss.slice(0, 1500));
      }
      if (dsParts.length > 0) ctx.designContext = dsParts.join('\n\n');
    } catch {
      // Design system context is optional — skip silently.
    }
  }

  // Load optional render snapshot
  if (options.renderSnapshotPath && fs.existsSync(options.renderSnapshotPath)) {
    try {
      ctx.renderSnapshot = fs.readFileSync(options.renderSnapshotPath, 'utf8');
    } catch { /* skip */ }
  } else {
    // Try default location next to screenshot
    const defaultRenderJson = path.join(input.screenshotsDir, `${component}.render.json`);
    if (fs.existsSync(defaultRenderJson)) {
      try {
        ctx.renderSnapshot = fs.readFileSync(defaultRenderJson, 'utf8');
      } catch { /* skip */ }
    }
  }

  // Load optional static findings
  if (options.staticFindingsPath && fs.existsSync(options.staticFindingsPath)) {
    try {
      ctx.staticFindings = fs.readFileSync(options.staticFindingsPath, 'utf8');
    } catch { /* skip */ }
  }

  return ctx;
}

function readIfExists(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

export function buildRegressionContext(
  input: VisionContextInput,
  component: string,
  options: CritiqueOptions,
  previousCritique: VisionCritiqueResult,
): VisionContext {
  const ctx = buildVisionContext(input, component, options);
  ctx.previousCritique = previousCritique;
  return ctx;
}
