/**
 * Functional verification — standalone Playwright script.
 *
 * Opens each story variant, checks for console errors, interacts with elements,
 * and reports pass/fail per state.
 *
 * Independent of emdesign's test_component MCP.
 *
 * Usage: node benchmarks/scripts/functional-check.mjs <component-name>
 * Output: JSON with { functional, functionalStates }
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const STORYBOOK_URL = process.env.EMDESIGN_STORYBOOK_URL || 'http://localhost:6006';

function toStoryId(component, story = 'default') {
  const kebab = component.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return `generated-${kebab}--${story}`;
}

const STATE_VARIANTS = ['default', 'hover', 'active', 'disabled', 'empty'];

async function functionalCheck(component) {
  const browser = await chromium.launch();
  const states = [];
  let allPass = true;

  try {
    for (const variant of STATE_VARIANTS) {
      const storyId = toStoryId(component, variant);
      const url = `${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`;
      const errors = [];

      const page = await browser.newPage({ deviceScaleFactor: 2 });

      // Capture console errors
      page.on('pageerror', (err) => errors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
        await page.waitForSelector('#storybook-root', { timeout: 5000 }).catch(() => {});
        const root = page.locator('#storybook-root');
        const exists = await root.count() > 0;
        if (!exists) errors.push('#storybook-root not found');
      } catch (e) {
        errors.push(e.message);
      }

      // Try clicking the first interactive element
      try {
        const firstButton = page.locator('button, a, [role="button"], input, select').first();
        if (await firstButton.count() > 0) {
          await firstButton.click({ timeout: 2000 }).catch(() => {});
        }
      } catch {
        // Non-interactive component — fine
      }

      const pass = errors.length === 0;
      if (!pass) allPass = false;
      states.push({ name: variant, pass, errors: errors.length > 0 ? errors : undefined });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  return {
    functional: allPass ? 1.0 : Math.max(0, states.filter((s) => s.pass).length / states.length),
    functionalStates: states,
  };
}

const component = process.argv[2];
if (!component) {
  console.error('Usage: node functional-check.mjs <component-name>');
  process.exit(1);
}

functionalCheck(component).then((r) => {
  console.log(JSON.stringify(r, null, 2));
});
