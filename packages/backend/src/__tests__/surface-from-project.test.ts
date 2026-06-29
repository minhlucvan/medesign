/**
 * design-surface-api — ds-from-project exposure tests.
 *
 * The backend exposes, over the read-only SSE transport + status/report
 * endpoints, the per-stage progress, terminal status (completed | failed with
 * the failing stage + reason), and the adoption report that the ds-from-project
 * workflow produces — started via POST /api/design-systems/from-project.
 *
 * The `from-project` start endpoint and the adoption-report endpoint do not
 * exist yet — this suite is RED until workflow-api.ts wires them.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let server: http.Server;
let baseUrl: string;
let prevCwd: string;
let ws: string;
let proj: string;
let workflowOrchestrator: any;

function makeWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'surf-fromproj-ws-'));
  fs.writeFileSync(
    path.join(dir, 'emdesign.config.json'),
    JSON.stringify({
      framework: 'react-tailwind',
      storybookUrl: 'http://localhost:6006',
      generatedDir: 'src/generated',
      componentsDir: 'src/components',
      designSystemsDir: 'design-systems',
      screenshotsDir: '__screenshots__',
    }),
  );
  const atelierCode = path.join(dir, 'design-systems', 'atelier', 'code');
  fs.mkdirSync(atelierCode, { recursive: true });
  fs.writeFileSync(path.join(atelierCode, 'Button.tsx'), 'export const Button = () => null;\n');
  fs.writeFileSync(
    path.join(atelierCode, 'Button.stories.tsx'),
    "export default { title: 'Button' };\nexport const Default = {};\n",
  );
  return dir;
}

function makeSourceProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surf-fromproj-src-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'sample-app', version: '0.0.0' }));
  fs.writeFileSync(
    path.join(root, 'tailwind.config.js'),
    `module.exports = { theme: { extend: { colors: {
    surface: '#0a0a0a', accent: '#3b82f6', border: '#1a1a1a', text: '#fafafa',
  } } } };
`,
  );
  const src = path.join(root, 'src', 'components');
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(
    path.join(src, 'Card.tsx'),
    `export function Card() {
  return <div className="bg-[#0a0a0a] text-[#3b82f6] rounded p-4">Card</div>;
}
`,
  );
  return root;
}

beforeAll(async () => {
  ws = makeWorkspace();
  proj = makeSourceProject();
  prevCwd = process.cwd();
  process.chdir(ws);

  const mod = await import('../workflow-api.js');
  workflowOrchestrator = (mod as any).workflowOrchestrator;
  const app = express();
  app.use(express.json());
  app.use('/api', mod.workflowApiRouter);

  return new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(() => {
  if (server) server.close();
  try { process.chdir(prevCwd); } catch { /* ignore */ }
  for (const d of [ws, proj]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe('POST /api/design-systems/from-project — start via API', () => {
  it('accepts a valid project path and returns a streaming handle (sessionId)', async () => {
    const res = await fetch(`${baseUrl}/api/design-systems/from-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: proj, id: 'surf-sys' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('sessionId');
    expect(typeof body.sessionId).toBe('string');
    expect(body.sessionId.length).toBeGreaterThan(0);
  });

  it('rejects a missing projectPath with 400', async () => {
    const res = await fetch(`${baseUrl}/api/design-systems/from-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty('error');
  });

  it('rejects a non-existent / unsupported project path with 400', async () => {
    const res = await fetch(`${baseUrl}/api/design-systems/from-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: path.join(os.tmpdir(), 'nope-xyz-' + Date.now()) }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty('error');
  });
});

describe('GET /api/design-systems/:id/workflow-stream — client subscribes to progress', () => {
  it('streams per-stage SSE events ending in completed', async () => {
    const createRes = await fetch(`${baseUrl}/api/design-systems/from-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: proj, id: 'surf-stream' }),
    });
    const { sessionId } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/design-systems/${sessionId}/workflow-stream`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');

    const text = await res.text();
    const lines = text.trim().split('\n').filter((l) => l.startsWith('data: '));
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const last = JSON.parse(lines[lines.length - 1].replace(/^data: /, ''));
    expect(last).toHaveProperty('status', 'completed');
  });
});

describe('GET /api/design-systems/:id/workflow-status — read status after completion', () => {
  it('returns the terminal completed status with stages', async () => {
    const createRes = await fetch(`${baseUrl}/api/design-systems/from-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: proj, id: 'surf-status' }),
    });
    const { sessionId } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/design-systems/${sessionId}/workflow-status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'completed');
    expect(Array.isArray(body.stages)).toBe(true);
  });

  it('returns the terminal failed status including the failing stage and reason', async () => {
    // Drive a failing workflow directly into the shared orchestrator/store the
    // router reads from (a path that cannot be scanned).
    await workflowOrchestrator.runFromProject('surf-failed', {
      projectPath: path.join(os.tmpdir(), 'no-such-surf-' + Date.now()),
      workspaceRoot: ws,
      id: 'surf-failed-sys',
    });

    const res = await fetch(`${baseUrl}/api/design-systems/surf-failed/workflow-status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'failed');
    const errored = body.stages.find((s: any) => s.status === 'error');
    expect(errored).toBeDefined();
    expect(errored.error).toBeTruthy();
  });
});

describe('GET /api/design-systems/:id/adoption-report — report served read-only', () => {
  it('serves the adoption report for a completed workflow', async () => {
    const createRes = await fetch(`${baseUrl}/api/design-systems/from-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: proj, id: 'surf-report' }),
    });
    const { sessionId } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/design-systems/${sessionId}/adoption-report`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.components)).toBe(true);
    expect(body.components.length).toBeGreaterThan(0);
    for (const c of body.components) {
      expect(c).toHaveProperty('name');
      expect(c).toHaveProperty('status');
    }
  });

  it('returns 404 for an unknown workflow', async () => {
    const res = await fetch(`${baseUrl}/api/design-systems/no-such-session/adoption-report`);
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty('error');
  });
});
