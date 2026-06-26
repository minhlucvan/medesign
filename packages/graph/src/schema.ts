/**
 * Labeled property-graph schema for a design-system library.
 *
 * A node is { id, label, props }; an edge is { id, label, from, to, props }.
 * `label` is the kind; `props` is an open key→value bag so any information attaches
 * without schema churn. Provenance lives in `props.source = { file, line? }`.
 */

export type BuiltinNodeLabel =
  | 'designSystem'
  | 'file'
  | 'section'
  | 'token'
  | 'color'
  | 'typeface'
  | 'theme'
  | 'primitive'
  | 'prop'
  | 'variant'
  | 'state'
  | 'story'
  | 'artifact'
  | 'rule'
  | 'skill'
  | 'intent'; // a design change's intent/spec (the "playbook" overlay)

/** Builtins give autocomplete; plugins may contribute their own node labels (runtime is open). */
export type NodeLabel = BuiltinNodeLabel | (string & {});

export type BuiltinEdgeLabel =
  | 'declaredIn' // any node → file (provenance)
  | 'contains' // designSystem → file/primitive/…
  | 'definedIn' // token → section
  | 'tokenValue' // token → color
  | 'usesFont' // token → typeface
  | 'uses' // primitive|variant → token
  | 'composes' // artifact → primitive; primitive → primitive
  | 'references' // artifact → token|color
  | 'hasProp' // primitive → prop
  | 'hasVariant' // primitive → variant
  | 'hasState' // primitive → state
  | 'storyOf' // story → primitive|artifact
  | 'overrides' // theme → token
  | 'governs' // rule → primitive|artifact
  | 'violates' // artifact → rule
  | 'documentedBy' // primitive → section
  | 'produces'; // intent → artifact (the playbook/spec that drove it)

/** Builtins give autocomplete; plugins may contribute their own edge labels (runtime is open). */
export type EdgeLabel = BuiltinEdgeLabel | (string & {});

export type TokenKind = 'color' | 'type' | 'spacing' | 'radius' | 'shadow' | 'motion' | 'layout';

export interface Provenance {
  file: string;
  line?: number;
}

export type Props = Record<string, unknown> & { source?: Provenance };

export interface GNode {
  id: string;
  label: NodeLabel;
  props: Props;
}

export interface GEdge {
  id: string;
  label: EdgeLabel;
  from: string;
  to: string;
  props: Props;
}

export interface GraphJSON {
  designSystem: string;
  nodes: GNode[];
  edges: GEdge[];
}

export function isNodeLabel(x: string): x is BuiltinNodeLabel {
  return (
    [
      'designSystem', 'file', 'section', 'token', 'color', 'typeface', 'theme',
      'primitive', 'prop', 'variant', 'state', 'story', 'artifact', 'rule', 'skill', 'intent',
    ] as readonly string[]
  ).includes(x);
}
