import type { EdgeLabel, GEdge, GNode, GraphJSON, NodeLabel, Props } from './schema.js';

export type Where = Record<string, unknown>;

export interface NodeQuery {
  label?: NodeLabel;
  where?: Where;
}
export interface EdgeQuery {
  label?: EdgeLabel;
  from?: string;
  to?: string;
  where?: Where;
}

export interface TraverseOpts {
  edgeLabels?: EdgeLabel[];
  direction?: 'out' | 'in';
  maxDepth?: number;
}

export interface Reached {
  node: GNode;
  depth: number;
  /** Edge labels followed from the start to here. */
  path: GEdge[];
}

/** Shallow property match: every key in `where` must equal the node/edge prop. */
function matchWhere(props: Props, where?: Where): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => (props as Record<string, unknown>)[k] === v);
}

/** A labeled property graph with property-filtered queries and edge-typed traversal. */
export class Graph {
  readonly designSystem: string;
  private nodesById = new Map<string, GNode>();
  private edgeList: GEdge[] = [];
  private outAdj = new Map<string, GEdge[]>();
  private inAdj = new Map<string, GEdge[]>();

  constructor(designSystem: string) {
    this.designSystem = designSystem;
  }

  /** Add or merge a node (props shallow-merged on repeat ids). */
  addNode(id: string, label: NodeLabel, props: Props = {}): GNode {
    const existing = this.nodesById.get(id);
    if (existing) {
      existing.props = { ...existing.props, ...props };
      return existing;
    }
    const node: GNode = { id, label, props };
    this.nodesById.set(id, node);
    return node;
  }

  /** Add an edge (deduped by from|label|to). Silently ignores edges to/from missing nodes. */
  addEdge(from: string, label: EdgeLabel, to: string, props: Props = {}): GEdge | null {
    if (!this.nodesById.has(from) || !this.nodesById.has(to)) return null;
    const id = `${from}|${label}|${to}`;
    const dup = this.edgeList.find((e) => e.id === id);
    if (dup) {
      dup.props = { ...dup.props, ...props };
      return dup;
    }
    const edge: GEdge = { id, label, from, to, props };
    this.edgeList.push(edge);
    (this.outAdj.get(from) ?? this.outAdj.set(from, []).get(from)!).push(edge);
    (this.inAdj.get(to) ?? this.inAdj.set(to, []).get(to)!).push(edge);
    return edge;
  }

  has(id: string): boolean {
    return this.nodesById.has(id);
  }
  node(id: string): GNode | undefined {
    return this.nodesById.get(id);
  }

  /** Property-filtered node query. */
  nodes(q: NodeQuery = {}): GNode[] {
    const all = [...this.nodesById.values()];
    return all.filter((n) => (!q.label || n.label === q.label) && matchWhere(n.props, q.where));
  }

  /** Property-filtered edge query. */
  edges(q: EdgeQuery = {}): GEdge[] {
    return this.edgeList.filter(
      (e) =>
        (!q.label || e.label === q.label) &&
        (!q.from || e.from === q.from) &&
        (!q.to || e.to === q.to) &&
        matchWhere(e.props, q.where),
    );
  }

  out(id: string, ...labels: EdgeLabel[]): GEdge[] {
    const es = this.outAdj.get(id) ?? [];
    return labels.length ? es.filter((e) => labels.includes(e.label)) : es;
  }
  in(id: string, ...labels: EdgeLabel[]): GEdge[] {
    const es = this.inAdj.get(id) ?? [];
    return labels.length ? es.filter((e) => labels.includes(e.label)) : es;
  }

  /** BFS over typed edges, returning every reached node with its depth + edge path. */
  traverse(startId: string, opts: TraverseOpts = {}): Reached[] {
    const { edgeLabels, direction = 'out', maxDepth = Infinity } = opts;
    const seen = new Set<string>([startId]);
    const out: Reached[] = [];
    let frontier: Array<{ id: string; path: GEdge[] }> = [{ id: startId, path: [] }];
    for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
      const next: Array<{ id: string; path: GEdge[] }> = [];
      for (const { id, path } of frontier) {
        const edges = direction === 'out' ? this.out(id) : this.in(id);
        for (const e of edges) {
          if (edgeLabels && !edgeLabels.includes(e.label)) continue;
          const nextId = direction === 'out' ? e.to : e.from;
          if (seen.has(nextId)) continue;
          seen.add(nextId);
          const node = this.nodesById.get(nextId);
          const nextPath = [...path, e];
          if (node) out.push({ node, depth, path: nextPath });
          next.push({ id: nextId, path: nextPath });
        }
      }
      frontier = next;
    }
    return out;
  }

  toJSON(): GraphJSON {
    return { designSystem: this.designSystem, nodes: [...this.nodesById.values()], edges: this.edgeList };
  }

  static fromJSON(json: GraphJSON): Graph {
    const g = new Graph(json.designSystem);
    for (const n of json.nodes) g.addNode(n.id, n.label, n.props);
    for (const e of json.edges) g.addEdge(e.from, e.label, e.to, e.props);
    return g;
  }

  stats(): Record<string, number> {
    const s: Record<string, number> = { nodes: this.nodesById.size, edges: this.edgeList.length };
    for (const n of this.nodesById.values()) s[`node:${n.label}`] = (s[`node:${n.label}`] ?? 0) + 1;
    for (const e of this.edgeList) s[`edge:${e.label}`] = (s[`edge:${e.label}`] ?? 0) + 1;
    return s;
  }
}
