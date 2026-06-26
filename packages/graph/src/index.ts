/**
 * @medesign/graph — labeled property graph of a design-system library.
 * Encodes files, stories, components, tokens, colors, fonts, specs, rules, themes, and artifacts
 * for craft, fix (where-to-fix), impact propagation, and on-system consistency.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Graph } from './graph.js';
import type { GraphJSON } from './schema.js';

export { Graph } from './graph.js';
export type { Where, NodeQuery, EdgeQuery, TraverseOpts, Reached } from './graph.js';
export * from './schema.js';
export { RULES, RULES_BY_ID } from './rules.js';
export type { RuleDef, Severity } from './rules.js';
export { buildGraph, overlayArtifact } from './build/index.js';
export type { BuildOpts, GraphFinding, OverlayOpts, GraphParser, GraphParseCtx } from './build/index.js';
export { extractTokenRoles } from './build/primitives.js';
export { findAffected, whereToFix, consistencyBrief, getContext, query, srcOf } from './query.js';
export type { Affected, WhereToFix, ConsistencyBrief, Context, FixLocation } from './query.js';

/** Save a graph to JSON (committed, diffable). */
export function saveGraph(g: Graph, file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(g.toJSON(), null, 2));
}

/** Load a graph from a JSON file. */
export function loadGraph(file: string): Graph {
  return Graph.fromJSON(JSON.parse(fs.readFileSync(file, 'utf8')) as GraphJSON);
}
