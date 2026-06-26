import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRuntime } from '../src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const designSystemsDir = path.join(repo, 'design-systems');
const rt = createRuntime({ designSystemsDir, skillsDir: path.join(repo, 'skills'), parseCode: true, componentExt: '.tsx' });

afterAll(() => {
  // clean up any history snapshots the test wrote
  fs.rmSync(path.join(designSystemsDir, 'atelier', '.history'), { recursive: true, force: true });
});

describe('DesignSystemRuntime — load + domain', () => {
  const ds = rt.load('atelier');
  it('loads the aggregate with tokens, components, sections', () => {
    expect(ds.name).toBe('Atelier');
    expect(ds.tokens().length).toBeGreaterThan(5);
    expect(ds.components().map((c) => c.name)).toContain('Button');
    expect(ds.token('color-accent')?.value).toBeTruthy();
    expect(ds.sections().length).toBeGreaterThanOrEqual(9);
  });

  it('toContext() returns the flat back-compat view', () => {
    const ctx = ds.toContext();
    expect(ctx.declaredTokens).toContain('color-accent');
    expect(ctx.primitives).toContain('Card');
    expect(ctx.bindsDisplayFace).toBe(true);
  });
});

describe('validation + references + conflicts', () => {
  it('validate(atelier) passes the token contract', () => {
    const v = rt.validate('atelier');
    expect(v.ok).toBe(true);
    expect(v.diagnostics.filter((d) => d.severity === 'P0')).toHaveLength(0);
  });

  it('references(--color-accent) reaches the primary variant', () => {
    const ids = rt.references('atelier', 'atelier/--color-accent').map((r) => r.id);
    expect(ids).toContain('atelier/Button@primary');
  });

  it('conflicts(atelier) has no duplicate-role / dangling-theme issues', () => {
    const c = rt.conflicts('atelier');
    expect(c.some((x) => x.kind === 'duplicate-role')).toBe(false);
    expect(c.some((x) => x.kind === 'theme-override')).toBe(false);
    // orphan tokens (P2) are allowed
  });
});

describe('rule engine', () => {
  it('flags AI-slop in a component', () => {
    const slop = `export const X = () => <div className="bg-[#6366f1] bg-gradient-to-r from-indigo-500"><h1>10x faster</h1>✨</div>;`;
    const diags = rt.evaluateComponent(slop, { declaredTokens: ['color-accent'], framework: 'react-tailwind' });
    const ids = diags.map((d) => d.ruleId);
    expect(ids).toContain('ai-default-indigo');
    expect(diags.some((d) => d.severity === 'P0')).toBe(true);
  });

  it('passes a clean, on-token component', () => {
    const ok = `export const X = () => <div className="bg-surface text-text"><p>Real copy.</p></div>;`;
    const diags = rt.evaluateComponent(ok, { declaredTokens: ['color-surface', 'color-text'], framework: 'react-tailwind' });
    expect(diags.filter((d) => d.severity === 'P0')).toHaveLength(0);
  });
});

describe('history', () => {
  it('snapshots and diffs', () => {
    rt.snapshot('atelier');
    const h = rt.history('atelier');
    expect(h.snapshots.length).toBeGreaterThanOrEqual(1);
    expect(h.snapshots[0].tokens['color-accent']).toBeTruthy();
  });
});
