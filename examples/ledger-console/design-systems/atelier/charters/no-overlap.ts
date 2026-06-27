/**
 * Atelier EC: no-overlap
 *
 * "As any laid-out element, I do not want to overlap my siblings, so the composition
 *  stays legible and nothing is accidentally obscured."
 *
 * Layer: dom
 * Matcher: dom-selector (every rendered element)
 *
 * Compares each element's bounding box against its siblings' boxes and flags pairs whose
 * rectangles intersect beyond a small tolerance. Intentionally-stacked elements
 * (position: absolute | fixed | sticky) are skipped — overlap there is by design.
 */
import type { ElementCharter, EcDomContext, EcFinding, EcDomNode } from '@emdesign/dsr';

/** Minimum intersection (px) on BOTH axes before two siblings count as overlapping. */
const TOLERANCE = 2;

function box(n: EcDomNode) {
  return n.node.box;
}

function isStacked(n: EcDomNode): boolean {
  const pos = n.node.styles.position;
  return pos === 'absolute' || pos === 'fixed' || pos === 'sticky';
}

/** Intersection rectangle of two boxes, or null if they don't meaningfully overlap. */
function overlap(a: EcDomNode, b: EcDomNode): { w: number; h: number } | null {
  const ba = box(a);
  const bb = box(b);
  const w = Math.min(ba.x + ba.width, bb.x + bb.width) - Math.max(ba.x, bb.x);
  const h = Math.min(ba.y + ba.height, bb.y + bb.height) - Math.max(ba.y, bb.y);
  if (w > TOLERANCE && h > TOLERANCE) return { w, h };
  return null;
}

export const noOverlap: ElementCharter = {
  name: 'no-overlap',
  description:
    'As a laid-out element, I do not want to overlap my siblings so the composition stays legible.',
  severity: 'P1',
  matcher: { type: 'dom-selector', selector: '*' },
  run(ctx: EcDomContext): EcFinding[] {
    const findings: EcFinding[] = [];
    const seen = new Set<string>();

    for (const el of ctx.matchedElements) {
      if (isStacked(el)) continue;
      for (const sib of el.siblings) {
        if (isStacked(sib)) continue;
        // Dedupe each unordered pair (A,B) so it is reported once.
        const key = [el.node.selector, sib.node.selector].sort().join(' ⨯ ');
        if (seen.has(key)) continue;

        const ov = overlap(el, sib);
        if (!ov) continue;
        seen.add(key);

        findings.push({
          id: `pair/${key}`,
          severity: 'P1',
          message: `"${el.node.selector}" overlaps sibling "${sib.node.selector}" by ${Math.round(ov.w)}×${Math.round(ov.h)}px.`,
          target: el.node.selector,
          remediation:
            'Adjust layout (flex/grid gap, margins, or sizing) so siblings do not intersect, or set position:absolute if the overlap is intentional.',
        });
      }
    }

    return findings;
  },
};
