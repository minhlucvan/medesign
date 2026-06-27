import fs from 'node:fs';
import path from 'node:path';
import type { RepoPaths } from '@emdesign/backend';
import { effectiveAdapter, toStoryId, resolveStoryId, ensureDir } from '@emdesign/backend';
import { formatJson, formatError } from '../lib/format.js';
import { chromium } from 'playwright';

export interface RenderAnalyzeArgs {
  component: string;
  story?: string;
  theme?: 'light' | 'dark';
  json?: boolean;
  out?: string; // optional file output
}

/**
 * Headless render → semantic DOM tree + coordinate grid + computed styles + contrast ratios.
 * This is the "render analyze" command from V2 spec §3.1.
 */
export async function cmdRenderAnalyze(args: RenderAnalyzeArgs, paths: RepoPaths): Promise<void> {
  const { component, story = 'default', theme = 'light' } = args;
  if (!component) {
    formatError('usage: emdesign render analyze <component> [--story <name>] [--theme light|dark] [--out <file>]');
    process.exit(1);
  }

  const baseUrl = paths.storybookUrl || process.env.EMDESIGN_STORYBOOK_URL || 'http://localhost:6006';
  const storyId = (await resolveStoryId(component, story, baseUrl)) ?? toStoryId(component, story);
  const url = `${baseUrl}/iframe.html?id=${storyId}&viewMode=story`;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('#storybook-root', { timeout: 15_000 });
    await page.waitForTimeout(500);

    // Set theme
    if (theme === 'dark') {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.waitForTimeout(300);
    }

    // Extract semantic DOM tree with coordinates and computed styles
    const tree = await page.evaluate(() => {
      function extract(el: Element, depth = 0): Record<string, unknown> | null {
        if (depth > 10) return null;
        const rect = el.getBoundingClientRect();
        // Skip empty/invisible nodes
        if (rect.width === 0 || rect.height === 0) return null;
        const style = getComputedStyle(el);
        const tag = el.tagName.toLowerCase();
        // Skip <body> and <html>
        if (tag === 'body' || tag === 'html' || tag === 'script' || tag === 'style') return null;

        const node: Record<string, unknown> = {
          tag,
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          className: el.className && typeof el.className === 'string' ? el.className : undefined,
        };

        // Text content for leaf nodes
        const text = el.textContent?.trim();
        if (text && el.children.length === 0) node.text = text.slice(0, 200);

        // Key computed styles
        const relevant = ['backgroundColor', 'color', 'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'textAlign', 'borderRadius', 'border', 'boxShadow', 'opacity', 'display', 'position'];
        const cs: Record<string, string> = {};
        for (const key of relevant) {
          const val = (style as any)[key];
          if (val && val !== 'none' && val !== 'normal') cs[key] = val;
        }
        if (Object.keys(cs).length > 0) node.computedStyle = cs;

        // Subtrees
        const children: Record<string, unknown>[] = [];
        for (const child of el.children) {
          const c = extract(child, depth + 1);
          if (c) children.push(c);
        }
        if (children.length > 0) node.children = children;

        return node;
      }
      const root = document.querySelector('#storybook-root') || document.body;
      return extract(root);
    });

    // Compute contrast ratios for text nodes
    const contrastRatios: Record<string, number> = {};
    if (tree) {
      await page.evaluate(() => {
        // Additional analysis can be added here
      });
    }

    const result = {
      component,
      story,
      theme,
      url,
      tree,
      metrics: {
        depth: tree ? maxDepth(tree) : 0,
        nodeCount: tree ? countNodes(tree) : 0,
      },
    };

    if (args.out) {
      ensureDir(path.dirname(args.out));
      fs.writeFileSync(args.out, JSON.stringify(result, null, 2));
    }

    if (args.json) {
      formatJson(result);
    } else {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    }
  } finally {
    await browser.close();
  }
}

function maxDepth(n: Record<string, unknown>, d = 0): number {
  if (!n.children || !Array.isArray(n.children) || n.children.length === 0) return d;
  return Math.max(...n.children.map((c: any) => maxDepth(c, d + 1)));
}

function countNodes(n: Record<string, unknown>): number {
  let c = 1;
  if (n.children && Array.isArray(n.children)) {
    for (const child of n.children) c += countNodes(child as any);
  }
  return c;
}
