import fs from 'node:fs';
import path from 'node:path';
import type { RepoPaths, Store } from '@emdesign/backend';
import { effectiveAdapter, toStoryId, resolveStoryId, ensureDir } from '@emdesign/backend';
import { formatJson, formatError } from '../lib/format.js';
import { chromium } from 'playwright';

export interface A11yArgs {
  component: string;
  story?: string;
  theme?: 'light' | 'dark';
  json?: boolean;
}

/**
 * Deep a11y audit using axe-core via Playwright.
 * Emdesign V2 §4 Phase 1: component a11y.
 */
export async function cmdA11y(args: A11yArgs, paths: RepoPaths): Promise<void> {
  const { component, story = 'default', theme = 'light' } = args;
  if (!component) {
    formatError('usage: component a11y <component> [--story <name>] [--theme light|dark]');
    process.exit(1);
  }

  const baseUrl = paths.storybookUrl || process.env.EMDESIGN_STORYBOOK_URL || 'http://localhost:6006';
  const storyId = (await resolveStoryId(component, story, baseUrl)) ?? toStoryId(component, story);
  const url = `${baseUrl}/iframe.html?id=${storyId}&viewMode=story`;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('#storybook-root', { timeout: 15_000 });
    if (theme === 'dark') {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.waitForTimeout(300);
    }

    // Inject axe-core from node_modules
    const axePath = require.resolve('axe-core');
    const axeSource = fs.readFileSync(axePath, 'utf8');
    await page.evaluate(axeSource);

    const violations = await page.evaluate(() => {
      return (window as any).axe?.run?.().then((results: any) => results.violations) ?? [];
    });

    const summary = {
      component,
      story,
      theme,
      url,
      violations: violations.map((v: any) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        tags: v.tags,
        nodes: v.nodes.slice(0, 5).map((n: any) => ({
          html: n.html.slice(0, 200),
          target: n.target,
          failureSummary: n.failureSummary?.slice(0, 300),
        })),
      })),
      summary: {
        totalViolations: violations.length,
        byImpact: {
          critical: violations.filter((v: any) => v.impact === 'critical').length,
          serious: violations.filter((v: any) => v.impact === 'serious').length,
          moderate: violations.filter((v: any) => v.impact === 'moderate').length,
          minor: violations.filter((v: any) => v.impact === 'minor').length,
        },
      },
    };

    if (args.json) {
      formatJson(summary);
    } else {
      process.stdout.write(`═══ A11y Audit: ${component} ═══\n`);
      process.stdout.write(`Violations: ${summary.summary.totalViolations} (critical: ${summary.summary.byImpact.critical}, serious: ${summary.summary.byImpact.serious}, moderate: ${summary.summary.byImpact.moderate}, minor: ${summary.summary.byImpact.minor})\n`);
      for (const v of summary.violations) {
        process.stdout.write(`  [${v.impact}] ${v.id}: ${v.help}\n`);
        for (const n of v.nodes.slice(0, 3)) {
          process.stdout.write(`    → ${n.target?.join(', ') ?? n.html?.slice(0, 100)}\n`);
        }
      }
      process.stdout.write(`═══════════════════════════════════\n`);
    }
  } finally {
    await browser.close();
  }
}

/** Component test generation. */
export async function cmdComponentTest(args: { component: string; json?: boolean }, paths: RepoPaths): Promise<void> {
  const { component } = args;
  if (!component) { formatError('usage: component test <component>'); process.exit(1); }

  const adapter = effectiveAdapter(paths);
  const srcPath = path.join(paths.generatedDir, `${component}${adapter.fileExt}`);
  if (!fs.existsSync(srcPath)) {
    formatError(`Component file not found: ${srcPath}`);
    process.exit(1);
  }

  const src = fs.readFileSync(srcPath, 'utf8');
  const propMatch = src.match(/interface\s+(\w+Props)\s*{([^}]+)}/);
  const props = propMatch ? propMatch[2].split('\n').map(l => l.trim()).filter(Boolean) : [];

  const test = `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ${component} } from './${component}';

describe('${component}', () => {
  it('renders without crashing', () => {
    const { container } = render(<${component} />);
    expect(container).toBeDefined();
  });

  it('has the correct display name', () => {
    expect(${component}.displayName ?? '${component}').toBe('${component}');
  });
${props.length > 0 ? `
  it('accepts custom className', () => {
    const { container } = render(<${component} className="custom-test" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('custom-test');
  });` : ''}
});
`;

  const testDir = path.join(paths.generatedDir, '__tests__');
  ensureDir(testDir);
  const testFile = path.join(testDir, `${component}.test.tsx`);
  fs.writeFileSync(testFile, test);

  if (args.json) {
    formatJson({ component, testFile, props: props.length });
  } else {
    process.stderr.write(`Test generated: ${testFile}\n`);
  }
}

/** Component diff — compare component version across generated/captured directories. */
export async function cmdComponentDiff(args: { component: string; json?: boolean }, paths: RepoPaths): Promise<void> {
  const { component } = args;
  if (!component) { formatError('usage: component diff <component>'); process.exit(1); }

  const adapter = effectiveAdapter(paths);
  const generated = path.join(paths.generatedDir, `${component}${adapter.fileExt}`);
  const captured = path.join(paths.componentsDir, component, `${component}${adapter.fileExt}`);

  const generatedSrc = fs.existsSync(generated) ? fs.readFileSync(generated, 'utf8') : null;
  const capturedSrc = fs.existsSync(captured) ? fs.readFileSync(captured, 'utf8') : null;

  if (!generatedSrc && !capturedSrc) {
    formatError(`Component ${component} not found in generated or captured directories.`);
    process.exit(1);
  }

  const result = {
    component,
    generated: { exists: !!generatedSrc, size: generatedSrc?.length ?? 0 },
    captured: { exists: !!capturedSrc, size: capturedSrc?.length ?? 0 },
    sameContent: generatedSrc === capturedSrc,
  };

  if (args.json) {
    formatJson(result);
  } else {
    process.stdout.write(`Component diff: ${component}\n`);
    process.stdout.write(`  Generated: ${result.generated.exists ? `${result.generated.size} bytes` : 'not found'}\n`);
    process.stdout.write(`  Captured: ${result.captured.exists ? `${result.captured.size} bytes` : 'not found'}\n`);
    process.stdout.write(`  ${result.sameContent ? '✅ Identical' : '⚠️ Different content'}\n`);
  }
}
