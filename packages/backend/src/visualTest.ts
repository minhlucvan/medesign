import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
// @ts-ignore — pixelmatch v6 ships no bundled types; treated as any (safe across consuming packages).
import pixelmatch from 'pixelmatch';
import { ensureDir, type RepoPaths } from './paths.js';
import type { DiffResult } from './state.js';

const STORYBOOK_URL = process.env.EMDESIGN_STORYBOOK_URL ?? 'http://localhost:6006';

/** Map an on-disk screenshot path to the URL the HTTP bridge serves it at. */
function screenshotUrl(p: string): string {
  return `${process.env.EMDESIGN_BACKEND_URL ?? 'http://localhost:4321'}/screenshots/${path.basename(p)}`;
}

/**
 * Screenshots a component's Storybook story and diffs it against the stored baseline.
 *
 * This is emdesign's "visual testing in the loop": after each change request, the agent
 * (or the panel) runs this; a `changed` result is fed back so the agent can self-correct,
 * and a `new` result establishes the first baseline. Mirrors open-design's artifact-lint
 * idea, but on rendered pixels of real components.
 */
export async function runVisualTest(paths: RepoPaths, component: string): Promise<DiffResult> {
  if (!component) return { status: 'error' };
  const storyId = toStoryId(component);
  const url = `${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`;

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

/** Storybook slugifies "Generated/PricingTiers" → "generated-pricingtiers--default". */
export function toStoryId(component: string, story = 'default', prefix = 'generated'): string {
  const kebab = component
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
  return `${prefix}-${kebab}--${story}`;
}
