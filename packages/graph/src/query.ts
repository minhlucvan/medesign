import type { Graph, EdgeQuery, NodeQuery } from './graph.js';
import type { EdgeLabel, GNode, Provenance } from './schema.js';

/** "file:line" provenance string for a node, if known. */
export function srcOf(node?: GNode): string | undefined {
  const s = node?.props.source as Provenance | undefined;
  if (!s) return undefined;
  return s.line ? `${s.file}:${s.line}` : s.file;
}

// Edges that mean "B depends on A" — reverse-traverse them to find what's affected by A.
const AFFECT_EDGES: EdgeLabel[] = ['uses', 'references', 'composes', 'tokenValue', 'hasVariant', 'hasState', 'storyOf', 'overrides'];

export interface Affected {
  id: string;
  label: string;
  name?: string;
  depth: number;
  via: EdgeLabel[];
  source?: string;
}

/** Impact propagation: everything that transitively depends on `nodeId`. */
export function findAffected(g: Graph, nodeId: string): Affected[] {
  if (!g.has(nodeId)) return [];
  return g
    .traverse(nodeId, { direction: 'in', edgeLabels: AFFECT_EDGES })
    .map((r) => ({
      id: r.node.id,
      label: r.node.label,
      name: r.node.props.name as string | undefined,
      depth: r.depth,
      via: r.path.map((e) => e.label),
      source: srcOf(r.node),
    }));
}

export interface FixLocation {
  what: string;
  where?: string;
}
export interface WhereToFix {
  artifact: string;
  finding: string;
  severity?: string;
  message?: string;
  remediation?: string;
  fixLocations: FixLocation[];
}

/** Localization: given an artifact + a finding, return concrete fixes with file:line. */
export function whereToFix(g: Graph, artifactId: string, findingId: string): WhereToFix | null {
  const ruleId = `rule/${findingId}`;
  const violation = g.edges({ label: 'violates', from: artifactId, to: ruleId })[0];
  const rule = g.node(ruleId);
  if (!rule) return null;
  const remediation = rule.props.remediation as { text?: string; tokenRole?: string; sectionHint?: string } | undefined;

  const fixLocations: FixLocation[] = [];
  // (1) where the offending code is.
  const vsrc = violation?.props.source as Provenance | undefined;
  const at = vsrc ? (vsrc.line ? `${vsrc.file}:${vsrc.line}` : vsrc.file) : srcOf(g.node(artifactId));
  if (at) fixLocations.push({ what: 'offending code', where: at });

  // (2) the canonical token role to use, + where it's defined.
  if (remediation?.tokenRole) {
    const token = g.node(`${g.designSystem}/--${remediation.tokenRole}`);
    if (token) {
      fixLocations.push({ what: `use token --${remediation.tokenRole}`, where: srcOf(token) });
      const def = g.out(token.id, 'definedIn')[0];
      const section = def && g.node(def.to);
      if (section) fixLocations.push({ what: `spec: ${section.props.title}`, where: srcOf(section) });
    }
  }

  return {
    artifact: artifactId,
    finding: findingId,
    severity: (violation?.props.severity as string) ?? (rule.props.severity as string),
    message: rule.props.message as string,
    remediation: remediation?.text,
    fixLocations,
  };
}

export interface ConsistencyBrief {
  building: string;
  intent?: string;
  composablePrimitives: string[];
  tokensByKind: Record<string, string[]>;
  governingRules: Array<{ id: string; severity: string; message: string }>;
  vibe: Array<{ section: string; where?: string }>;
}

/** Build-new, on-system: the primitives, tokens, rules, and vibe relevant to a new component. */
export function consistencyBrief(g: Graph, opts: { name: string; intent?: string }): ConsistencyBrief {
  const tokensByKind: Record<string, string[]> = {};
  for (const t of g.nodes({ label: 'token' })) {
    const kind = String(t.props.kind ?? 'other');
    (tokensByKind[kind] ??= []).push(String(t.props.name));
  }
  const vibeTitles = /visual theme|atmosphere|anti-pattern|component/i;
  return {
    building: opts.name,
    intent: opts.intent,
    composablePrimitives: g.nodes({ label: 'primitive' }).map((p) => String(p.props.name)),
    tokensByKind,
    governingRules: g
      .nodes({ label: 'rule' })
      .map((r) => ({ id: String(r.props.ruleId), severity: String(r.props.severity), message: String(r.props.message) }))
      .sort((a, b) => a.severity.localeCompare(b.severity)),
    vibe: g
      .nodes({ label: 'section' })
      .filter((s) => vibeTitles.test(String(s.props.title)))
      .map((s) => ({ section: String(s.props.title), where: srcOf(s) })),
  };
}

export interface Context {
  node: { id: string; label: string; props: Record<string, unknown> };
  out: Array<{ label: EdgeLabel; to: string; toLabel?: string }>;
  in: Array<{ label: EdgeLabel; from: string; fromLabel?: string }>;
}

/** Rich neighborhood of a node for prompt injection. */
export function getContext(g: Graph, nodeId: string): Context | null {
  const node = g.node(nodeId);
  if (!node) return null;
  return {
    node: { id: node.id, label: node.label, props: node.props },
    out: g.out(nodeId).map((e) => ({ label: e.label, to: e.to, toLabel: g.node(e.to)?.label })),
    in: g.in(nodeId).map((e) => ({ label: e.label, from: e.from, fromLabel: g.node(e.from)?.label })),
  };
}

/** Generic property-filtered query over nodes or edges. */
export function query(g: Graph, q: { label?: string; where?: Record<string, unknown>; edgeLabel?: string; from?: string; to?: string }) {
  if (q.edgeLabel || q.from || q.to) {
    return g.edges({ label: q.edgeLabel as any, from: q.from, to: q.to, where: q.where } as EdgeQuery);
  }
  return g.nodes({ label: q.label as any, where: q.where } as NodeQuery);
}
