import fs from 'node:fs';
import path from 'node:path';
import { Graph } from '../graph.js';
import { RULES } from '../rules.js';
import { addTokens } from './tokens.js';
import { addThemes } from './themes.js';
import { addSections } from './sections.js';
import { addPrimitives, type CodeFile } from './primitives.js';
import { addStories, type StoryFile } from './stories.js';

export { overlayArtifact } from './artifact.js';
export type { GraphFinding, OverlayOpts } from './artifact.js';

function fileType(rel: string): string {
  if (rel.endsWith('tokens.css')) return 'tokens';
  if (rel.endsWith('DESIGN.md')) return 'design';
  if (rel.endsWith('manifest.json')) return 'manifest';
  if (rel.endsWith('.stories.tsx')) return 'story';
  if (rel.endsWith('.tsx')) return 'component';
  return 'asset';
}

/** Inputs a plugin-contributed graph parser receives. */
export interface GraphParseCtx {
  dsDir: string;
  tokensCss: string;
  designMd: string;
  root: string;
}
/** A plugin-contributed parser: reads the design system's sources and emits nodes/edges (any label). */
export type GraphParser = (g: Graph, dsId: string, ctx: GraphParseCtx) => void;

export interface BuildOpts {
  /** Repo-level skills dir containing per-skill SKILL.md files, indexed as `skill` nodes. */
  skillsDir?: string;
  /**
   * Parse component source with the AST parser (true, default) or build primitives from metadata
   * only — filenames, no code wiring — for frameworks whose adapter doesn't parse code yet.
   */
  parseCode?: boolean;
  /** Component file extension to scan (default '.tsx'). Stub frameworks pass e.g. '.vue'. */
  componentExt?: string;
  /** Plugin-contributed parsers (e.g. plugin-css) that emit tokens/themes/colors + new node types. */
  parsers?: GraphParser[];
  /** Utility-suffix → token-role map (from the styling plugin) used by class→role extraction. */
  classRoles?: Record<string, string>;
}

/** Metadata-only primitives: a node per component file, no props/variants/token-usage (no AST). */
function addPrimitivesFromMetadata(g: Graph, dsId: string, code: CodeFile[]): void {
  for (const f of code) {
    const name = path.basename(f.absPath).replace(/\.[^.]+$/, '');
    const id = `${dsId}/${name}`;
    g.addNode(id, 'primitive', { name, source: { file: f.fileId }, parsedFrom: 'metadata' });
    g.addEdge(dsId, 'contains', id);
    g.addEdge(id, 'declaredIn', f.fileId);
  }
}

/** Build the full property graph for a design system folder. */
export function buildGraph(dsDir: string, dsId: string, opts: BuildOpts = {}): Graph {
  const g = new Graph(dsId);
  g.addNode(dsId, 'designSystem', { name: dsId, source: { file: `${dsId}/` } });

  // 1. file nodes (the complete index)
  const entries = fs.readdirSync(dsDir, { recursive: true, withFileTypes: true }) as fs.Dirent[];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const abs = path.join((e as any).parentPath ?? (e as any).path ?? dsDir, e.name);
    const rel = path.relative(dsDir, abs).split(path.sep).join('/');
    const fileId = `${dsId}/${rel}`;
    g.addNode(fileId, 'file', { path: rel, type: fileType(rel), source: { file: fileId } });
    g.addEdge(dsId, 'contains', fileId);
  }

  const read = (rel: string) => {
    try { return fs.readFileSync(path.join(dsDir, rel), 'utf8'); } catch { return ''; }
  };

  const tokensCss = read('tokens.css');
  const designMd = read('DESIGN.md');

  // 2. plugin parsers (e.g. plugin-css) emit tokens/themes/colors + plugin-specific node types.
  for (const parser of opts.parsers ?? []) parser(g, dsId, { dsDir, tokensCss, designMd, root: dsDir });

  // Fallback: built-in CSS parsing only if no parser populated token nodes (keeps the graph
  // non-empty when no styling plugin is in the stack).
  if (g.nodes({ label: 'token' }).length === 0 && tokensCss) {
    addTokens(g, dsId, tokensCss, `${dsId}/tokens.css`);
    addThemes(g, dsId, tokensCss, `${dsId}/tokens.css`);
  }

  // 3. sections + token→section links (tokens must already exist)
  if (designMd) addSections(g, dsId, designMd, `${dsId}/DESIGN.md`);

  // 4. primitives + 5. stories
  const parseCode = opts.parseCode !== false;
  const ext = opts.componentExt ?? '.tsx';
  const codeDir = path.join(dsDir, 'code');
  const code: CodeFile[] = [];
  const stories: StoryFile[] = [];
  if (fs.existsSync(codeDir)) {
    for (const name of fs.readdirSync(codeDir)) {
      const storyMatch = name.match(/\.stories\.(t|j)sx?$/);
      if (storyMatch) {
        stories.push({ absPath: path.join(codeDir, name), fileId: `${dsId}/code/${name}`, base: name.replace(/\.stories\.(t|j)sx?$/, '') });
      } else if (name.endsWith(ext) && /^[A-Z]/.test(name)) {
        code.push({ absPath: path.join(codeDir, name), fileId: `${dsId}/code/${name}` });
      }
    }
  }
  if (parseCode) {
    // AST parse (real wiring) — only valid for adapters that implement it (e.g. react-tailwind).
    if (code.length) addPrimitives(g, dsId, code, opts.classRoles);
    if (stories.length) addStories(g, dsId, stories);
  } else {
    // Metadata fallback: filenames → primitive nodes; token/section/color layer still comes from regex.
    addPrimitivesFromMetadata(g, dsId, code);
  }

  // 6. documentedBy: link primitives → the Components section
  const componentsSection = g.nodes({ label: 'section' }).find((s) => /component/i.test(String(s.props.title)));
  if (componentsSection) for (const p of g.nodes({ label: 'primitive' })) g.addEdge(p.id, 'documentedBy', componentsSection.id);

  // 7. rule nodes + governs (skip exemptions)
  const manifest = safeJson(read('manifest.json'));
  const exemptions: string[] = manifest?.craft?.exemptions ?? [];
  for (const r of RULES) {
    if (exemptions.includes(r.id)) continue;
    const rid = `rule/${r.id}`;
    g.addNode(rid, 'rule', { ruleId: r.id, severity: r.severity, message: r.message, appliesTo: r.appliesTo, remediation: r.remediation });
    const targets = r.appliesTo === 'headings'
      ? g.nodes({ label: 'primitive' }).filter((p) => /heading/i.test(String(p.props.name)))
      : g.nodes({ label: 'primitive' });
    for (const t of targets) g.addEdge(rid, 'governs', t.id);
  }

  // 8. skills (optional, repo-level)
  if (opts.skillsDir) addSkills(g, opts.skillsDir);

  return g;
}

function addSkills(g: Graph, skillsDir: string): void {
  if (!fs.existsSync(skillsDir)) return;
  for (const name of fs.readdirSync(skillsDir)) {
    const md = path.join(skillsDir, name, 'SKILL.md');
    if (!fs.existsSync(md)) continue;
    const src = fs.readFileSync(md, 'utf8');
    const fm = src.match(/^---\n([\s\S]*?)\n---/);
    const get = (k: string) => fm?.[1].match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1]?.trim();
    const id = `skill/${name}`;
    g.addNode(id, 'skill', { name, mode: get('mode'), scenario: get('scenario'), source: { file: `skills/${name}/SKILL.md` } });
  }
}

function safeJson(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}
