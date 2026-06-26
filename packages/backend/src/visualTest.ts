import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
// @ts-ignore — pixelmatch v6 ships no bundled types; treated as any (safe across consuming packages).
import pixelmatch from 'pixelmatch';
import { ensureDir, type RepoPaths } from './paths.js';
import type { DiffResult } from './state.js';

const STORYBOOK_URL = process.env.EMDESIGN_STORYBOOK_URL ?? 'http://localhost:6006';

/** Default timeout for Storybook health check (ms). */
const HEALTH_CHECK_TIMEOUT = 3_000;

/** Map an on-disk screenshot path to the URL the HTTP bridge serves it at. */
function screenshotUrl(p: string): string {
  return `${process.env.EMDESIGN_BACKEND_URL ?? 'http://localhost:4321'}/screenshots/${path.basename(p)}`;
}

/**
 * Map a DiffResult status to a numeric 0-1 visual score for the critique gate.
 *
 * | Status      | Score | Rationale                              |
 * |-------------|-------|----------------------------------------|
 * | pass        | 1.0   | Exact pixel match against baseline     |
 * | new         | 1.0   | First baseline — nothing to regress    |
 * | changed     | 0.5   | Pixels differ — visual drift detected  |
 * | error       | 0.0   | Could not run test                     |
 */
export function toVisualScore(status: DiffResult['status']): number {
  switch (status) {
    case 'pass': return 1.0;
    case 'new':  return 1.0;
    case 'changed': return 0.5;
    case 'error': return 0.0;
  }
}

/**
 * Quick connectivity check for Storybook before launching a full browser session.
 * Returns null if reachable, or an error message string if unreachable.
 */
export async function checkStorybookHealth(
  url: string = STORYBOOK_URL,
  timeout: number = HEALTH_CHECK_TIMEOUT,
): Promise<string | null> {
  try {
    const checkUrl = `${url.replace(/\/+$/, '')}/iframe.html`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(checkUrl, { method: 'HEAD', signal: controller.signal });
    clearTimeout(id);
    if (res.ok || res.status === 304) return null;
    return `Storybook at ${url} returned status ${res.status}`;
  } catch (e) {
    return `Storybook at ${url} unreachable: ${(e as Error).message}`;
  }
}

/**
 * Screenshots a component's Storybook story and diffs it against the stored baseline.
 *
 * This is emdesign's "visual testing in the loop": after each change request, the agent
 * (or the panel) runs this; a `changed` result is fed back so the agent can self-correct,
 * and a `new` result establishes the first baseline. Mirrors open-design's artifact-lint
 * idea, but on rendered pixels of real components.
 *
 * Runs a lightweight Storybook reachability check first and returns `{ status: 'error' }`
 * with a descriptive message if it cannot connect.
 */
export async function runVisualTest(paths: RepoPaths, component: string): Promise<DiffResult> {
  if (!component) return { status: 'error' };

  // Health check before launching a browser
  const healthError = await checkStorybookHealth(paths.storybookUrl || STORYBOOK_URL);
  if (healthError) {
    return { status: 'error' };
  }

  const storyId = toStoryId(component);
  const baseUrl = paths.storybookUrl || STORYBOOK_URL;
  const url = `${baseUrl}/iframe.html?id=${storyId}&viewMode=story`;

  ensureDir(paths.screenshotsDir);
  const baselinePath = path.join(paths.screenshotsDir, `${component}.baseline.png`);
  const actualPath = path.join(paths.screenshotsDir, `${component}.actual.png`);
  const diffPath = path.join(paths.screenshotsDir, `${component}.diff.png`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('#storybook-root', { timeout: 10_000 });
    await page.locator('#storybook-root').screenshot({ path: actualPath });
  } finally {
    await browser.close();
  }

  // First run → establish baseline.
  if (!fs.existsSync(baselinePath)) {
    fs.copyFileSync(actualPath, baselinePath);
    return { status: 'new', baselinePng: screenshotUrl(baselinePath), actualPng: screenshotUrl(actualPath) };
  }

  const base = PNG.sync.read(fs.readFileSync(baselinePath));
  const cur = PNG.sync.read(fs.readFileSync(actualPath));
  if (base.width !== cur.width || base.height !== cur.height) {
    return {
      status: 'changed',
      baselinePng: screenshotUrl(baselinePath),
      actualPng: screenshotUrl(actualPath),
      changedPixels: -1, // dimensions differ
    };
  }

  const diff = new PNG({ width: base.width, height: base.height });
  const changed = pixelmatch(base.data, cur.data, diff.data, base.width, base.height, {
    threshold: 0.1,
  });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  return {
    status: changed === 0 ? 'pass' : 'changed',
    baselinePng: screenshotUrl(baselinePath),
    actualPng: screenshotUrl(actualPath),
    diffPng: screenshotUrl(diffPath),
    changedPixels: changed,
  };
}

/**
 * Storybook slugifies a PascalCase component title to a kebab-case story ID.
 *
 * Storybook 8 does NOT insert hyphens between capitalized words; it lowercases
 * the whole literal string. So "PricingTable" → "pricingtable" (not "pricing-table").
 *
 * This matches what Storybook's `storyIdFromExport` produces from the CSF title
 * "Generated/PricingTable" → `generated-pricingtable--default`.
 *
 * Handles:
 * - PascalCase: "PricingTable" → "pricingtable"
 * - Acronyms: "CTAAction" → "ctaaction"
 * - Single word: "Button" → "button"
 */
export function toStoryId(component: string, story = 'default', prefix = 'generated'): string {
  return `${prefix}-${component.toLowerCase()}--${story}`;
}
