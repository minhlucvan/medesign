/**
 * Smoke test — calls the real Minimax vision API.
 * Skips automatically if ANTHROPIC_AUTH_TOKEN is not set.
 */
import { describe, it, expect } from 'vitest';
import { minimaxProvider } from '../src/providers/minimax.js';
import { claudeProvider } from '../src/providers/claude.js';
import { standardCritique } from '../src/critique/standard.js';
import { registerVisionProvider } from '../src/registry.js';
import { minimalPngBuffer } from './helpers.js';
import fs from 'node:fs';
import path from 'node:path';

const HAS_MINIMAX = !!(process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const HAS_CLAUDE = !!process.env.ANTHROPIC_API_KEY;
const REAL_SCREENSHOT = '/Users/minh/Documents/medesign/examples/landing-site/__screenshots__/Hero.actual.png';

describe.skipIf(!HAS_MINIMAX && !HAS_CLAUDE)('smoke', () => {
  it('minimax provider works with a real screenshot', async () => {
    if (!fs.existsSync(REAL_SCREENSHOT)) {
      console.log('No real screenshot found, skipping');
      return;
    }
    const img = fs.readFileSync(REAL_SCREENSHOT);

    const result = await minimaxProvider.critique(img, 'image/png', {
      component: 'Hero',
      screenshotPath: REAL_SCREENSHOT,
      designContext: 'A clean, modern design system with dark theme, sans-serif typography, and lime-green accent.',
    });

    expect(result.provider).toBe('minimax');
    expect(typeof result.visionScore).toBe('number');
    expect(result.visionScore).toBeGreaterThanOrEqual(0);
    expect(result.visionScore).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.findings)).toBe(true);
    console.log(`\nVision score: ${result.visionScore}`);
    console.log(`Findings: ${result.findings.length}`);
  }, 30_000);

  it('standardCritique returns valid output via minimax', async () => {
    if (!fs.existsSync(REAL_SCREENSHOT)) return;

    const tmpDir = '/tmp/vision-critic-test';
    fs.mkdirSync(tmpDir, { recursive: true });
    const imgPath = path.join(tmpDir, 'Hero.actual.png');
    fs.copyFileSync(REAL_SCREENSHOT, imgPath);

    const result = await standardCritique(
      {
        root: '/tmp',
        screenshotsDir: tmpDir,
      },
      { component: 'Hero', provider: 'minimax' },
    );

    expect(result.component).toBe('Hero');
    expect(result.provider).toBe('minimax');
    expect(typeof result.visionScore).toBe('number');
    expect(typeof result.mustFix).toBe('number');
    expect(Array.isArray(result.findings)).toBe(true);
    console.log(`\nstandardCritique visionScore: ${result.visionScore}`);
    console.log(`mustFix: ${result.mustFix}`);
    console.log(`findings: ${result.findings.length}`);

    fs.rmSync(imgPath, { force: true });
  }, 30_000);
});

describe('provider detection', () => {
  it('minimax is available when ANTHROPIC_AUTH_TOKEN is set', () => {
    if (HAS_MINIMAX) {
      expect(minimaxProvider.available()).toBe(true);
    }
  });
});
