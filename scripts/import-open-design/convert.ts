/**
 * Convert vendored open-design systems into selectable medesign bases.
 *
 *   npx tsx scripts/import-open-design/convert.ts [--force] [id ...]
 *
 * For each spec in ./bases.ts it scaffolds design-systems/_vendor/open-design/<id>/ with a token
 * contract (atelier primitives re-skinned by the mapped palette), a DESIGN.md skeleton pre-seeded with
 * the extracted palette + source pointers, a manifest carrying provenance + per-look craft tuning, and
 * the bundled source SKILL.md / assets / references. Run from the repo root. Idempotent: existing bases
 * are skipped unless --force. After this, author each DESIGN.md to the bar and `medesign ds validate`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { resolveRepoPaths, scaffoldPrimitives, baseTokensCss, manifestJson } from '@medesign/backend';
import { BASES, type BaseSpec } from './bases.js';

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = new Set(args.filter((a) => !a.startsWith('--')));

const paths = resolveRepoPaths(process.cwd());
const basesDir = path.join(paths.designSystemsDir, '_vendor', 'open-design');
const srcRoot = path.join(paths.root, 'skills', '_vendor', 'open-design');

function copyDir(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** Override roles in the neutral base contract; every required role stays declared (validation-safe). */
function buildTokens(spec: BaseSpec): string {
  let css = baseTokensCss();
  css = css.replace('/* base token contract — declares every required role. Re-value for your brand. */', `/* ${spec.name} — token contract (draft mapped from open-design/${spec.srcSkill}). */`);
  for (const [role, value] of Object.entries(spec.roles)) {
    const re = new RegExp(`(\\n\\s*--${role}\\s*:\\s*)[^;]*;`);
    if (re.test(css)) css = css.replace(re, `$1${value};`);
    else css = css.replace(/\n\}\s*$/, `\n  --${role}: ${value};\n}\n`);
  }
  return css;
}

/** Pull every :root / inline hex + font hint from the source for the DESIGN.md reference dump. */
function extractPalette(srcDir: string): { hexes: string[]; fonts: string[] } {
  const hexes = new Set<string>();
  const fonts = new Set<string>();
  const scan = (file: string) => {
    let txt = '';
    try { txt = fs.readFileSync(file, 'utf8'); } catch { return; }
    for (const m of txt.matchAll(/#[0-9a-fA-F]{6}\b/g)) hexes.add(m[0].toLowerCase());
    for (const m of txt.matchAll(/font-family\s*:\s*([^;]+);/gi)) fonts.add(m[1].trim());
  };
  for (const f of ['assets/template.html', 'example.html', 'SKILL.md', 'DESIGN.md']) scan(path.join(srcDir, f));
  return { hexes: [...hexes].slice(0, 16), fonts: [...fonts].slice(0, 6) };
}

function designMd(spec: BaseSpec, palette: { hexes: string[]; fonts: string[] }, bundled: string[]): string {
  const r = spec.roles;
  const colorLine = (label: string, role: string) => (r[role] ? `- **${label}** \`${r[role]}\` (\`--${role}\`)` : `- **${label}** TODO (\`--${role}\`)`);
  return `---
name: ${spec.name}
category: ${spec.category}
surface: ${spec.surface}
description: ${spec.description}
version: 0.1.0
colors:
  surface: ${r['color-surface'] ?? 'TODO'}
  text: ${r['color-text'] ?? 'TODO'}
  accent: ${r['color-accent'] ?? 'TODO'}
---

# ${spec.name}
> Category: ${spec.category}
> Surface: ${spec.surface}
> Source: open-design/${spec.srcSkill}${spec.upstream ? ` — ${spec.upstream}` : ''}

${spec.description}

> **DRAFT** — scaffolded from the bundled open-design source. Author every section below to the bar in
> \`docs/authoring-design-systems.md\`, then \`medesign ds validate open-design/${spec.id}\`.
> Source material to draw from: ${bundled.map((b) => `\`${b}\``).join(', ') || '(none bundled)'}.

## 1. Visual Theme & Atmosphere
TODO: the felt experience + foundational palette. Source palette extracted: ${palette.hexes.map((h) => `\`${h}\``).join(' ') || '—'}.

## 2. Color
${colorLine('Surface', 'color-surface')}
${colorLine('Surface raised', 'color-surface-raised')}
${colorLine('Text', 'color-text')}
${colorLine('Text muted', 'color-text-muted')}
${colorLine('Accent', 'color-accent')}
${colorLine('Accent hover', 'color-accent-hover')}
${colorLine('Border', 'color-border')}
TODO: confirm contrast (WCAG AA) + add status colors.

## 3. Typography
TODO: a full type-scale table. Source font hints: ${palette.fonts.map((f) => `\`${f}\``).join(' ') || '—'}.
Display: \`${r['font-display'] ?? r['font-sans'] ?? 'TODO'}\` · Body: \`${r['font-sans'] ?? 'TODO'}\`${r['font-mono'] ? ` · Mono: \`${r['font-mono']}\`` : ''}.

## 4. Spacing
TODO: base unit (\`--space-unit\`) + scale.

## 5. Layout & Composition
TODO: grid, container width, section rhythm.

## 6. Components
TODO: per-component specs with states (button, card, input, badge…). Primitives reused from atelier/code.

## 7. Motion & Interaction
TODO: durations, easings, what animates and what must not.

## 8. Voice & Brand
TODO: tone, copy rules, what the brand is not.

## 9. Anti-patterns
TODO: hard Do/Don't guardrails (map each to a consistency-lint rule; tune manifest.craft).

## 10. Tokens
See \`tokens.css\` for the machine contract.
`;
}

function convert(spec: BaseSpec): { status: string; entry?: Record<string, unknown> } {
  const destDir = path.join(basesDir, spec.id);
  const srcDir = path.join(srcRoot, spec.srcSkill);
  if (!fs.existsSync(srcDir)) return { status: `SKIP ${spec.id}: source not found (${spec.srcSkill})` };
  if (fs.existsSync(destDir) && !force) return { status: `skip ${spec.id} (exists; --force to overwrite)`, entry: catalogEntry(spec) };
  fs.mkdirSync(destDir, { recursive: true });

  // tokens.css + DESIGN.md
  const palette = extractPalette(srcDir);
  fs.writeFileSync(path.join(destDir, 'tokens.css'), buildTokens(spec));

  // bundle source skill + assets + references (reference material that rides along on import)
  const bundled: string[] = [];
  if (fs.existsSync(path.join(srcDir, 'SKILL.md'))) {
    const skillDest = path.join(destDir, 'skills', spec.srcSkill);
    fs.mkdirSync(skillDest, { recursive: true });
    fs.copyFileSync(path.join(srcDir, 'SKILL.md'), path.join(skillDest, 'SKILL.md'));
    bundled.push(`skills/${spec.srcSkill}/SKILL.md`);
  }
  for (const sub of ['assets', 'references']) {
    if (fs.existsSync(path.join(srcDir, sub))) { copyDir(path.join(srcDir, sub), path.join(destDir, sub)); bundled.push(`${sub}/`); }
  }
  for (const f of ['example.html', 'example.md']) {
    if (fs.existsSync(path.join(srcDir, f))) { fs.copyFileSync(path.join(srcDir, f), path.join(destDir, `reference-${f}`)); bundled.push(`reference-${f}`); }
  }

  fs.writeFileSync(path.join(destDir, 'DESIGN.md'), designMd(spec, palette, bundled));

  // manifest with provenance + per-look craft tuning
  fs.writeFileSync(
    path.join(destDir, 'manifest.json'),
    manifestJson(spec.id, spec.name, {
      category: spec.category,
      description: spec.description,
      surface: spec.surface,
      craft: spec.craft,
      source: { type: 'open-design', skill: spec.srcSkill, upstream: spec.upstream, license: 'Apache-2.0' },
      files: { design: 'DESIGN.md', tokens: 'tokens.css' },
    }),
  );

  // reuse atelier primitives, re-skinned by the tokens above
  scaffoldPrimitives(paths, `_vendor/open-design/${spec.id}`, 'atelier');

  return { status: `OK   ${spec.id}  (${bundled.length} bundled)`, entry: catalogEntry(spec) };
}

function catalogEntry(spec: BaseSpec): Record<string, unknown> {
  return {
    id: spec.id,
    ref: `open-design/${spec.id}`,
    name: spec.name,
    category: spec.category,
    surface: spec.surface,
    description: spec.description,
    source: { type: 'open-design', skill: spec.srcSkill, upstream: spec.upstream, license: 'Apache-2.0' },
  };
}

function main(): void {
  fs.mkdirSync(basesDir, { recursive: true });
  const specs = only.size ? BASES.filter((b) => only.has(b.id)) : BASES;
  const entries: Record<string, unknown>[] = [];
  for (const spec of specs) {
    const { status, entry } = convert(spec);
    console.log(status);
    if (entry) entries.push(entry);
  }
  // Refresh the catalog from ALL on-disk bases so a filtered run still produces a complete index.
  const all = only.size
    ? mergeCatalog(entries)
    : entries;
  fs.writeFileSync(
    path.join(basesDir, 'catalog.json'),
    JSON.stringify({ generatedFrom: 'skills/_vendor/open-design', schemaVersion: 'od-base-catalog/v1', bases: all }, null, 2) + '\n',
  );
  console.log(`\ncatalog.json → ${all.length} bases under design-systems/_vendor/open-design/`);
}

function mergeCatalog(updated: Record<string, unknown>[]): Record<string, unknown>[] {
  let existing: Record<string, unknown>[] = [];
  try { existing = JSON.parse(fs.readFileSync(path.join(basesDir, 'catalog.json'), 'utf8')).bases ?? []; } catch { /* none */ }
  const byId = new Map(existing.map((b) => [b.id as string, b]));
  for (const e of updated) byId.set(e.id as string, e);
  return [...byId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

main();
