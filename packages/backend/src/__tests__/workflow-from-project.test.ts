/**
 * ds-from-project workflow — unit tests for WorkflowOrchestrator.runFromProject().
 *
 * Realizes the `ds-from-existing-project` workflow requirements: a multi-stage
 * pipeline (scan → extract → synthesize DESIGN.md → tokens → primitives → adopt
 * → graph → validate) that streams per-stage progress, synthesizes/reconciles a
 * DESIGN.md, generates a complete tokens.css, scaffolds primitives, builds the
 * graph, validates, and only THEN registers the system (source.type: "project").
 *
 * `runFromProject` does not exist yet — this suite is RED until workflow.ts lands.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { WorkflowOrchestrator } from '../workflow.js';
import { resolveRepoPaths, readConfig } from '../paths.js';
import { validateDesignSystem } from '../scaffold.js';
import type { AdoptionReport } from '../project/report.js';

// Stage order required by the spec (`A multi-stage workflow drives creation`).
const STAGES = [
  'scan',
  'extract',
  'synthesize DESIGN.md',
  'tokens',
  'primitives',
  'adopt',
  'graph',
  'validate',
] as const;

const tmps: string[] = [];

/** A workspace dir with an emdesign.config.json and a seeded `atelier` base to
 *  scaffold `code/` primitives from. The new system is written here. */
function makeWorkspace(): string {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'fromproj-ws-'));
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
  // Seed an `atelier` base so primitive scaffolding has a source.
  const atelierCode = path.join(ws, 'design-systems', 'atelier', 'code');
  fs.mkdirSync(atelierCode, { recursive: true });
  fs.writeFileSync(path.join(atelierCode, 'Button.tsx'), 'export const Button = () => null;\n');
  fs.writeFileSync(
    path.join(atelierCode, 'Button.stories.tsx'),
    "export default { title: 'Button' };\nexport const Default = {};\n",
  );
  return ws;
}

/** A source project to reverse-engineer: tailwind config + css vars + a component
 *  carrying hardcoded values, and (optionally) a canonical DESIGN.md. */
function makeSourceProject(opts: { designMd?: string } = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fromproj-src-'));
  tmps.push(root);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'sample-app', version: '0.0.0' }));
  // Note: `accent-hover` is intentionally omitted so a documented default is used.
  fs.writeFileSync(
    path.join(root, 'tailwind.config.js'),
    `module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: { colors: {
    surface: '#0a0a0a',
    accent: '#3b82f6',
    border: '#1a1a1a',
    text: '#fafafa',
  } } },
};
`,
  );
  const src = path.join(root, 'src');
  fs.mkdirSync(path.join(src, 'components'), { recursive: true });
  fs.writeFileSync(
    path.join(src, 'styles.css'),
    ':root {\n  --color-accent: #3b82f6;\n  --color-surface: #0a0a0a;\n}\n',
  );
  fs.writeFileSync(
    path.join(src, 'components', 'Card.tsx'),
    `export function Card() {
  return <div className="bg-[#0a0a0a] text-[#3b82f6] border-[#1a1a1a] rounded p-4">Card</div>;
}
`,
  );
  if (opts.designMd) {
    fs.writeFileSync(path.join(root, 'DESIGN.md'), opts.designMd);
  }
  return root;
}

afterEach(() => {
  for (const d of tmps.splice(0)) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe('WorkflowOrchestrator.runFromProject — stage progress is streamed', () => {
  it('runs every stage in order, recording name/status/progress, with intermediate artifacts', async () => {
    const ws = makeWorkspace();
    const proj = makeSourceProject();
    const orch = new WorkflowOrchestrator();

    const result: any = await orch.runFromProject('wf-progress', {
      projectPath: proj,
      workspaceRoot: ws,
      id: 'from-proj-progress',
    });

    expect(result.completed).toBe(true);

    const session = orch.getSession('wf-progress')!;
    expect(session).toBeDefined();
    expect(session.stages.map((s) => s.name)).toEqual([...STAGES]);
    for (const stage of session.stages) {
      expect(stage).toHaveProperty('name');
      expect(stage).toHaveProperty('status');
      expect(stage).toHaveProperty('progress');
      expect(stage.status).toBe('done');
    }
    expect(session.status).toBe('completed');

    // Intermediate artifacts (extracted tokens, generated DESIGN.md) are exposed.
    expect(result.artifacts).toBeDefined();
    expect(typeof result.artifacts['DESIGN.md']).toBe('string');
    expect(result.artifacts['DESIGN.md'].length).toBeGreaterThan(0);
    expect(result.artifacts['tokens.css']).toContain('--color-accent');
  });
});

describe('WorkflowOrchestrator.runFromProject — project has no DESIGN.md', () => {
  it('synthesizes DESIGN.md, generates tokens.css, scaffolds code/, builds graph, registers, returns a report', async () => {
    const ws = makeWorkspace();
    const proj = makeSourceProject(); // no DESIGN.md
    const id = 'from-proj-synth';
    const orch = new WorkflowOrchestrator();

    const result: any = await orch.runFromProject('wf-synth', { projectPath: proj, workspaceRoot: ws, id });
    expect(result.completed).toBe(true);

    const paths = resolveRepoPaths(ws);
    const dsRoot = path.join(paths.designSystemsDir, id);

    // DESIGN.md synthesized from evidence.
    expect(fs.existsSync(path.join(dsRoot, 'DESIGN.md'))).toBe(true);

    // tokens.css declares all required roles (validate is the contract self-check).
    const tokens = fs.readFileSync(path.join(dsRoot, 'tokens.css'), 'utf8');
    expect(tokens).toContain('--color-accent');
    expect(validateDesignSystem(paths, id).ok).toBe(true);

    // code/ primitives scaffolded.
    const codeDir = path.join(dsRoot, 'code');
    expect(fs.existsSync(codeDir)).toBe(true);
    expect(fs.readdirSync(codeDir).length).toBeGreaterThan(0);

    // graph.json built via buildAndSave.
    expect(fs.existsSync(path.join(dsRoot, 'graph.json'))).toBe(true);

    // Declared in emdesign.config.json + manifest carries source.type "project".
    expect(readConfig(ws).activeDesignSystem).toBe(id);
    const manifest = JSON.parse(fs.readFileSync(path.join(dsRoot, 'manifest.json'), 'utf8'));
    expect(manifest.source?.type).toBe('project');

    // Adoption report returned.
    const report: AdoptionReport = result.report;
    expect(Array.isArray(report.components)).toBe(true);
    expect(report.components.length).toBeGreaterThan(0);
  });
});

describe('WorkflowOrchestrator.runFromProject — project already has a DESIGN.md', () => {
  it('keeps the existing DESIGN.md canonical, prefers its token values, and records divergences', async () => {
    const ws = makeWorkspace();
    const canonical = `---
name: Acme Canonical DS
category: Editorial
---
# Acme Canonical DS

## 2. Color
--color-accent: #aabbcc
--color-surface: #0a0a0a
`;
    const proj = makeSourceProject({ designMd: canonical }); // code uses accent #3b82f6
    const id = 'from-proj-reconcile';
    const orch = new WorkflowOrchestrator();

    const result: any = await orch.runFromProject('wf-reconcile', { projectPath: proj, workspaceRoot: ws, id });
    expect(result.completed).toBe(true);

    const paths = resolveRepoPaths(ws);
    const dsRoot = path.join(paths.designSystemsDir, id);

    // Existing DESIGN.md kept canonical.
    const designMd = fs.readFileSync(path.join(dsRoot, 'DESIGN.md'), 'utf8');
    expect(designMd).toContain('Acme Canonical DS');

    // tokens.css prefers the DESIGN.md value over the code value.
    const tokens = fs.readFileSync(path.join(dsRoot, 'tokens.css'), 'utf8');
    expect(tokens).toMatch(/--color-accent:\s*#aabbcc/);

    // Divergence from the code recorded.
    expect(Array.isArray(result.notes)).toBe(true);
    expect(
      result.notes.some((n: string) => /color-accent/i.test(n) && /(diverg|override)/i.test(n)),
    ).toBe(true);
  });
});

describe('WorkflowOrchestrator.runFromProject — generated system passes its own validation', () => {
  it('completes validate, with any uninferred role using a documented default listed in the report', async () => {
    const ws = makeWorkspace();
    const proj = makeSourceProject(); // omits accent-hover → a default is used
    const id = 'from-proj-validate';
    const orch = new WorkflowOrchestrator();

    const result: any = await orch.runFromProject('wf-validate', { projectPath: proj, workspaceRoot: ws, id });
    expect(result.completed).toBe(true);

    const paths = resolveRepoPaths(ws);
    expect(validateDesignSystem(paths, id).ok).toBe(true);

    // Documented defaults are surfaced to the report.
    expect(Array.isArray(result.notes)).toBe(true);
    expect(result.notes.some((n: string) => /default/i.test(n))).toBe(true);
  });
});

describe('WorkflowOrchestrator.runFromProject — a stage fails', () => {
  it('stops, names the failing stage + reason, and registers no partial system', async () => {
    const ws = makeWorkspace();
    const id = 'from-proj-fail';
    const orch = new WorkflowOrchestrator();

    const result: any = await orch.runFromProject('wf-fail', {
      projectPath: path.join(os.tmpdir(), 'no-such-project-xyz-' + Date.now()),
      workspaceRoot: ws,
      id,
    });

    expect(result.completed).toBe(false);
    expect(typeof result.failedStage).toBe('string');
    expect(result.failedStage.length).toBeGreaterThan(0);
    expect(typeof result.error).toBe('string');
    expect(result.error.length).toBeGreaterThan(0);

    const session = orch.getSession('wf-fail')!;
    expect(session.status).toBe('failed');
    const errored = session.stages.find((s) => s.status === 'error');
    expect(errored).toBeDefined();
    expect(errored!.error).toBeTruthy();

    // Nothing registered: no ds dir, config not pointed at the partial system.
    const paths = resolveRepoPaths(ws);
    expect(fs.existsSync(path.join(paths.designSystemsDir, id))).toBe(false);
    expect(readConfig(ws).activeDesignSystem).not.toBe(id);
  });
});
