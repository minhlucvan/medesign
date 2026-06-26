/**
 * Visual check — standalone Playwright script.
 *
 * Opens each component story in an isolated iframe, screenshots it, and
 * optionally pixelmatch vs a reference screenshot.
 *
 * Independent of emdesign's test_component MCP — uses direct Storybook URL.
 *
 * Usage: node benchmarks/scripts/visual-check.mjs <component-name> [--reference <path>]
 * Output: JSON with { visual, status, changedPixels, screenshotPath }
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const STORYBOOK_URL = process.env.EMDESIGN_STORYBOOK_URL || 'http://localhost:6006';
const SCREENSHOTS_DIR = join(process.cwd(), 'bench-results', 'screenshots');

function toStoryId(component, story = 'default') {
  const kebab = component.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return `generated-${kebab}--${story}`;
}

async function visualCheck(component, referencePath) {
  const storyId = toStoryId(component);
  const url = `${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`;
  const slug = component.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const outDir = join(SCREENSHOTS_DIR, slug);

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const actualPath = join(outDir, 'actual.png');

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForSelector('#storybook-root', { timeout: 10000 }).catch(() => {});
    await page.locator('#storybook-root').screenshot({ path: actualPath }).catch(() => {
      // Fallback: full page screenshot if selector not found
      page.screenshot({ path: actualPath });
    });
  } finally {
    await browser.close();
  }

  // Reference comparison
  if (referencePath && existsSync(referencePath)) {
    const base = PNG.sync.read(readFileSync(referencePath));
    const cur = PNG.sync.read(readFileSync(actualPath));
    if (base.width !== cur.width || base.height !== cur.height) {
      return { visual: 0.5, status: 'changed', changedPixels: -1, screenshotPath: actualPath };
    }
    const diff = new PNG({ width: base.width, height: base.height });
    const changed = pixelmatch(base.data, cur.data, diff.data, base.width, base.height, { threshold: 0.1 });
    const diffPath = join(outDir, 'diff.png');
    writeFileSync(diffPath, PNG.sync.write(diff));
    return {
      visual: changed === 0 ? 1.0 : Math.max(0, 1.0 - changed / (base.width * base.height) * 10),
      status: changed === 0 ? 'pass' : 'changed',
      changedPixels: changed,
      screenshotPath: actualPath,
      diffPath,
    };
  }

  // No reference — return new
  return { visual: 1.0, status: 'no-reference', screenshotPath: actualPath };
}

const component = process.argv[2];
const refIdx = process.argv.indexOf('--reference');
const referencePath = refIdx !== -1 ? process.argv[refIdx + 1] : null;

if (!component) {
  console.error('Usage: node visual-check.mjs <component-name> [--reference <path>]');
  process.exit(1);
}

visualCheck(component, referencePath).then((r) => {
  console.log(JSON.stringify(r, null, 2));
});
