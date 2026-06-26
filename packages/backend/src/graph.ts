import fs from 'node:fs';
import path from 'node:path';
import {
  buildGraph,
  overlayArtifact,
  saveGraph,
  loadGraph,
  type Graph,
  type GraphFinding,
} from '@medesign/graph';
import type { RepoPaths } from './paths.js';
import { resolveDesignSystem } from './designContext.js';
import { effectiveAdapter } from './adapters/index.js';

function dsDir(paths: RepoPaths, id: string): string {
  return path.join(paths.designSystemsDir, id);
}
function graphFile(paths: RepoPaths, id: string): string {
  return path.join(dsDir(paths, id), 'graph.json');
}

/** Build opts derived from the project's framework adapter (AST parse vs metadata-only fallback). */
function buildOpts(paths: RepoPaths) {
  const adapter = effectiveAdapter(paths);
  return {
    skillsDir: path.join(paths.root, 'skills'),
    parseCode: adapter.parsesCode,
    componentExt: adapter.fileExt,
    parsers: adapter.graphParsers(),
    classRoles: adapter.classRoles(),
  };
}

/** Build the design-system graph and persist it to design-systems/<id>/graph.json. */
export function buildAndSave(paths: RepoPaths, id: string): Graph {
  const g = buildGraph(dsDir(paths, id), id, buildOpts(paths));
  saveGraph(g, graphFile(paths, id));
  return g;
}

/** Load the cached graph if present, else build (without forcing a save). */
export function loadOrBuild(paths: RepoPaths, id: string): Graph {
  const file = graphFile(paths, id);
  if (fs.existsSync(file)) return loadGraph(file);
  return buildGraph(dsDir(paths, id), id, buildOpts(paths));
}

/** kebab-case a PascalCase component name → the design/changes/<slug> dir. */
function slugOf(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Read the change's intent (the "playbook" overlay), if present. */
function readIntent(paths: RepoPaths, name: string): { slug: string; title: string; file: string } | undefined {
  const slug = slugOf(name);
  const file = path.join(paths.root, 'design', 'changes', slug, 'intent.md');
  try {
    const src = fs.readFileSync(file, 'utf8');
    const title = src.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? src.split('\n').find((l) => l.trim())?.trim() ?? slug;
    return { slug, title, file: `design/changes/${slug}/intent.md` };
  } catch {
    return undefined;
  }
}

/** Overlay a generated component onto the graph, attaching `violates` edges + the intent overlay. */
export function overlayGenerated(g: Graph, paths: RepoPaths, id: string, name: string): string {
  const ext = effectiveAdapter(paths).fileExt;
  const file = path.join(paths.generatedDir, `${name}${ext}`);
  const source = fs.readFileSync(file, 'utf8');
  const ds = resolveDesignSystem(paths, id);
  const findings: GraphFinding[] = effectiveAdapter(paths)
    .lint(source, { declaredTokens: ds.declaredTokens, exemptions: ds.exemptions, bindsDisplayFace: ds.bindsDisplayFace })
    .map((f) => ({ id: f.id, severity: f.severity, snippet: f.snippet }));

  const storyFile = path.join(paths.generatedDir, `${name}.stories.tsx`);
  return overlayArtifact(g, id, file, `${id}/generated/${name}${ext}`, {
    findings,
    storyFile: fs.existsSync(storyFile) ? storyFile : undefined,
    intent: readIntent(paths, name),
  });
}
