/**
 * Accessibility audit — standalone Playwright + axe-core.
 *
 * Runs axe-core on the rendered component story. Independent of emdesign's a11y scorer.
 *
 * Usage: node benchmarks/scripts/a11y-check.mjs <component-name>
 * Output: JSON with { accessibility, a11yViolations }
 */

import { chromium } from 'playwright';

const STORYBOOK_URL = process.env.EMDESIGN_STORYBOOK_URL || 'http://localhost:6006';

function toStoryId(component, story = 'default') {
  const kebab = component.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return `generated-${kebab}--${story}`;
}

async function a11yCheck(component) {
  const storyId = toStoryId(component);
  const url = `${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForSelector('#storybook-root', { timeout: 10000 }).catch(() => {});

    // Inject axe-core
    await page.addScriptTag({
      path: require.resolve('axe-core'),
    }).catch(async () => {
      // Fallback: fetch from CDN
      await page.addScriptTag({
        url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js',
      });
    });

    const results = await page.evaluate(() => {
      return window.axe && window.axe.run ? window.axe.run(document.getElementById('storybook-root') || document.body) : null;
    });

    if (!results || !results.violations) {
      return { accessibility: 0.5, a11yViolations: [], note: 'axe-core not available' };
    }

    const violations = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact || 'minor',
      description: v.description,
      tags: v.tags,
    }));

    // Score: start at 1.0, subtract per violation by severity
    let score = 1.0;
    for (const v of results.violations) {
      switch (v.impact) {
        case 'critical': score -= 0.15; break;
        case 'serious': score -= 0.08; break;
        case 'moderate': score -= 0.04; break;
        default: score -= 0.02; break;
      }
    }
    score = Math.max(0, score);

    return { accessibility: Math.round(score * 100) / 100, a11yViolations: violations };
  } finally {
    await browser.close();
  }
}

const component = process.argv[2];
if (!component) {
  console.error('Usage: node a11y-check.mjs <component-name>');
  process.exit(1);
}

a11yCheck(component).then((r) => {
  console.log(JSON.stringify(r, null, 2));
});
