/**
 * @emdesign/backend — render probe.
 *
 * Captures a Storybook story's live DOM + computed styles + element geometry via Playwright's
 * `page.evaluate`, producing a `RenderSnapshot` (to be consumed by `plugin-core`'s rendered
 * doctor rules for overlap/contrast/spacing/tap-target analysis, and by framework-level
 * geometry charters for overlap/overflow detection).
 *
 * Reuses the same Playwright harness + `toStoryId` + screenshot path conventions as `visualTest.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import type { RepoPaths } from './paths.js';
import { ensureDir } from './paths.js';
import { toStoryId } from './visualTest.js';
import type { RenderNode } from '@emdesign/dsr';

const STORYBOOK_URL = process.env.EMDESIGN_STORYBOOK_URL ?? 'http://localhost:6006';

/**
 * Build a self-contained page.evaluate function for DOM probing.
 *
 * Uses a string-based approach (new Function) to avoid TypeScript compilation
 * artifacts (like __name helpers) that break when Playwright serializes the
 * function to the browser context.
 */
const PROBE_FN_SRC = `function probe() {
  var cssPath = function(el, root) {
    var parts = [];
    var cur = el;
    while (cur && cur !== root && cur.nodeType === 1) {
      var sel = cur.tagName.toLowerCase();
      var parent = cur.parentElement;
      if (parent) {
        var sibs = Array.from(parent.children).filter(function(c) { return c.tagName === cur.tagName; });
        if (sibs.length > 1) sel += ':nth-of-type(' + (sibs.indexOf(cur) + 1) + ')';
      }
      parts.unshift(sel);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  };
  var root = document.getElementById('storybook-root');
  if (!root) return { root: { x: 0, y: 0, width: 0, height: 0 }, nodes: [] };
  var rootRect = root.getBoundingClientRect();
  var nodes = [];
  var all = root.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    var style = window.getComputedStyle(el);
    if (style.display === 'none') continue;
    nodes.push({
      selector: cssPath(el, root),
      tag: el.tagName.toLowerCase(),
      classes: typeof el.className === 'string' ? el.className : '',
      text: (el.textContent || '').trim().slice(0, 120),
      box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      styles: {
        color: style.color,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        marginTop: style.marginTop,
        marginRight: style.marginRight,
        marginBottom: style.marginBottom,
        marginLeft: style.marginLeft,
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        gap: style.gap,
        display: style.display,
        position: style.position,
        zIndex: style.zIndex,
        overflow: style.overflow
      },
      parentSelector: el.parentElement && el.parentElement !== root ? cssPath(el.parentElement, root) : undefined
    });
  }
  return { root: { x: rootRect.x, y: rootRect.y, width: rootRect.width, height: rootRect.height }, nodes: nodes };
}`;

/**
 * Capture a render snapshot for a component story.
 * Optionally captures both light and dark themes.
 */
export interface RenderSnapshotOptions {
  /** Themes to capture. Defaults to ['light']. */
  themes?: ('light' | 'dark')[];
  /** Story name (defaults to 'default'). */
  story?: string;
  /** Viewport width (defaults to 1280). */
  viewportWidth?: number;
  /** Viewport height (defaults to 720). */
  viewportHeight?: number;
}

export interface RenderSnapshotOutput {
  component: string;
  storyId: string;
  url: string;
  theme: 'light' | 'dark';
  viewport: { width: number; height: number; deviceScaleFactor: number };
  root: { x: number; y: number; width: number; height: number };
  nodes: RenderNode[];
}

/**
 * Render-probe: launch Playwright, navigate to the component's Storybook story, extract DOM
 * snapshot via page.evaluate, optionally toggle theme and re-capture. Persists the snapshot(s)
 * to paths.screenshotsDir as `<component>.render.json`.
 *
 * Returns the array of snapshots (one per theme).
 */
export async function renderSnapshot(
  paths: RepoPaths,
  component: string,
  opts: RenderSnapshotOptions = {},
): Promise<RenderSnapshotOutput[]> {
  if (!component) return [];
  const { themes = ['light'], story = 'default', viewportWidth = 1280, viewportHeight = 720 } = opts;
  const storyId = toStoryId(component, story);
  const baseUrl = paths.storybookUrl || STORYBOOK_URL;
  const url = `${baseUrl}/iframe.html?id=${storyId}&viewMode=story`;

  ensureDir(paths.screenshotsDir);
  const browser = await chromium.launch({ headless: true });
  const snapshots: RenderSnapshotOutput[] = [];

  try {
    const page = await browser.newPage({ viewport: { width: viewportWidth, height: viewportHeight }, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('#storybook-root', { timeout: 10_000 });
    // Small pause to let async rendering settle
    await page.waitForTimeout(300);

    for (const theme of themes) {
      if (theme === 'dark') {
        // Set the data-theme attribute on the document element
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
        }, 'dark');
        // Wait for any CSS transitions/repaints
        await page.waitForTimeout(300);
      } else {
        await page.evaluate(() => {
          document.documentElement.removeAttribute('data-theme');
        });
        await page.waitForTimeout(100);
      }

      const probeFn = new Function(PROBE_FN_SRC + '; return probe();') as () => { root: { x: number; y: number; width: number; height: number }; nodes: RenderNode[] };
      const result = await page.evaluate(probeFn) as { root: { x: number; y: number; width: number; height: number }; nodes: RenderNode[] };

      snapshots.push({
        component,
        storyId,
        url,
        theme,
        viewport: { width: viewportWidth, height: viewportHeight, deviceScaleFactor: 2 },
        root: result.root,
        nodes: result.nodes,
      });
    }
  } finally {
    await browser.close();
  }

  // Persist the composite render.json (array of snapshots, one per theme)
  const renderPath = path.join(paths.screenshotsDir, `${component}.render.json`);
  fs.writeFileSync(renderPath, JSON.stringify(snapshots, null, 2));

  return snapshots;
}
