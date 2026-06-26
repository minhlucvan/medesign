import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, normalizeDsRef, type RepoPaths } from './paths.js';
import { parseDeclaredTokens, resolveDesignSystem } from './designContext.js';
import { buildAndSave } from './graph.js';
import { SEMANTIC_TOKEN_ROLES } from '@medesign/dsr';

/** Design-system scaffolding — the create/validate engine behind the Design System flow. */

export type CreateMode = 'blank' | 'brief' | 'import' | 'extract';

/** A 9-section DESIGN.md skeleton (per docs/spec.md) the author then fills in. */
export function designMdSkeleton(id: string, name: string): string {
  return `---
name: ${name}
category: Custom
surface: web
description: TODO one-line summary (≤240 chars) — the vibe of ${name}.
version: 0.1.0
---

# ${name}
> Category: Custom
> Surface: web

TODO: a one-paragraph summary of the system's vibe.

## 1. Visual Theme & Atmosphere
TODO: the felt experience + foundational palette (exact values).

## 2. Color
TODO: every role with exact hex (surfaces, text tiers, accent + hover, border, status).

## 3. Typography
TODO: a full type-scale table (role · family · size · weight · line-height · letter-spacing).

## 4. Spacing
TODO: base unit + scale.

## 5. Layout & Composition
TODO: grid, container width, section rhythm, whitespace philosophy.

## 6. Components
TODO: per-component specs with states (button, card, input, badge…).

## 7. Motion & Interaction
TODO: durations, easings, what animates and what must not.

## 8. Voice & Brand
TODO: tone, copy rules, what the brand is not.

## 9. Anti-patterns
TODO: hard Do/Don't guardrails (these map to consistency-lint rules).

## 10. Tokens
See \`tokens.css\` for the machine contract.
`;
}

/** A neutral base tokens.css declaring every required role (the author re-colors it). */
export function baseTokensCss(): string {
  return `/* base token contract — declares every required role. Re-value for your brand. */
:root {
  --color-surface: #ffffff;
  --color-surface-raised: #f7f7f8;
  --color-text: #18181b;
  --color-text-muted: #6b7280;
  --color-accent: #2563eb;
  --color-accent-hover: #1d4ed8;
  --color-border: #e5e7eb;
  --color-success: #15803d;
  --color-warn: #b45309;
  --color-danger: #b91c1c;

  --font-display: "Inter", system-ui, sans-serif;
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --radius: 8px;
  --radius-sm: 5px;
  --radius-pill: 999px;
  --space-unit: 8px;
  --shadow-raised: 0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05);
  --focus-ring: 0 0 0 3px rgba(37,99,235,0.28);

  --motion-fast: 120ms;
  --motion-base: 220ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);

  --container-max: 1180px;
  --section-y: 96px;
}
`;
}

/** Provenance for a base derived from an upstream corpus (e.g. open-design). */
export interface DesignSystemSource {
  type: string;
  skill: string;
  upstream?: string;
  license?: string;
}

export interface ManifestOpts {
  category?: string;
  description?: string;
  surface?: string;
  /** Lint rules this look opts into / out of (e.g. brutalist exempts caps-no-tracking). */
  craft?: { applies?: string[]; exemptions?: string[] };
  /** Set for vendored bases; stripped on import so the clone is the user's own system. */
  source?: DesignSystemSource;
  files?: Record<string, string>;
}

const DEFAULT_CRAFT_APPLIES = ['off-token-color', 'ai-default-indigo', 'accent-overuse', 'token-self-check'];

export function manifestJson(id: string, name: string, opts: ManifestOpts = {}): string {
  const manifest: Record<string, unknown> = {
    schemaVersion: 'od-design-system-project/v1',
    id,
    name,
    category: opts.category ?? 'Custom',
    description: opts.description ?? `${name} design system.`,
    files: opts.files ?? { design: 'DESIGN.md', tokens: 'tokens.css', components: 'components.html' },
    craft: { applies: opts.craft?.applies ?? DEFAULT_CRAFT_APPLIES, exemptions: opts.craft?.exemptions ?? [] },
  };
  if (opts.surface) manifest.surface = opts.surface;
  if (opts.source) manifest.source = opts.source;
  return JSON.stringify(manifest, null, 2) + '\n';
}

function dsDir(paths: RepoPaths, id: string): string {
  return path.join(paths.designSystemsDir, ...normalizeDsRef(id).split('/'));
}

function copyDir(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** After cloning a base, set the manifest's id/name to the new system and drop vendor provenance. */
function reidImportedManifest(manifestFile: string, id: string, name: string): void {
  if (!fs.existsSync(manifestFile)) return;
  try {
    const m = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    m.id = id;
    m.name = name;
    delete m.source;
    fs.writeFileSync(manifestFile, JSON.stringify(m, null, 2) + '\n');
  } catch {
    /* leave a non-JSON manifest untouched */
  }
}

/** Copy the base primitive set from a reference design system's code/ (default the seeded 'atelier'). */
export function scaffoldPrimitives(paths: RepoPaths, id: string, from = 'atelier'): boolean {
  const src = path.join(dsDir(paths, from), 'code');
  const dest = path.join(dsDir(paths, id), 'code');
  if (!fs.existsSync(src) || fs.existsSync(dest)) return false;
  copyDir(src, dest);
  return true;
}

export interface CreateResult {
  id: string;
  dir: string;
  mode: CreateMode;
  wrote: string[];
  primitivesFrom?: string;
  note?: string;
}

/**
 * Create a design system. `blank` writes a skeleton; `import` clones an existing/seeded system; `brief`
 * and `extract` scaffold blank, then the author fills the DESIGN.md (via the design-system-author skill).
 */
export function createDesignSystem(
  paths: RepoPaths,
  opts: { id: string; name?: string; mode?: CreateMode; from?: string },
): CreateResult {
  const { id } = opts;
  const name = opts.name ?? id;
  const mode = opts.mode ?? 'blank';
  const dir = dsDir(paths, id);
  if (fs.existsSync(dir)) throw new Error(`Design system '${id}' already exists at ${dir}`);
  ensureDir(dir);
  const wrote: string[] = [];

  if (mode === 'import') {
    const from = opts.from;
    if (!from) throw new Error('import mode requires `from` (a design-system id or base ref to clone, e.g. open-design/brutalist).');
    const fromDir = dsDir(paths, from);
    if (!fs.existsSync(fromDir)) throw new Error(`Cannot import: design system '${from}' not found.`);
    copyDir(fromDir, dir);
    // Re-id the clone and drop the vendor provenance — it is now the user's own system to evolve.
    reidImportedManifest(path.join(dir, 'manifest.json'), id, name);
    // Re-title the cloned Showcase story so its story id can't collide with the base / other systems.
    try {
      const showcase = path.join(dir, 'code', 'Showcase.stories.tsx');
      if (fs.existsSync(showcase)) {
        const display = name ?? id.replace(/(^|-)([a-z])/g, (_, sep, ch) => (sep ? ' ' : '') + ch.toUpperCase());
        fs.writeFileSync(showcase, fs.readFileSync(showcase, 'utf8').replace(/title:\s*['"][^'"]*['"]/, `title: 'Design System/${display}'`));
      }
    } catch { /* no showcase to retitle */ }
    // Defer-no-hooks: run the existing post-create processing inline (graph index + token-contract check).
    let graphRebuilt = false;
    try { buildAndSave(paths, id); graphRebuilt = true; } catch { /* may need authoring first */ }
    const v = validateDesignSystem(paths, id);
    const note =
      `Cloned from '${from}'. ${graphRebuilt ? 'Graph built; ' : ''}` +
      `${v.ok ? 'token contract OK' : `validation: ${v.note}`}. Edit DESIGN.md/tokens to differentiate.`;
    return { id, dir, mode, wrote: [dir], primitivesFrom: from, note };
  }

  // blank / brief / extract → skeleton, then authored by the agent.
  fs.writeFileSync(path.join(dir, 'DESIGN.md'), designMdSkeleton(id, name));
  fs.writeFileSync(path.join(dir, 'tokens.css'), baseTokensCss());
  fs.writeFileSync(path.join(dir, 'manifest.json'), manifestJson(id, name));
  wrote.push(`${dir}/DESIGN.md`, `${dir}/tokens.css`, `${dir}/manifest.json`);
  const primitivesFrom = scaffoldPrimitives(paths, id, opts.from ?? 'atelier') ? (opts.from ?? 'atelier') : undefined;
  const note =
    mode === 'blank'
      ? 'Fill in the DESIGN.md sections + re-value tokens.css.'
      : 'Skeleton ready — author the DESIGN.md (design-system-author skill) from the brief/reference, then validate.';
  return { id, dir, mode, wrote, primitivesFrom, note };
}

export interface ValidateResult {
  id: string;
  ok: boolean;
  declared: number;
  missingRoles: string[];
  note: string;
}

/** Token-contract self-check: every required role declared in tokens.css. */
export function validateDesignSystem(paths: RepoPaths, id: string): ValidateResult {
  const tokensCss = (() => {
    try { return fs.readFileSync(path.join(dsDir(paths, id), 'tokens.css'), 'utf8'); } catch { return ''; }
  })();
  const declared = new Set(parseDeclaredTokens(tokensCss));
  const missingRoles = SEMANTIC_TOKEN_ROLES.filter((r) => !declared.has(r));
  const ok = tokensCss.length > 0 && missingRoles.length === 0;
  return {
    id,
    ok,
    declared: declared.size,
    missingRoles,
    note: ok ? 'Token contract complete.' : missingRoles.length ? `Missing roles: ${missingRoles.join(', ')}` : 'No tokens.css found.',
  };
}

export interface ApplyResult {
  id: string;
  wired: string[];
  graphRebuilt: boolean;
  note: string;
}

/**
 * Select a design system and rewire the workspace: rebind the tokens.css import + the `@ds` marker and
 * rebuild the graph. Shared by the MCP `apply_design_system` tool and the CLI `ds use`.
 */
export function applyDesignSystem(paths: RepoPaths, id: string): ApplyResult {
  resolveDesignSystem(paths, id); // throws if missing
  const wired: string[] = [];

  const cssFile = path.join(paths.studioDir, 'src', 'active-design-system.css');
  const rel = path.relative(path.dirname(cssFile), path.join(dsDir(paths, id), 'tokens.css')).split(path.sep).join('/');
  ensureDir(path.dirname(cssFile));
  fs.writeFileSync(cssFile, `/* active design system */\n@import "${rel}";\n`);
  wired.push(cssFile);

  ensureDir(paths.medesignDir);
  fs.writeFileSync(path.join(paths.medesignDir, 'active-ds'), id);
  wired.push(path.join(paths.medesignDir, 'active-ds'));

  let graphRebuilt = false;
  try { buildAndSave(paths, id); graphRebuilt = true; } catch { /* may be mid-authoring */ }

  return { id, wired, graphRebuilt, note: 'Restart Storybook to repoint the @ds alias (tokens hot-reload).' };
}

export interface DesignSystemBase {
  /** The bare folder name under _vendor/open-design/. */
  id: string;
  /** The clone source to pass as `from` (e.g. open-design/brutalist). */
  ref: string;
  name: string;
  category?: string;
  surface?: string;
  description?: string;
  source?: DesignSystemSource;
}

/** The dir holding vendored, ready-to-clone bases (e.g. converted open-design systems). */
const VENDOR_BASES_DIR = path.join('_vendor', 'open-design');

/**
 * List the prebuilt bases available as `import` sources — vendored design systems under
 * design-systems/_vendor/open-design/. Prefers the generated catalog.json index, falling back to a
 * filesystem scan. These are intentionally excluded from listDesignSystems (the active-system list).
 */
export function listBases(paths: RepoPaths): DesignSystemBase[] {
  const basesDir = path.join(paths.designSystemsDir, VENDOR_BASES_DIR);
  // Fast path: the catalog index written by the converter.
  const catalogFile = path.join(basesDir, 'catalog.json');
  try {
    const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
    if (Array.isArray(catalog?.bases)) return catalog.bases as DesignSystemBase[];
  } catch {
    /* no catalog yet — scan */
  }
  try {
    return fs
      .readdirSync(basesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(basesDir, e.name, 'DESIGN.md')))
      .map((e) => baseFromDir(basesDir, e.name))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

function baseFromDir(basesDir: string, id: string): DesignSystemBase {
  const dir = path.join(basesDir, id);
  let manifest: any = {};
  try { manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch { /* none */ }
  const md = (() => { try { return fs.readFileSync(path.join(dir, 'DESIGN.md'), 'utf8'); } catch { return ''; } })();
  return {
    id,
    ref: `open-design/${id}`,
    name: manifest.name ?? md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? id,
    category: manifest.category,
    surface: manifest.surface,
    description: manifest.description,
    source: manifest.source,
  };
}

/** List available design systems (folders under designSystemsDir with a DESIGN.md). */
export function listDesignSystems(paths: RepoPaths): Array<{ id: string; name: string }> {
  try {
    return fs
      .readdirSync(paths.designSystemsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('_') && fs.existsSync(path.join(paths.designSystemsDir, e.name, 'DESIGN.md')))
      .map((e) => {
        const md = fs.readFileSync(path.join(paths.designSystemsDir, e.name, 'DESIGN.md'), 'utf8');
        return { id: e.name, name: md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? e.name };
      });
  } catch {
    return [];
  }
}
