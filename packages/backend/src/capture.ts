import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { ensureDir, type RepoPaths } from './paths.js';
import { effectiveAdapter } from './adapters/index.js';
import { toStoryId } from './visualTest.js';

const pexecFile = promisify(execFile);

const STORYBOOK_URL = process.env.EMDESIGN_STORYBOOK_URL ?? 'http://localhost:6006';

/**
 * Promotes a generated (work-in-progress) component into a reusable, documented component.
 *
 * Phase 0: moves `src/generated/<Name>.tsx` + `<Name>.stories.tsx` into `src/components/`,
 * prepends a doc header, and `git add`s the result. This is the "reusable-by-default capture"
 * pillar — generated UI becomes a real, versioned component, never a one-off snippet.
 */
export async function captureComponent(paths: RepoPaths, name: string): Promise<string> {
  const safe = sanitize(name);
  const a = effectiveAdapter(paths);
  const fromComp = path.join(paths.generatedDir, `${safe}${a.fileExt}`);
  const fromStory = path.join(paths.generatedDir, `${safe}${a.storyExt}`);
  if (!fs.existsSync(fromComp)) {
    throw new Error(`No generated component at ${fromComp}. Generate it first.`);
  }

  const destDir = path.join(paths.componentsDir, safe);
  ensureDir(destDir);

  const header =
    `/**\n * ${safe} — captured by emdesign.\n * Reusable, design-system-bound component. Edit freely; re-capture to update.\n */\n`;
  const compSrc = fs.readFileSync(fromComp, 'utf8');
  fs.writeFileSync(path.join(destDir, `${safe}${a.fileExt}`), header + compSrc);

  if (fs.existsSync(fromStory)) {
    fs.writeFileSync(path.join(destDir, `${safe}${a.storyExt}`), fs.readFileSync(fromStory, 'utf8'));
  }

  // Best-effort git add (repo may not be initialized yet in Phase 0).
  try {
    await pexecFile('git', ['add', destDir], { cwd: paths.root });
  } catch {
    /* not a git repo yet — capture still succeeded on disk */
  }

  return destDir;
}

function sanitize(name: string): string {
  const base = name.replace(/[^A-Za-z0-9]/g, '');
  if (!base) throw new Error(`Invalid component name: ${name}`);
  return base[0].toUpperCase() + base.slice(1);
}

export interface CaptureWithBaselineResult {
  componentDir: string;
  baselinePath: string;
}

/**
 * Promotes a generated component into a reusable, documented component AND seeds its visual
 * baseline in a single atomic step. This ensures every captured component has a baseline
 * screenshot for future visual regression detection.
 */
export async function captureWithBaseline(paths: RepoPaths, name: string): Promise<CaptureWithBaselineResult> {
  // Phase 1: promote generated → components/
  const componentDir = await captureComponent(paths, name);

  // Phase 2: seed visual baseline from the captured story
  const safe = sanitize(name);
  const a = effectiveAdapter(paths);
  const storyFile = path.join(componentDir, `${safe}${a.storyExt}`);

  if (fs.existsSync(storyFile)) {
    ensureDir(paths.screenshotsDir);
    const baselinePath = path.join(paths.screenshotsDir, `${safe}.baseline.png`);

    // After capture, the story title prefix is "components" (from src/components/<Name>/)
    const storyId = toStoryId(safe, 'default', 'components');
    const url = `${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`;

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ deviceScaleFactor: 2 });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForSelector('#storybook-root', { timeout: 10_000 });
      await page.locator('#storybook-root').screenshot({ path: baselinePath });
    } finally {
      await browser.close();
    }
    return { componentDir, baselinePath };
  }

  // No story file — return what we have
  return { componentDir, baselinePath: '' };
}
