import { Graph, findAffected as graphFindAffected, type GNode } from '@medesign/graph';
import type { Provenance, Reference, TokenKind } from './values.js';

export interface RawAssets {
  designMd: string;
  tokensCss: string;
  manifest: Record<string, unknown>;
}

/** Parse declared token role names (without `--`) from a tokens.css string. */
export function parseDeclaredTokens(tokensCss: string): string[] {
  const names = new Set<string>();
  for (const m of tokensCss.matchAll(/--([a-z0-9-]+)\s*:/gi)) names.add(m[1]);
  return [...names];
}

function prov(node?: GNode): Provenance | undefined {
  return node?.props.source as Provenance | undefined;
}

/** A token role within a design system (a typed view over a graph `token` node). */
export class Token {
  constructor(private ds: DesignSystem, readonly node: GNode) {}
  get role(): string {
    return String(this.node.props.name ?? '').replace(/^--/, '');
  }
  get name(): string {
    return String(this.node.props.name ?? '');
  }
  get kind(): TokenKind {
    return (this.node.props.kind as TokenKind) ?? 'layout';
  }
  get value(): string {
    return String(this.node.props.value ?? '');
  }
  get where(): Provenance | undefined {
    return prov(this.node);
  }
  /** Components/variants/artifacts that consume this token (transitive). */
  usages(): Reference[] {
    return this.ds.affected(this.node.id);
  }
}

/** A component/primitive (typed view over a graph `primitive` node). */
export class Component {
  constructor(private ds: DesignSystem, readonly node: GNode) {}
  get name(): string {
    return String(this.node.props.name ?? '');
  }
  get where(): Provenance | undefined {
    return prov(this.node);
  }
  /** Token ids this component uses. */
  uses(): string[] {
    return this.ds.graph.out(this.node.id, 'uses').map((e) => e.to);
  }
  variants(): string[] {
    return this.ds.graph.out(this.node.id, 'hasVariant').map((e) => String(this.ds.graph.node(e.to)?.props.name ?? e.to));
  }
}

/** A theme — token overrides (typed view over `theme` nodes). */
export class Theme {
  constructor(private ds: DesignSystem, readonly node: GNode) {}
  get name(): string {
    return String(this.node.props.name ?? this.node.id);
  }
  overrides(): Array<{ token: string; value: string }> {
    return this.ds.graph.out(this.node.id, 'overrides').map((e) => ({ token: e.to, value: String(e.props.value ?? '') }));
  }
}

export interface ContextView {
  id: string;
  name: string;
  designMd: string;
  tokensCss: string;
  declaredTokens: string[];
  primitives: string[];
  exemptions: string[];
  bindsDisplayFace: boolean;
}

/** A DESIGN.md section + its parsed structural metrics (so rules query data, not markdown). */
export interface SectionView {
  title: string;
  index: number;
  tableRows: number;
  wordCount: number;
  bulletCount: number;
  namesStates: boolean;
  where?: Provenance;
}

/**
 * DesignSystem — the aggregate root. A typed, behaviorful view over a loaded property graph
 * plus the parsed on-disk assets. The graph is the store; this adds domain behavior.
 */
export class DesignSystem {
  constructor(
    readonly id: string,
    readonly graph: Graph,
    readonly assets: RawAssets,
  ) {}

  get name(): string {
    return this.assets.designMd.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? String(this.assets.manifest.name ?? this.id);
  }
  get exemptions(): string[] {
    return ((this.assets.manifest as any)?.craft?.exemptions as string[]) ?? [];
  }
  get declaredTokens(): string[] {
    return parseDeclaredTokens(this.assets.tokensCss);
  }
  get bindsDisplayFace(): boolean {
    return /--font-display\s*:/.test(this.assets.tokensCss);
  }

  tokens(): Token[] {
    return this.graph.nodes({ label: 'token' }).map((n) => new Token(this, n));
  }
  token(role: string): Token | undefined {
    const n = this.graph.node(`${this.id}/--${role.replace(/^--/, '')}`);
    return n ? new Token(this, n) : undefined;
  }
  components(): Component[] {
    return this.graph.nodes({ label: 'primitive' }).map((n) => new Component(this, n));
  }
  component(name: string): Component | undefined {
    const n = this.graph.node(`${this.id}/${name}`);
    return n && n.label === 'primitive' ? new Component(this, n) : undefined;
  }
  themes(): Theme[] {
    return this.graph.nodes({ label: 'theme' }).map((n) => new Theme(this, n));
  }
  sections(): SectionView[] {
    return this.graph.nodes({ label: 'section' }).map((n) => ({
      title: String(n.props.title ?? ''),
      index: Number(n.props.index ?? 0),
      tableRows: Number(n.props.tableRows ?? 0),
      wordCount: Number(n.props.wordCount ?? 0),
      bulletCount: Number(n.props.bulletCount ?? 0),
      namesStates: Boolean(n.props.namesStates ?? false),
      where: prov(n),
    }));
  }
  /** The first section whose title matches (e.g. /typograph/i). */
  section(re: RegExp): SectionView | undefined {
    return this.sections().find((s) => re.test(s.title));
  }
  /** Total DESIGN.md word count. */
  wordCount(): number {
    return this.assets.designMd.split(/\s+/).filter(Boolean).length;
  }
  /** Lint codes the system opts into (manifest.craft.applies). */
  craftApplies(): string[] {
    return ((this.assets.manifest as any)?.craft?.applies as string[]) ?? [];
  }

  /** Transitive dependents of a node (impact / find-references). */
  affected(nodeId: string): Reference[] {
    return graphFindAffected(this.graph, nodeId).map((a) => ({
      id: a.id,
      label: a.label,
      name: a.name,
      via: a.via,
      depth: a.depth,
      where: this.graph.node(a.id) ? (this.graph.node(a.id)!.props.source as Provenance | undefined) : undefined,
    }));
  }

  /** Flat view for the prompt composer / back-compat callers. */
  toContext(): ContextView {
    return {
      id: this.id,
      name: this.name,
      designMd: this.assets.designMd,
      tokensCss: this.assets.tokensCss,
      declaredTokens: this.declaredTokens,
      primitives: this.components().map((c) => c.name),
      exemptions: this.exemptions,
      bindsDisplayFace: this.bindsDisplayFace,
    };
  }
}
