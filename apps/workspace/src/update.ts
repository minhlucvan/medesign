import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAMEWORKS } from './registry.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Canonical template paths (same as install.ts). */
const CLAUDE_TEMPLATE = path.resolve(HERE, '../templates/claude');
const CONFIG_TEMPLATE = path.resolve(HERE, '../templates/medesign.config.template.json');
const STARTER_DS = path.resolve(HERE, '../../../design-systems/atelier');
const STORYBOOK_TEMPLATE_PKG = path.resolve(HERE, '../templates/storybook-package.json');

export interface UpdateOptions {
  /** Workspace root directory (defaults to process.cwd()). */
  targetDir?: string;
  /** Overwrite files even if they appear user-modified. */
  force?: boolean;
  /** Remove workspace files that no longer exist in templates. */
  prune?: boolean;
  /** Report only — don't write anything. */
  dryRun?: boolean;
  /** Also check Storybook scaffold files (read-only report). */
  checkStorybook?: boolean;
}

export interface UpdateEntry {
  /** Path relative to the workspace root. */
  file: string;
  reason: string;
}

export interface UpdateResult {
  added: string[];
  updated: string[];
  skipped: UpdateEntry[];
  removed: string[];
  notes: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walkDir(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) files.push(...walkDir(p));
      else files.push(p);
    }
  } catch { /* permission issues under a dir — skip it */ }
  return files;
}

/** Read a file, returning null on any error. */
function tryRead(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Phase 1 — .claude/ sync
// ---------------------------------------------------------------------------

function syncClaude(targetDir: string, opts: UpdateOptions, result: UpdateResult): void {
  const wsClaude = path.join(targetDir, '.claude');

  // Collect relative-path sets
  const tplFiles = walkDir(CLAUDE_TEMPLATE);
  const tplRel = new Map<string, string>();
  for (const f of tplFiles) tplRel.set(path.relative(CLAUDE_TEMPLATE, f), f);

  const wsFiles = walkDir(wsClaude);
  const wsRel = new Map<string, string>();
  for (const f of wsFiles) wsRel.set(path.relative(wsClaude, f), f);

  // ── New & changed files ──
  for (const [rel, tplPath] of tplRel) {
    const wsPath = path.join(wsClaude, rel);

    if (!wsRel.has(rel)) {
      // New file — always add
      result.added.push(`.claude/${rel}`);
      if (!opts.dryRun) {
        fs.mkdirSync(path.dirname(wsPath), { recursive: true });
        fs.copyFileSync(tplPath, wsPath);
      }
      continue;
    }

    // File exists — compare content
    const tplContent = tryRead(tplPath);
    const wsContent = tryRead(wsPath);
    if (tplContent === null || wsContent === null) continue; // can't stat
    if (tplContent === wsContent) continue; // identical — nothing to do

    if (opts.force) {
      result.updated.push(`.claude/${rel}`);
      if (!opts.dryRun) fs.copyFileSync(tplPath, wsPath);
    } else {
      result.skipped.push({ file: `.claude/${rel}`, reason: 'content differs from template (use --force to overwrite)' });
    }
  }

  // ── Orphan files (in workspace, not in template) ──
  for (const rel of wsRel.keys()) {
    if (!tplRel.has(rel)) {
      if (opts.prune) {
        result.removed.push(`.claude/${rel}`);
        if (!opts.dryRun) fs.unlinkSync(path.join(wsClaude, rel));
      } else {
        result.notes.push(`Orphan in .claude: ${rel} (use --prune to remove)`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 2 — medesign.config.json merge
// ---------------------------------------------------------------------------

function mergeConfig(targetDir: string, opts: UpdateOptions, result: UpdateResult): void {
  const cfgPath = path.join(targetDir, 'medesign.config.json');

  if (!fs.existsSync(cfgPath)) {
    result.notes.push('No medesign.config.json found — cannot merge config. Run `medesign attach` first.');
    return;
  }
  if (!fs.existsSync(CONFIG_TEMPLATE)) {
    result.notes.push('Config template not found (broken install?)');
    return;
  }

  const templateCfg: Record<string, unknown> = JSON.parse(fs.readFileSync(CONFIG_TEMPLATE, 'utf8'));
  const workspaceCfg: Record<string, unknown> = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

  let changed = false;
  for (const [key, value] of Object.entries(templateCfg)) {
    // The template has `__FRAMEWORK__` as a placeholder — don't treat it as a new key
    if (key === 'framework') continue;
    if (!(key in workspaceCfg)) {
      result.notes.push(`Config: added "${key}": ${JSON.stringify(value)}`);
      workspaceCfg[key] = value;
      changed = true;
    }
  }

  if (changed) {
    if (!opts.dryRun) {
      fs.writeFileSync(cfgPath, JSON.stringify(workspaceCfg, null, 2) + '\n');
    }
    result.notes.push('medesign.config.json updated with new template fields.');
  }
}

// ---------------------------------------------------------------------------
// Phase 3 — read-only reports
// ---------------------------------------------------------------------------

function checkAtelier(targetDir: string, result: UpdateResult): void {
  const wsAtelier = path.join(targetDir, 'design-systems', 'atelier');
  if (!fs.existsSync(wsAtelier)) {
    result.notes.push('No design-systems/atelier/ found. Run `medesign attach` to seed the starter design system.');
    return;
  }
  if (!fs.existsSync(STARTER_DS)) return;

  const tplFiles = walkDir(STARTER_DS);
  const wsFiles = walkDir(wsAtelier);

  const tplRel = new Set(tplFiles.map(f => path.relative(STARTER_DS, f)));
  const wsRel = new Set(wsFiles.map(f => path.relative(wsAtelier, f)));

  const missing: string[] = [];
  const differing: string[] = [];

  for (const rel of tplRel) {
    if (!wsRel.has(rel)) {
      missing.push(rel);
    } else {
      const t = tryRead(path.join(STARTER_DS, rel));
      const w = tryRead(path.join(wsAtelier, rel));
      if (t !== null && w !== null && t !== w) differing.push(rel);
    }
  }

  if (missing.length) {
    result.notes.push(`Starter DS (atelier): missing ${missing.length} file(s) (${missing.join(', ')}).`);
  }
  if (differing.length) {
    result.notes.push(`Starter DS (atelier): ${differing.length} file(s) differ from template — likely customized, left untouched.`);
  }
  if (!missing.length && !differing.length) {
    result.notes.push('Starter DS (atelier): up to date.');
  }
}

function checkStorybookTemplates(targetDir: string, result: UpdateResult): void {
  const cfgPath = path.join(targetDir, 'medesign.config.json');
  if (!fs.existsSync(cfgPath)) return;

  let framework = 'react-tailwind';
  try {
    framework = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).framework ?? framework;
  } catch { /* use default */ }

  const entry = FRAMEWORKS[framework];
  if (!entry) {
    result.notes.push(`Storybook: unknown framework "${framework}" — cannot check scaffold.`);
    return;
  }

  const sbTemplates = path.resolve(HERE, entry.providerTemplatesPath);
  if (!fs.existsSync(sbTemplates)) {
    result.notes.push(`Storybook: provider template dir not found (${entry.providerTemplatesPath}).`);
    return;
  }

  for (const tf of walkDir(sbTemplates)) {
    const rel = path.relative(sbTemplates, tf);
    const wf = path.join(targetDir, rel);

    if (!fs.existsSync(wf)) {
      result.notes.push(`Storybook: missing ${rel} (from ${entry.providerPackage} template).`);
    } else {
      const t = tryRead(tf);
      const w = tryRead(wf);
      if (t !== null && w !== null && t !== w) {
        result.notes.push(`Storybook: ${rel} differs from template — review manually.`);
      }
    }
  }
}

function checkPackageJson(targetDir: string, result: UpdateResult): void {
  const wsPkgPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(wsPkgPath)) return;

  // The storybook template's package.json is the canonical list of scripts/deps a workspace should have
  const tplPkgPath = path.resolve(HERE, '../../../apps/workspace-react/templates/storybook/package.json');
  if (!fs.existsSync(tplPkgPath)) return;

  try {
    const wsPkg = JSON.parse(fs.readFileSync(wsPkgPath, 'utf8'));
    const tplPkg = JSON.parse(fs.readFileSync(tplPkgPath, 'utf8'));

    // Scripts
    const tplScripts: Record<string, string> = tplPkg.scripts ?? {};
    const wsScripts: Record<string, string> = wsPkg.scripts ?? {};
    for (const [name, cmd] of Object.entries(tplScripts)) {
      if (!(name in wsScripts)) {
        result.notes.push(`package.json: missing script "${name}": "${cmd}"`);
      } else if (wsScripts[name] !== cmd) {
        result.notes.push(`package.json: script "${name}" differs (workspace: "${wsScripts[name]}", template: "${cmd}")`);
      }
    }

    // @medesign/* devDependencies
    const tplDeps: Record<string, string> = { ...tplPkg.devDependencies, ...tplPkg.dependencies };
    const wsDeps: Record<string, string> = { ...(wsPkg.devDependencies ?? {}), ...(wsPkg.dependencies ?? {}) };
    for (const [dep, ver] of Object.entries(tplDeps)) {
      if (dep.startsWith('@medesign/')) {
        if (!(dep in wsDeps)) {
          result.notes.push(`package.json: missing dep "${dep}": "${ver}"`);
        }
      }
    }

    // Also check for the snapshot test pattern if it's missing
    if (!(tplPkg.scripts?.['test:visual'])) {
      /* fine — only report what the template has */
    }
  } catch { /* malformed package.json — skip */ }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Bring a medesign workspace up to date with the latest canonical templates.
 *
 * Three phases:
 *   1. `.claude/` — add new template files, update changed ones (or skip
 *      if they appear user-modified), optionally remove orphans.
 *   2. `medesign.config.json` — merge in new top-level keys from the template.
 *   3. Read-only reports — atelier starter, Storybook scaffold, package.json.
 */
export function update(opts: UpdateOptions = {}): UpdateResult {
  const targetDir = path.resolve(opts.targetDir ?? process.cwd());
  const result: UpdateResult = { added: [], updated: [], skipped: [], removed: [], notes: [] };

  // Verify this is a medesign workspace (or at least plausible)
  if (!fs.existsSync(path.join(targetDir, 'medesign.config.json'))) {
    result.notes.push(`No medesign.config.json found in ${targetDir} — not a medesign workspace. Run \`medesign init\` or \`medesign attach\` first.`);
    return result;
  }

  // Phase 1 — .claude/
  syncClaude(targetDir, opts, result);

  // Phase 2 — medesign.config.json
  mergeConfig(targetDir, opts, result);

  // Phase 3 — read-only reports
  checkAtelier(targetDir, result);
  checkPackageJson(targetDir, result);

  if (opts.checkStorybook) {
    checkStorybookTemplates(targetDir, result);
  }

  // Summary note if nothing changed
  if (!result.added.length && !result.updated.length && !result.removed.length && !result.skipped.length) {
    result.notes.push('Workspace is up to date with the latest medesign templates.');
  }

  return result;
}
