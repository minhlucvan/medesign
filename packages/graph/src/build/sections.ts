import type { Graph } from '../graph.js';
import { lineAt } from './util.js';

interface Section {
  id: string;
  title: string;
  index: number;
  start: number;
  end: number;
  line: number;
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Structural metrics so doctor rules query data, not re-parse markdown. */
function sectionMetrics(body: string) {
  const rows = body.split('\n').filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:|-]+\|?\s*$/.test(l));
  return {
    tableRows: Math.max(0, rows.length - 1), // minus the header row
    wordCount: body.split(/\s+/).filter(Boolean).length,
    bulletCount: (body.match(/^\s*[-*]\s+\*\*[A-Z][^*]+\*\*/gm) ?? []).length,
    namesStates: /hover|focus|active|disabled|pressed/i.test(body),
  };
}

/**
 * Parse DESIGN.md `## N. Title` H2s → section nodes, then link each token to the section whose
 * body mentions its name or color value (`definedIn`). Tokens must already be in the graph.
 */
export function addSections(g: Graph, dsId: string, designMd: string, fileId: string): void {
  const re = /^##\s+(.+?)\s*$/gm;
  const heads: Array<{ title: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(designMd))) heads.push({ title: m[1].replace(/^\d+\.\s*/, ''), index: m.index });

  const sections: Section[] = heads.map((h, i) => ({
    id: `${dsId}/§${slug(h.title)}`,
    title: h.title,
    index: i + 1,
    start: h.index,
    end: i + 1 < heads.length ? heads[i + 1].index : designMd.length,
    line: lineAt(designMd, h.index),
  }));

  for (const s of sections) {
    const metrics = sectionMetrics(designMd.slice(s.start, s.end));
    g.addNode(s.id, 'section', { title: s.title, index: s.index, ...metrics, source: { file: fileId, line: s.line } });
    g.addEdge(dsId, 'contains', s.id);
    g.addEdge(s.id, 'declaredIn', fileId, { line: s.line });
  }

  // Link tokens → the section whose body mentions the token name or its color value.
  for (const token of g.nodes({ label: 'token' })) {
    const name = String(token.props.name ?? '');
    const value = String(token.props.value ?? '').toLowerCase();
    const hit = sections.find((s) => {
      const body = designMd.slice(s.start, s.end).toLowerCase();
      return body.includes(name.toLowerCase()) || (value.startsWith('#') && body.includes(value));
    });
    if (hit) g.addEdge(token.id, 'definedIn', hit.id);
  }
}
