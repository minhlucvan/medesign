/**
 * End-to-end ds import project verification (with/without DESIGN.md, loop-readiness)
 * — unit 07 of the ds-from-existing-project change.
 *
 * These tests exercise the full pipeline end-to-end via `importProjectDesign`,
 * which drives the workflow in-process through scan → extract → synthesize →
 * tokens → primitives → adopt → graph → validate. Unlike the per-capability unit
 * tests (extract.test.ts, adopt.test.ts, workflow-from-project.test.ts, etc.),
 * this file validates the complete user-facing outcome:
 *
 *   1. Against a project with NO DESIGN.md: a valid system is built, registered,
 *      and the report classifies every component.
 *   2. Against a project WITH a DESIGN.md: the canonical DESIGN.md is preserved,
 *      its token values win over extracted code values, and divergences are noted.
 *   3. A loop-ready adopted component genuinely passes the real consistency lint
 *      (countMustFix === 0, no off-token-color finding).
 *   4. An adopted component classified as needs-manual-fix genuinely has findings.
 *
 * All three paths use the persistent fixture at project/__fixtures__/sample-project
 * (for the no-DESIGN.md case) or the same fixture augmented with
 * __fixtures__/with-design-md/DESIGN.md (for the canonical-DESIGN.md case).
 *
 * See: tasks 8.1–8.4 / from-project-e2e.test.ts
 */
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { importProjectDesign, validateDesignSystem } from '../scaffold.js';
import { resolveRepoPaths, readConfig } from '../paths.js';
import { lintComponent, countMustFix } from '../lint/index.js';
import { parseDeclaredTokens } from '../designContext.js';
import type { AdoptionReport } from '../project/report.js';

// ---------------------------------------------------------------------------
// Fixture paths
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, '..', 'project', '__fixtures__');
const SAMPLE_PROJECT = path.join(FIXTURES, 'sample-project');
const WITH_DESIGN_MD_DIR = path.join(FIXTURES, 'with-design-md');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tmps: string[] = [];

/** A workspace with emdesign.config.json + a seeded `atelier` base. */
function makeWorkspace(): string {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-ws-'));
  tmps.push(ws);
  fs.writeFileSync(
    path.join(ws, 'emdesign.config.json'),
    JSON.stringify({
      framework: 'react-tailwind',
      storybookUrl: 'http://localhost:6006',
      generatedDir: 'src/generated',
      componentsDir: 'src/components',
      designSystemsDir: 'design-systems',
      screenshotsDir: '__screenshots__',
    }),
  );
  const atelierCode = path.join(ws, 'design-systems', 'atelier', 'code');
  fs.mkdirSync(atelierCode, { recursive: true });
  fs.writeFileSync(path.join(atelierCode, 'Button.tsx'), 'export const Button = () => null;\n');
  fs.writeFileSync(
    path.join(atelierCode, 'Button.stories.tsx'),
    "export default { title: 'Button' };\nexport const Default = {};\n",
  );
  return ws;
}

/** Deep-copy a directory tree. */
function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    if (fs.statSync(s).isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** Add the fixture DESIGN.md to a project directory. */
function addDesignMd(projectDir: string): void {
  fs.writeFileSync(
    path.join(projectDir, 'DESIGN.md'),
    fs.readFileSync(path.join(WITH_DESIGN_MD_DIR, 'DESIGN.md'), 'utf8'),
  );
}

afterEach(() => {
  for (const d of tmps.splice(0)) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('e2e: ds import project against a project with NO DESIGN.md', () => {
  it('produces a system that passes ds validate with a report classifying every component', async () => {
    const ws = makeWorkspace();
    const id = `e2e-no-md-${Date.now()}`;
    const paths = resolveRepoPaths(ws);

    const result = await importProjectDesign(paths, SAMPLE_PROJECT, { id });

    // Token contract validates.
    expect(result.ok).toBe(true);
    expect(validateDesignSystem(paths, id).ok).toBe(true);

    // Adoption report classifies every component.
    const report: AdoptionReport = result.report;
    expect(report.components.length).toBeGreaterThan(0);
    for (const c of report.components) {
      expect(['loop-ready', 'needs-manual-fix']).toContain(c.status);
    }

    // System registered in config and on disk.
    expect(readConfig(ws).activeDesignSystem).toBe(id);
    expect(fs.existsSync(path.join(paths.designSystemsDir, id, 'DESIGN.md'))).toBe(true);
    expect(fs.existsSync(path.join(paths.designSystemsDir, id, 'tokens.css'))).toBe(true);
    expect(fs.existsSync(path.join(paths.designSystemsDir, id, 'manifest.json'))).toBe(true);

    // Manifest source type is "project".
    const manifest = JSON.parse(
      fs.readFileSync(path.join(paths.designSystemsDir, id, 'manifest.json'), 'utf8'),
    );
    expect(manifest.source?.type).toBe('project');
  });
});

describe('e2e: ds import project against a project WITH a DESIGN.md', () => {
  it('preserves the canonical DESIGN.md, prefers its token values, and records divergences', async () => {
    const ws = makeWorkspace();
    const id = `e2e-with-md-${Date.now()}`;
    const paths = resolveRepoPaths(ws);

    // Copy the sample project and add the fixture DESIGN.md on top.
    const projWithMd = path.join(os.tmpdir(), `e2e-proj-withmd-${Date.now()}`);
    tmps.push(projWithMd);
    copyDirSync(SAMPLE_PROJECT, projWithMd);
    addDesignMd(projWithMd);

    const result = await importProjectDesign(paths, projWithMd, { id });

    // Design system validates.
    expect(result.ok).toBe(true);
    expect(validateDesignSystem(paths, id).ok).toBe(true);

    // DESIGN.md kept canonical — the frontmatter name from the fixture survives.
    const designMd = fs.readFileSync(path.join(paths.designSystemsDir, id, 'DESIGN.md'), 'utf8');
    expect(designMd).toContain('Existing Project DS');

    // DESIGN.md colour value (#aabbcc) is used in tokens.css, NOT the extracted
    // code value (#3b82f6 from the tailwind config / #2563eb from the CSS var).
    const tokens = fs.readFileSync(path.join(paths.designSystemsDir, id, 'tokens.css'), 'utf8');
    expect(tokens).toMatch(/--color-accent:\s*#aabbcc\b/);
    expect(tokens).not.toMatch(/--color-accent:\s*#3b82f6\b/);
    expect(tokens).not.toMatch(/--color-accent:\s*#2563eb\b/);

    // Divergence recorded in notes.
    expect(
      result.notes.some((n: string) => /color-accent/i.test(n) && /(diverg|override)/i.test(n)),
    ).toBe(true);

    // System registered.
    expect(readConfig(ws).activeDesignSystem).toBe(id);
  });
});

describe('e2e: loop-ready component passes the consistency lint', () => {
  it('a component classified loop-ready has countMustFix === 0 and no off-token-color finding', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);

    // Build a project with a component whose every Tailwind arbitrary-value hex
    // maps to exactly one high-confidence proposed role → fully rebound.
    const proj = path.join(os.tmpdir(), `e2e-proj-loop-${Date.now()}`);
    tmps.push(proj);
    fs.mkdirSync(proj, { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), JSON.stringify({ name: 'loop-ready-app' }));
    fs.writeFileSync(
      path.join(proj, 'tailwind.config.js'),
      `module.exports = { theme: { extend: { colors: {
        surface: '#0a0a0a',
        accent: '#3b82f6',
        border: '#1a1a1a',
        text: '#fafafa'
      } } } };
`,
    );
    const src = path.join(proj, 'src', 'components');
    fs.mkdirSync(src, { recursive: true });
    // Every utility hex here maps to a unique high-confidence role.
    // Each hex appears 3× in the component (+ 1 from the tailwind config) so
    // totalCount ≥ 3 with a single role → confidence 0.9 → adopt.ts rebinds
    // all of them → loop-ready.
    fs.writeFileSync(
      path.join(src, 'TokenAware.tsx'),
      [
        'export function TokenAware() {',
        '  return (',
        '    <div>',
        '      <span className="bg-[#0a0a0a] text-[#3b82f6]">a</span>',
        '      <span className="bg-[#0a0a0a] text-[#3b82f6]">b</span>',
        '      <span className="bg-[#0a0a0a] text-[#3b82f6]">c</span>',
        '    </div>',
        '  );',
        '}',
        '',
      ].join('\n'),
    );

    const id = `e2e-loop-${Date.now()}`;
    const result = await importProjectDesign(paths, proj, { id });
    expect(result.ok).toBe(true);

    // Spot the loop-ready component in the report.
    const report: AdoptionReport = result.report;
    const comp = report.components.find((c) => c.name === 'TokenAware');
    expect(comp, 'TokenAware found in report').toBeDefined();
    expect(comp!.status, 'TokenAware is loop-ready').toBe('loop-ready');
    expect(comp!.rebinds.length, 'rebinds exist').toBeGreaterThan(0);

    // Read the placed source and run the REAL consistency lint.
    const placed = fs.readFileSync(comp!.placedPath, 'utf8');
    const tokensCss = fs.readFileSync(
      path.join(paths.designSystemsDir, id, 'tokens.css'),
      'utf8',
    );
    const declaredTokens = parseDeclaredTokens(tokensCss);
    const findings = lintComponent(placed, { declaredTokens });

    // Loop-ready means the real lint agrees: no must-fix, no off-token color.
    expect(countMustFix(findings), 'no P0 findings').toBe(0);
    expect(findings.some((f) => f.id === 'off-token-color'), 'no off-token-color').toBe(false);
  });
});

describe('e2e: adopted component marked needs-manual-fix has genuine findings', () => {
  it('a component with unresolved raw hex genuinely fails the consistency lint', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);

    // A component with a rare hex (#ff00ff) that maps to no high-confidence
    // role → no rebind, raw hex remains → needs-manual-fix.
    const proj = path.join(os.tmpdir(), `e2e-proj-manual-${Date.now()}`);
    tmps.push(proj);
    fs.mkdirSync(proj, { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), JSON.stringify({ name: 'manual-fix-app' }));
    fs.writeFileSync(
      path.join(proj, 'tailwind.config.js'),
      `module.exports = { theme: { extend: { colors: {
        surface: '#0a0a0a',
        accent: '#3b82f6'
      } } } };
`,
    );
    const src = path.join(proj, 'src', 'components');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(
      path.join(src, 'Untamed.tsx'),
      [
        'export function Untamed() {',
        '  return <div className="bg-[#0a0a0a] text-[#ff00ff] rounded p-4">Untamed</div>;',
        '}',
        '',
      ].join('\n'),
    );

    const id = `e2e-manual-${Date.now()}`;
    const result = await importProjectDesign(paths, proj, { id });
    expect(result.ok).toBe(true);

    const report: AdoptionReport = result.report;
    const comp = report.components.find((c) => c.name === 'Untamed');
    expect(comp, 'Untamed found').toBeDefined();
    expect(comp!.status, 'Untamed is needs-manual-fix').toBe('needs-manual-fix');

    // The placed source still has #ff00ff (unrebound).
    const placed = fs.readFileSync(comp!.placedPath, 'utf8');
    expect(placed).toContain('#ff00ff');

    // The real lint flags the off-token value.
    const tokensCss = fs.readFileSync(
      path.join(paths.designSystemsDir, id, 'tokens.css'),
      'utf8',
    );
    const declaredTokens = parseDeclaredTokens(tokensCss);
    const findings = lintComponent(placed, { declaredTokens });

    // The lint finds the raw hex — must-fix or off-token-color.
    const hasOffToken = findings.some((f) => f.id === 'off-token-color');
    const hasMustFix = countMustFix(findings) > 0;
    expect(hasOffToken || hasMustFix, 'lint flags the off-token value').toBe(true);
  });
});
