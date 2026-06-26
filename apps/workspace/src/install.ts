import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAMEWORKS, detectFramework, listFrameworks } from './registry.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLAUDE_TEMPLATE = path.resolve(HERE, '../templates/claude');
const CLAUDE_MD_TEMPLATE = path.resolve(HERE, '../templates/CLAUDE.md');
const CONFIG_TEMPLATE = path.resolve(HERE, '../templates/emdesign.config.template.json');
const STARTER_DS = path.resolve(HERE, '../../../design-systems/atelier');

export interface InstallResult {
  framework: string;
  wrote: string[];
  notes: string[];
}

/** Recursively copy a dir. `overwrite=false` (default) skips files that already exist (opt-in/additive). */
function copyDir(src: string, dest: string, overwrite = false, wrote: string[] = []): string[] {
  if (!fs.existsSync(src)) return wrote;
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d, overwrite, wrote);
    else if (overwrite || !fs.existsSync(d)) {
      fs.copyFileSync(s, d);
      wrote.push(d);
    }
  }
  return wrote;
}

function findStorybookMain(dir: string): string | null {
  const sb = path.join(dir, '.storybook');
  if (!fs.existsSync(sb)) return null;
  for (const f of ['main.ts', 'main.js', 'main.mjs', 'main.cjs']) {
    const p = path.join(sb, f);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function readStorybookFramework(mainPath: string): string {
  const src = fs.readFileSync(mainPath, 'utf8');
  const obj = src.match(/framework:\s*\{[^}]*name:\s*['"]([^'"]+)['"]/);
  const str = src.match(/framework:\s*['"]([^'"]+)['"]/);
  return obj?.[1] ?? str?.[1] ?? 'react';
}

/** Idempotently add @emdesign/addon to a Storybook main's `addons` array. Returns true if changed. */
function addAddonToMain(mainPath: string): boolean {
  let src = fs.readFileSync(mainPath, 'utf8');
  if (src.includes('@emdesign/addon')) return false;
  const m = src.match(/addons:\s*\[/);
  if (!m) return false; // caller prints a manual instruction
  const idx = m.index! + m[0].length;
  src = src.slice(0, idx) + `\n    '@emdesign/addon',` + src.slice(idx);
  fs.writeFileSync(mainPath, src);
  return true;
}

function writeConfig(targetDir: string, framework: string, wrote: string[], notes: string[]): void {
  const cfgPath = path.join(targetDir, 'emdesign.config.json');
  if (fs.existsSync(cfgPath)) {
    notes.push('emdesign.config.json already exists — left untouched.');
    return;
  }
  const cfg = fs.readFileSync(CONFIG_TEMPLATE, 'utf8').replace('__FRAMEWORK__', framework);
  fs.writeFileSync(cfgPath, cfg);
  wrote.push(cfgPath);
}

/**
 * ATTACH (opt-in) — install emdesign into an EXISTING project that already has Storybook.
 * Additive: detects the framework, adds the addon, drops `.claude/`, writes config. Never clobbers.
 */
export function attach(targetDir = process.cwd()): InstallResult {
  const wrote: string[] = [];
  const notes: string[] = [];
  const mainPath = findStorybookMain(targetDir);
  if (!mainPath) {
    throw new Error(
      `No Storybook found in ${targetDir} (.storybook/main.*). Install Storybook first (https://storybook.js.org), then re-run \`emdesign attach\`.`,
    );
  }
  const framework = detectFramework(readStorybookFramework(mainPath));

  if (addAddonToMain(mainPath)) wrote.push(mainPath);
  else if (!fs.readFileSync(mainPath, 'utf8').includes('@emdesign/addon'))
    notes.push(`Could not auto-edit ${mainPath} — add '@emdesign/addon' to its addons array manually.`);

  copyDir(CLAUDE_TEMPLATE, path.join(targetDir, '.claude'), false, wrote);
  // Copy workspace CLAUDE.md if not already present
  const targetClaudeMd = path.join(targetDir, 'CLAUDE.md');
  if (fs.existsSync(CLAUDE_MD_TEMPLATE) && !fs.existsSync(targetClaudeMd)) {
    fs.copyFileSync(CLAUDE_MD_TEMPLATE, targetClaudeMd);
    wrote.push(targetClaudeMd);
  }
  writeConfig(targetDir, framework, wrote, notes);

  const dsDir = path.join(targetDir, 'design-systems');
  if (!fs.existsSync(dsDir)) {
    copyDir(STARTER_DS, path.join(dsDir, 'atelier'), false, wrote);
    notes.push('Seeded a starter design system: design-systems/atelier.');
  }

  notes.push('Next: `npm i -D @emdesign/addon`, run Storybook + `emdesign serve`, then `/mds:design "<idea>"`.');
  return { framework, wrote, notes };
}

/**
 * INIT — scaffold a NEW project for a framework (when there's no Storybook yet). Lays down the
 * provider's Storybook scaffold + `.claude/` + a starter design system + config.
 */
export function init(framework: string, targetDir: string): InstallResult {
  const entry = FRAMEWORKS[framework];
  if (!entry) throw new Error(`Unknown framework "${framework}". Available: ${listFrameworks().join(', ')}.`);
  const wrote: string[] = [];
  const notes: string[] = [];
  fs.mkdirSync(targetDir, { recursive: true });

  const sbTemplates = path.resolve(HERE, entry.providerTemplatesPath);
  if (fs.existsSync(sbTemplates)) copyDir(sbTemplates, targetDir, false, wrote);
  else notes.push(`Provider templates not found for ${framework} (${entry.providerPackage}); .storybook not scaffolded.`);

  copyDir(CLAUDE_TEMPLATE, path.join(targetDir, '.claude'), false, wrote);
  // Copy workspace CLAUDE.md if not already present
  const targetClaudeMd = path.join(targetDir, 'CLAUDE.md');
  if (fs.existsSync(CLAUDE_MD_TEMPLATE) && !fs.existsSync(targetClaudeMd)) {
    fs.copyFileSync(CLAUDE_MD_TEMPLATE, targetClaudeMd);
    wrote.push(targetClaudeMd);
  }
  copyDir(STARTER_DS, path.join(targetDir, 'design-systems', 'atelier'), false, wrote);
  writeConfig(targetDir, framework, wrote, notes);

  if (!entry.implemented) notes.push(`Note: the ${framework} adapter is a stub — rule-based lint/parse is best-effort; the visual+vision+gate loop still runs.`);
  notes.push('Next: `npm i`, run Storybook + `emdesign serve`, then `/mds:design "<idea>"`.');
  return { framework, wrote, notes };
}
