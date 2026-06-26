import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph, overlayArtifact, findAffected, whereToFix, consistencyBrief, query } from '../src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const atelierDir = path.join(repo, 'design-systems/atelier');
const pricingTiers = path.join(repo, 'apps/workspace-react/src/generated/PricingTiers.tsx');

describe('buildGraph(atelier)', () => {
  const g = buildGraph(atelierDir, 'atelier');

  it('indexes files, tokens, colors, typefaces', () => {
    expect(g.nodes({ label: 'file' }).length).toBeGreaterThan(3);
    expect(g.nodes({ label: 'token' }).length).toBeGreaterThan(5);
    expect(g.node('atelier/#b4532a')?.label).toBe('color'); // accent swatch deduped
    expect(g.nodes({ label: 'typeface' }).some((t) => t.props.family === 'Newsreader')).toBe(true);
  });

  it('parses spec sections and links tokens to them', () => {
    expect(g.nodes({ label: 'section' }).length).toBeGreaterThanOrEqual(9);
    expect(g.edges({ label: 'definedIn' }).length).toBeGreaterThan(0);
  });

  it('parses primitives, props, variants, stories', () => {
    const prims = g.nodes({ label: 'primitive' }).map((p) => p.props.name);
    for (const n of ['Button', 'Card', 'Input', 'Badge', 'Heading', 'Stack']) expect(prims).toContain(n);
    expect(g.node('atelier/Button@primary')?.label).toBe('variant');
    expect(g.edges({ label: 'uses', from: 'atelier/Button@primary' }).some((e) => e.to === 'atelier/--color-accent')).toBe(true);
    expect(g.nodes({ label: 'story' }).length).toBeGreaterThan(0);
    expect(g.edges({ label: 'declaredIn' }).length).toBeGreaterThan(0);
  });

  it('property-filtered queries work', () => {
    const colorTokens = query(g, { label: 'token', where: { kind: 'color' } });
    expect(colorTokens.length).toBeGreaterThan(0);
    expect((colorTokens as any[]).every((n) => n.props.kind === 'color')).toBe(true);
  });

  it('consistencyBrief returns primitives, tokens, rules, vibe', () => {
    const brief = consistencyBrief(g, { name: 'CalloutBanner', intent: 'a dismissible info banner' });
    expect(brief.composablePrimitives).toContain('Card');
    expect(brief.tokensByKind.color?.length).toBeGreaterThan(0);
    expect(brief.governingRules.length).toBeGreaterThan(0);
    expect(brief.vibe.length).toBeGreaterThan(0);
  });
});

describe('overlayArtifact + impact + where-to-fix', () => {
  const g = buildGraph(atelierDir, 'atelier');
  // overlay PricingTiers with an injected finding to exercise where-to-fix
  overlayArtifact(g, 'atelier', pricingTiers, 'atelier/generated/PricingTiers.tsx', {
    findings: [{ id: 'ai-default-indigo', severity: 'P1', snippet: '#6366f1', line: 42 }],
  });

  it('wires composition + references', () => {
    const composes = g.edges({ label: 'composes', from: 'art/PricingTiers' }).map((e) => e.to);
    expect(composes).toContain('atelier/Button');
    expect(composes).toContain('atelier/Card');
    expect(composes).toContain('atelier/Badge');
    expect(g.edges({ label: 'references', from: 'art/PricingTiers' }).some((e) => e.to === 'atelier/--color-accent')).toBe(true);
  });

  it('findAffected(--color-accent) reaches the variant and the artifact', () => {
    const ids = findAffected(g, 'atelier/--color-accent').map((a) => a.id);
    expect(ids).toContain('atelier/Button@primary');
    expect(ids).toContain('art/PricingTiers');
  });

  it('whereToFix resolves token + file:line', () => {
    const res = whereToFix(g, 'art/PricingTiers', 'ai-default-indigo');
    expect(res).not.toBeNull();
    expect(res!.remediation).toBeTruthy();
    const locs = JSON.stringify(res!.fixLocations);
    expect(locs).toMatch(/offending code/);
    expect(locs).toMatch(/--color-accent/);
    expect(locs).toMatch(/tokens\.css/);
  });

  it('property filter on edges by severity', () => {
    expect(query(g, { edgeLabel: 'violates', where: { severity: 'P1' } }).length).toBe(1);
  });
});

describe('metadata-only fallback (parseCode:false — stub frameworks)', () => {
  const g = buildGraph(atelierDir, 'atelier', { parseCode: false });
  it('builds primitives from filenames, no AST wiring, token/section layer intact', () => {
    const prims = g.nodes({ label: 'primitive' });
    expect(prims.length).toBe(6); // file-based (Heading+Eyebrow share one file → 1)
    expect(prims.every((p) => p.props.parsedFrom === 'metadata')).toBe(true);
    expect(g.edges({ label: 'hasProp' }).length).toBe(0);
    expect(g.edges({ label: 'hasVariant' }).length).toBe(0);
    expect(g.nodes({ label: 'token' }).length).toBeGreaterThan(0); // metadata/regex layer still built
    expect(g.nodes({ label: 'section' }).length).toBeGreaterThanOrEqual(9);
  });
});

describe('intent/playbook overlay', () => {
  const g = buildGraph(atelierDir, 'atelier');
  overlayArtifact(g, 'atelier', pricingTiers, 'atelier/generated/PricingTiers.tsx', {
    intent: { slug: 'pricing-tiers', title: 'A pricing section with three tiers', file: 'design/changes/pricing-tiers/intent.md' },
  });
  it('links intent → artifact via produces', () => {
    expect(g.node('intent/pricing-tiers')?.label).toBe('intent');
    expect(g.edges({ label: 'produces', from: 'intent/pricing-tiers' }).some((e) => e.to === 'art/PricingTiers')).toBe(true);
  });
});
