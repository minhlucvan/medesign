import fs from 'node:fs';
import path from 'node:path';
import { buildGraph, loadGraph, saveGraph, type GraphParser } from '@medesign/graph';
import { DesignSystem, type RawAssets } from '../domain/designSystem.js';

export interface RepoConfig {
  /** Absolute path to the design-systems/ directory. */
  designSystemsDir: string;
  /** Repo-level skills dir (optional) for skill nodes. */
  skillsDir?: string;
  /** Whether the active framework adapter parses component code (AST) or metadata-only. */
  parseCode?: boolean;
  /** Component file extension to scan. */
  componentExt?: string;
  /** Plugin-contributed graph parsers (e.g. plugin-css) run during buildGraph. */
  parsers?: GraphParser[];
  /** Class→role map for class→role extraction. */
  classRoles?: Record<string, string>;
}

function read(file: string): string {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

/** Content fingerprint for cache invalidation (mtimes of the system's source files). */
function fingerprint(dir: string): string {
  const parts: string[] = [];
  const stat = (p: string) => { try { return String(fs.statSync(p).mtimeMs); } catch { return '0'; } };
  for (const f of ['DESIGN.md', 'tokens.css', 'manifest.json', 'graph.json']) parts.push(`${f}:${stat(path.join(dir, f))}`);
  const codeDir = path.join(dir, 'code');
  try {
    for (const n of fs.readdirSync(codeDir).sort()) parts.push(`code/${n}:${stat(path.join(codeDir, n))}`);
  } catch { /* no code dir */ }
  return parts.join('|');
}

/** Loads design systems into the domain aggregate, with content-hash caching. */
export class Repository {
  private cache = new Map<string, { fp: string; ds: DesignSystem }>();

  constructor(private cfg: RepoConfig) {}

  dir(id: string): string {
    return path.join(this.cfg.designSystemsDir, id);
  }

  exists(id: string): boolean {
    return fs.existsSync(path.join(this.dir(id), 'DESIGN.md'));
  }

  list(): Array<{ id: string; name: string }> {
    try {
      return fs.readdirSync(this.cfg.designSystemsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('_') && fs.existsSync(path.join(this.cfg.designSystemsDir, e.name, 'DESIGN.md')))
        .map((e) => {
          const md = read(path.join(this.cfg.designSystemsDir, e.name, 'DESIGN.md'));
          return { id: e.name, name: md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? e.name };
        });
    } catch { return []; }
  }

  /** Load a design system aggregate (cached unless its files changed). */
  load(id: string, opts: { fresh?: boolean } = {}): DesignSystem {
    const dir = this.dir(id);
    if (!this.exists(id)) throw new Error(`Design system '${id}' not found at ${dir}`);
    const fp = fingerprint(dir);
    const cached = this.cache.get(id);
    if (!opts.fresh && cached && cached.fp === fp) return cached.ds;

    const graphFile = path.join(dir, 'graph.json');
    const graph = fs.existsSync(graphFile)
      ? loadGraph(graphFile)
      : buildGraph(dir, id, { skillsDir: this.cfg.skillsDir, parseCode: this.cfg.parseCode, componentExt: this.cfg.componentExt, parsers: this.cfg.parsers, classRoles: this.cfg.classRoles });

    const assets: RawAssets = {
      designMd: read(path.join(dir, 'DESIGN.md')),
      tokensCss: read(path.join(dir, 'tokens.css')),
      manifest: (() => { try { return JSON.parse(read(path.join(dir, 'manifest.json')) || '{}'); } catch { return {}; } })(),
    };
    const ds = new DesignSystem(id, graph, assets);
    this.cache.set(id, { fp, ds });
    return ds;
  }

  /** Rebuild + persist the graph for a system (and refresh the cache). */
  rebuild(id: string): DesignSystem {
    const dir = this.dir(id);
    const graph = buildGraph(dir, id, { skillsDir: this.cfg.skillsDir, parseCode: this.cfg.parseCode, componentExt: this.cfg.componentExt, parsers: this.cfg.parsers, classRoles: this.cfg.classRoles });
    saveGraph(graph, path.join(dir, 'graph.json'));
    this.cache.delete(id);
    return this.load(id, { fresh: true });
  }

  invalidate(id?: string): void {
    if (id) this.cache.delete(id); else this.cache.clear();
  }
}
