/**
 * Element Charters — DOM selector matching engine.
 *
 * Resolves CSS selectors against RenderSnapshot data in-process (no browser needed).
 * Builds an EcDomNode tree from the flat RenderNode[] array using parentSelector,
 * then matches selectors against tag + classes + text + styles.
 */

import type { RenderNode, RenderSnapshot } from '../rules/rendered.js';
import type { EcDomNode } from './charter.js';

// ---------------------------------------------------------------------------
// EcDomNode tree construction
// ---------------------------------------------------------------------------

/**
 * Build a tree of EcDomNode from a flat RenderNode[] array.
 * Uses RenderNode.parentSelector to reconstruct parent→child relationships.
 */
export function buildDomTree(snapshot: RenderSnapshot): EcDomNode[] {
  const nodeMap = new Map<string, EcDomNode>();
  const roots: EcDomNode[] = [];

  // First pass: create EcDomNode wrappers
  for (const node of snapshot.nodes) {
    nodeMap.set(node.selector, {
      node,
      children: [],
      parent: null,
      siblings: [],
    });
  }

  // Second pass: wire parent→child edges
  for (const [selector, ecNode] of nodeMap) {
    const parentSelector = ecNode.node.parentSelector;
    if (parentSelector && nodeMap.has(parentSelector)) {
      const parent = nodeMap.get(parentSelector)!;
      parent.children.push(ecNode);
      ecNode.parent = parent;
    } else {
      roots.push(ecNode);
    }
  }

  // Third pass: compute siblings for each node
  for (const [, ecNode] of nodeMap) {
    if (ecNode.parent) {
      ecNode.siblings = ecNode.parent.children.filter((c) => c !== ecNode);
    }
  }

  return roots;
}

// ---------------------------------------------------------------------------
// Selector matching
// ---------------------------------------------------------------------------

const PSEUDO_CLASS_RE = /^:([a-z-]+)(?:\(([^)]*)\))?$/;

/**
 * Match a single CSS selector part against a RenderNode.
 * Handles tag, .class, [attr], :contains(), :first-child, :last-child.
 */
function matchSelectorPart(part: string, node: RenderNode, siblings: EcDomNode[]): boolean {
  if (part.startsWith('.')) {
    // Class selector
    const cls = part.slice(1);
    return node.classes.split(/\s+/).some((c) => c === cls);
  }

  if (part.startsWith('[')) {
    // Attribute selector — check RenderNode top-level props + styles
    const m = part.match(/^\[(\w+)([~|^$*]?=)?['"]?(.*?)['"]?\]$/);
    if (!m) return true; // unparseable, skip
    const [, attr, op, val] = m;
    const nodeVal =
      (node as unknown as Record<string, unknown>)[attr] ??
      (node.styles as unknown as Record<string, unknown>)[attr];
    if (nodeVal === undefined || nodeVal === null) return false;
    if (!op) return true; // [attr] exists
    const strVal = String(nodeVal);
    if (op === '=') return strVal === val;
    if (op === '~=') return strVal.split(/\s+/).includes(val);
    if (op === '^=') return strVal.startsWith(val);
    if (op === '$=') return strVal.endsWith(val);
    if (op === '*=') return strVal.includes(val);
    return strVal === val;
  }

  if (part.startsWith(':')) {
    // Pseudo-class
    const pMatch = part.match(PSEUDO_CLASS_RE);
    if (!pMatch) return true;
    const [, pseudo, arg] = pMatch;

    if (pseudo === 'contains' && arg) {
      const text = arg.replace(/['"]/g, '');
      return node.text.toLowerCase().includes(text.toLowerCase());
    }
    if (pseudo === 'first-child') {
      return siblings.length === 0 || siblings.every((s) => s.node.box.y > node.box.y);
    }
    if (pseudo === 'last-child') {
      return siblings.length === 0 || siblings.every((s) => s.node.box.y < node.box.y);
    }

    return true; // unknown pseudo, skip
  }

  if (/^[a-z][a-z0-9-]*$/.test(part)) {
    // Tag selector
    return node.tag === part;
  }

  // Skip unrecognized
  return true;
}

/**
 * Split a CSS selector into its constituent parts.
 * e.g. "button.btn-primary[data-x=y]" → ["button", ".btn-primary", "[data-x=y]"]
 */
function splitSelector(selector: string): string[] {
  const parts: string[] = [];
  let buf = '';
  let inBracket = 0;
  let inParen = 0;

  for (const ch of selector) {
    if (ch === '[') inBracket++;
    if (ch === ']') inBracket--;
    if (ch === '(') inParen++;
    if (ch === ')') inParen--;

    if (inBracket === 0 && inParen === 0 && (ch === '.' || ch === ':' || ch === '[')) {
      if (buf) parts.push(buf);
      buf = ch;
    } else {
      buf += ch;
    }
  }
  if (buf) parts.push(buf);

  return parts;
}

/**
 * Match a full CSS selector against a RenderNode in its DOM context.
 * Supports comma-separated selectors (e.g. "button, [role=button], .btn").
 */
export function matchSelector(selector: string, node: EcDomNode): boolean {
  // First, split by comma for comma-separated selectors
  const commaParts = selector.split(/\s*,\s*/).filter(Boolean);
  for (const part of commaParts) {
    // Simple selectors only (no combinators like >, +, space)
    // Split by the first combinator we find, but only use the last segment
    const simpleSelector = part.split(/\s*[>+]\s*/).pop()?.trim() ?? part;
    const parts = splitSelector(simpleSelector);
    if (parts.every((p) => matchSelectorPart(p, node.node, node.siblings))) {
      return true;
    }
  }
  return false;
}

/**
 * Query all EcDomNodes matching a CSS selector within a tree.
 */
export function querySelectorAll(selector: string, roots: EcDomNode[]): EcDomNode[] {
  const results: EcDomNode[] = [];

  function walk(nodes: EcDomNode[]) {
    for (const n of nodes) {
      if (matchSelector(selector, n)) {
        results.push(n);
      }
      walk(n.children);
    }
  }

  walk(roots);
  return results;
}

/**
 * Find DOM elements by relationship to elements matching a base selector.
 */
export function queryByRelation(
  baseSelector: string,
  relation: 'parent' | 'children' | 'siblings' | 'ancestors',
  roots: EcDomNode[],
): EcDomNode[] {
  const base = querySelectorAll(baseSelector, roots);
  const seen = new Set<string>();
  const results: EcDomNode[] = [];

  for (const el of base) {
    switch (relation) {
      case 'parent':
        if (el.parent && !seen.has(el.parent.node.selector)) {
          seen.add(el.parent.node.selector);
          results.push(el.parent);
        }
        break;
      case 'children':
        for (const child of el.children) {
          if (!seen.has(child.node.selector)) {
            seen.add(child.node.selector);
            results.push(child);
          }
        }
        break;
      case 'siblings':
        for (const sib of el.siblings) {
          if (!seen.has(sib.node.selector)) {
            seen.add(sib.node.selector);
            results.push(sib);
          }
        }
        break;
      case 'ancestors': {
        let cur = el.parent;
        while (cur) {
          if (!seen.has(cur.node.selector)) {
            seen.add(cur.node.selector);
            results.push(cur);
          }
          cur = cur.parent;
        }
        break;
      }
    }
  }

  return results;
}
