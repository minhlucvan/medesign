import path from 'node:path';
import { Project } from 'ts-morph';
import type { Graph } from '../graph.js';
import { RULES_BY_ID } from '../rules.js';
import { extractTokenRoles } from './primitives.js';

/** Minimal finding shape (the caller — backend — runs the real linter and passes these). */
export interface GraphFinding {
  id: string;
  severity?: string;
  snippet?: string;
  line?: number;
}

export interface OverlayOpts {
  status?: 'generated' | 'captured';
  findings?: GraphFinding[];
  /** Optional `*.stories.tsx` path to attach as a story. */
  storyFile?: string;
  /** Optional playbook/spec overlay: links the change's intent → this artifact (`produces`). */
  intent?: { slug: string; title: string; file?: string };
}

/**
 * Overlay a generated/captured artifact onto the graph: `composes` to `@ds` primitives,
 * `references` to tokens, and `violates` edges from supplied lint findings.
 */
export function overlayArtifact(g: Graph, dsId: string, artifactFile: string, fileId: string, opts: OverlayOpts = {}): string {
  const name = path.basename(artifactFile).replace(/\.tsx$/, '');
  const id = `art/${name}`;
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sf = project.addSourceFileAtPath(artifactFile);
  const text = sf.getFullText();

  g.addNode(fileId, 'file', { path: fileId, type: 'component' });
  g.addNode(id, 'artifact', { name, status: opts.status ?? 'generated', source: { file: fileId } });
  g.addEdge(id, 'declaredIn', fileId);

  // composes ← named imports from '@ds'
  for (const imp of sf.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue() !== '@ds') continue;
    for (const named of imp.getNamedImports()) {
      const primId = `${dsId}/${named.getName()}`;
      if (g.has(primId)) g.addEdge(id, 'composes', primId);
    }
  }

  // references ← token roles used directly
  for (const role of extractTokenRoles(text)) {
    const tokenId = `${dsId}/--${role}`;
    if (g.has(tokenId)) g.addEdge(id, 'references', tokenId);
  }

  // violates ← supplied lint findings
  for (const f of opts.findings ?? []) {
    const ruleId = `rule/${f.id}`;
    if (!g.has(ruleId)) {
      const def = RULES_BY_ID[f.id];
      g.addNode(ruleId, 'rule', {
        ruleId: f.id,
        severity: f.severity ?? def?.severity ?? 'P1',
        message: def?.message ?? f.id,
        remediation: def?.remediation,
      });
    }
    g.addEdge(id, 'violates', ruleId, { severity: f.severity, snippet: f.snippet, source: { file: fileId, line: f.line } });
  }

  // intent/playbook overlay: the spec that drove this artifact.
  if (opts.intent) {
    const intentId = `intent/${opts.intent.slug}`;
    g.addNode(intentId, 'intent', { slug: opts.intent.slug, title: opts.intent.title, source: opts.intent.file ? { file: opts.intent.file } : undefined });
    g.addEdge(intentId, 'produces', id);
  }

  if (opts.storyFile) {
    const storyFileId = `${dsId}/generated/${path.basename(opts.storyFile)}`;
    const storyId = `${dsId}/${name}.stories#Default`;
    g.addNode(storyFileId, 'file', { path: storyFileId, type: 'story' });
    g.addNode(storyId, 'story', { exportName: 'Default', source: { file: storyFileId } });
    g.addEdge(storyId, 'storyOf', id);
    g.addEdge(storyId, 'declaredIn', storyFileId);
  }

  return id;
}
