import type { Graph } from '../graph.js';
import { lineAt } from './util.js';

/**
 * Parse `[data-theme="x"] { … }` override blocks → `theme` nodes + `overrides` edges (theme → token).
 * The token nodes themselves come from the `:root` declarations (addTokens); this adds the theming layer
 * the schema always supported but nothing populated.
 */
export function addThemes(g: Graph, dsId: string, tokensCss: string, fileId: string): void {
  const blockRe = /\[data-theme=["']?([a-z0-9-]+)["']?\]\s*\{([\s\S]*?)\}/gi;
  let b: RegExpExecArray | null;
  while ((b = blockRe.exec(tokensCss))) {
    const theme = b[1];
    const themeId = `${dsId}/theme/${theme}`;
    g.addNode(themeId, 'theme', { name: theme, source: { file: fileId, line: lineAt(tokensCss, b.index) } });
    g.addEdge(dsId, 'contains', themeId);
    const declRe = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let d: RegExpExecArray | null;
    while ((d = declRe.exec(b[2]))) {
      g.addEdge(themeId, 'overrides', `${dsId}/--${d[1]}`, { value: d[2].trim() });
    }
  }
}
