import type { Graph } from '../graph.js';
import { firstFontFamily, isSingleColor, lineAt, tokenKind } from './util.js';

/**
 * Parse tokens.css → token nodes (+ color and typeface nodes), with provenance.
 * `dsId` namespaces ids; `fileId` is the tokens.css file node id (already added).
 */
export function addTokens(g: Graph, dsId: string, tokensCss: string, fileId: string): void {
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tokensCss))) {
    const name = m[1];
    const value = m[2].trim();
    const line = lineAt(tokensCss, m.index);
    const kind = tokenKind(name);
    const tokenId = `${dsId}/--${name}`;
    g.addNode(tokenId, 'token', { name: `--${name}`, kind, value, source: { file: fileId, line } });
    g.addEdge(dsId, 'contains', tokenId);
    g.addEdge(tokenId, 'declaredIn', fileId, { line });

    if (kind === 'color' && isSingleColor(value)) {
      const colorId = `${dsId}/${value.toLowerCase()}`;
      g.addNode(colorId, 'color', { value: value.toLowerCase() });
      g.addEdge(tokenId, 'tokenValue', colorId);
    }

    if (kind === 'type' && name.startsWith('font-')) {
      const family = firstFontFamily(value);
      if (family) {
        const faceId = `${dsId}/face/${family}`;
        g.addNode(faceId, 'typeface', { family, role: name.replace('font-', '') });
        g.addEdge(tokenId, 'usesFont', faceId);
      }
    }
  }
}
