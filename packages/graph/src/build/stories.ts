import { Project, SyntaxKind } from 'ts-morph';
import type { Graph } from '../graph.js';

export interface StoryFile {
  absPath: string;
  fileId: string;
  /** basename without `.stories.tsx`, used to resolve the owning primitive/artifact. */
  base: string;
}

/**
 * Parse `*.stories.tsx` → a `story` node per CSF export, linked `storyOf` to its owning
 * primitive (`<ds>/<base>`) or artifact (`art/<base>`) when present.
 */
export function addStories(g: Graph, dsId: string, files: StoryFile[]): void {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  for (const f of files) {
    const sf = project.addSourceFileAtPath(f.absPath);

    // meta.title from the default-exported object's `title` property.
    let title = f.base;
    const def = sf.getExportAssignment((d) => !d.isExportEquals());
    const ident = def?.getExpression().asKind(SyntaxKind.Identifier);
    const metaDecl = ident ? sf.getVariableDeclaration(ident.getText()) : undefined;
    const metaObj = metaDecl?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
    const titleProp = metaObj?.getProperty('title')?.asKind(SyntaxKind.PropertyAssignment);
    if (titleProp) title = titleProp.getInitializer()?.getText().replace(/['"]/g, '') ?? title;

    const ownerId = g.has(`${dsId}/${f.base}`)
      ? `${dsId}/${f.base}`
      : g.has(`art/${f.base}`)
        ? `art/${f.base}`
        : null;

    // Named exports that are StoryObj-ish (skip the default meta).
    for (const sym of sf.getExportSymbols()) {
      const name = sym.getName();
      if (name === 'default') continue;
      const storyId = `${dsId}/${f.base}.stories#${name}`;
      g.addNode(storyId, 'story', { title, exportName: name, source: { file: f.fileId } });
      g.addEdge(storyId, 'declaredIn', f.fileId);
      if (ownerId) g.addEdge(storyId, 'storyOf', ownerId);
    }
  }
}
