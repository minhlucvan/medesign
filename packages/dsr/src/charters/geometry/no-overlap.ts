/**
 * Framework Charter: geometry/no-overlap
 *
 * "As a laid-out element, I should not overlap my siblings so the composition
 *  stays legible and nothing is accidentally obscured."
 *
 * Layer: dom (RenderedReviewRule-compatible output)
 * Category: geometry
 *
 * Compares each element's bounding box against its siblings' boxes and flags pairs
 * whose rectangles intersect beyond a small tolerance. Intentionally-stacked elements
 * (position: absolute | fixed | sticky) are skipped.
 *
 * Provides structured findings with:
 *  - Both element selectors (for agent to locate them)
 *  - Overlap measurements in px
 *  - Bounding box coordinates for both elements
 *  - Remdiation guidance
 */
import type { ElementCharter, EcDomContext, EcFinding, EcDomNode } from '../charter.js';
import type { RenderNode } from '../../rules/rendered.js';

/** Minimum intersection (px) on BOTH axes before flagging as overlap. */
const TOLERANCE = 2;

/** Maximum findings per charter run (prevent flooding). */
const MAX_FINDINGS = 20;

function box(n: EcDomNode | RenderNode) {
  return 'node' in n ? n.node.box : n.box;
}

function isStacked(n: EcDomNode | RenderNode): boolean {
  const p = 'node' in n
    ? n.node.styles.position
    : (n as RenderNode).styles.position;
  return p === 'absolute' || p === 'fixed' || p === 'sticky';
}

/** Compute overlap of two bounding boxes. Returns overlap or null. */
function overlapPx(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): { w: number; h: number } | null {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (w > TOLERANCE && h > TOLERANCE) return { w, h };
  return null;
}

/** Build a human-readable overlap type from the ratio. */
function overlapType(w: number, h: number): 'minor' | 'moderate' | 'severe' {
  const area = w * h;
  if (area > 5000) return 'severe';
  if (area > 1000) return 'moderate';
  return 'minor';
}

/**
 * Check if element A is an ancestor of element B or vice versa.
 * Walks the parent chain using the EcDomNode tree.
 */
function isAncestor(a: EcDomNode, b: EcDomNode): boolean {
  let cur = a.parent;
  while (cur) {
    if (cur === b) return true;
    cur = cur.parent;
  }
  cur = b.parent;
  while (cur) {
    if (cur === a) return true;
    cur = cur.parent;
  }
  return false;
}

/** Check if two elements share the same parent (are siblings). */
function isSiblingPair(a: EcDomNode, b: EcDomNode): boolean {
  return a.parent !== null && a.parent === b.parent;
}

/** Add a finding for an overlapping pair. */
function addOverlapFinding(
  el: EcDomNode,
  other: EcDomNode,
  ov: { w: number; h: number },
  relationship: 'sibling' | 'cross-tree',
  findings: EcFinding[],
  seen: Set<string>,
): void {
  const key = [el.node.selector, other.node.selector].sort().join(' ⨯ ');
  if (seen.has(key)) return;
  seen.add(key);
  if (findings.length >= MAX_FINDINGS) return;

  const type = overlapType(ov.w, ov.h);
  findings.push({
    id: `geometry/no-overlap/${key}`,
    severity: type === 'severe' ? 'P0' : 'P1',
    message:
      `"${el.node.selector}" overlaps ${relationship} "${other.node.selector}" ` +
      `by ${Math.round(ov.w)}×${Math.round(ov.h)}px (${type} overlap). ` +
      `Element A: {x:${Math.round(el.node.box.x)}, y:${Math.round(el.node.box.y)}, ` +
      `w:${Math.round(el.node.box.width)}, h:${Math.round(el.node.box.height)}}. ` +
      `Element B: {x:${Math.round(other.node.box.x)}, y:${Math.round(other.node.box.y)}, ` +
      `w:${Math.round(other.node.box.width)}, h:${Math.round(other.node.box.height)}}.`,
    target: el.node.selector,
    remediation:
      type === 'severe'
        ? `URGENT: "${el.node.selector}" severely overlaps "${other.node.selector}" by ${Math.round(ov.w)}×${Math.round(ov.h)}px. ` +
          'Check: (1) Are both elements using the correct flex/grid layout container? ' +
          '(2) Is one element positioned/offset incorrectly? ' +
          '(3) Does the parent container have enough space for both children? ' +
          'Fix: adjust gap, margins, sizing, or remove fixed positioning.'
        : `"${el.node.selector}" overlaps "${other.node.selector}" by ${Math.round(ov.w)}×${Math.round(ov.h)}px. ` +
          'Adjust layout (gap, margins, sizing) so elements do not intersect.',
  });
}

export const noOverlap: ElementCharter = {
  name: 'geometry/no-overlap',
  description:
    'As a laid-out element, I must not overlap my siblings so the composition ' +
    'stays legible and nothing is accidentally obscured.',
  severity: 'P1',
  matcher: { type: 'dom-selector', selector: '*' },
  run(ctx: EcDomContext): EcFinding[] {
    const findings: EcFinding[] = [];
    const seen = new Set<string>();

    // ── Pass 1: sibling pairs ──────────────────────────────────────────
    for (const el of ctx.matchedElements) {
      if (findings.length >= MAX_FINDINGS) break;
      if (isStacked(el)) continue;
      for (const sib of el.siblings) {
        if (isStacked(sib)) continue;
        const ov = overlapPx(el.node.box, sib.node.box);
        if (!ov) continue;
        addOverlapFinding(el, sib, ov, 'sibling', findings, seen);
      }
    }

    // ── Pass 2: cross-tree pairs (elements in different branches) ─────
    // This catches overlaps between elements from different parts of the DOM
    // that standard sibling checks miss (e.g., a fixed sidebar overlapping
    // a main content area, or a tooltip from one section overlapping another).
    // It replaces the RenderedReviewRule `core-overlap` check which ran on
    // ALL element pairs.
    const flatList = ctx.matchedElements;
    for (let i = 0; i < flatList.length; i++) {
      if (findings.length >= MAX_FINDINGS) break;
      const a = flatList[i];
      if (isStacked(a)) continue;
      for (let j = i + 1; j < flatList.length; j++) {
        const b = flatList[j];
        if (isStacked(b)) continue;
        // Skip sibling pairs (already checked in pass 1) and parent-child
        if (isSiblingPair(a, b) || isAncestor(a, b)) continue;

        const ov = overlapPx(a.node.box, b.node.box);
        if (!ov) continue;
        addOverlapFinding(a, b, ov, 'cross-tree', findings, seen);
      }
    }

    return findings;
  },
};

export default noOverlap;
