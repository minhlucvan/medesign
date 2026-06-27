/**
 * Framework Charter: geometry/z-index-collision
 *
 * "As an overlapping element, I want at least one of us to have an explicit z-index
 *  so the stacking order is intentional and predictable."
 *
 * Layer: dom
 * Category: geometry
 *
 * Flags pairs of sibling elements whose bounding boxes intersect AND neither has an
 * explicit z-index set (both are 'auto'). Intentionally-stacked elements (those with
 * position: absolute | fixed | sticky) are included in the check — if they overlap
 * without explicit z-index ordering, the stacking is accidental.
 *
 * This catches the common layout issue where a dropdown, tooltip, or floating element
 * appears beneath content it should overlay, or where the stacking order is ambiguous
 * because both elements rely on the default "later in DOM order" rule.
 */
import type { ElementCharter, EcDomContext, EcFinding, EcDomNode } from '../charter.js';

/** Minimum intersection (px) on BOTH axes before flagging as overlap. */
const TOLERANCE = 2;

/** Maximum findings per run. */
const MAX_FINDINGS = 20;

/** Check if an element has an explicit z-index. */
function hasExplicitZIndex(n: EcDomNode): boolean {
  const z = n.node.styles.zIndex?.trim();
  // z-index: auto means no explicit stacking
  return !!z && z !== 'auto' && z !== '';
}

/** Compute overlap of two bounding boxes. */
function overlapPx(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): { w: number; h: number } | null {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (w > TOLERANCE && h > TOLERANCE) return { w, h };
  return null;
}

export const zIndexCollision: ElementCharter = {
  name: 'geometry/z-index-collision',
  description:
    'As an overlapping element, I want a sibling with explicit z-index so the stacking order is intentional, not accidental.',
  severity: 'P2',
  matcher: { type: 'dom-selector', selector: '*' },
  run(ctx: EcDomContext): EcFinding[] {
    const findings: EcFinding[] = [];
    const seen = new Set<string>();

    for (const el of ctx.matchedElements) {
      if (findings.length >= MAX_FINDINGS) break;

      for (const sib of el.siblings) {
        const key = [el.node.selector, sib.node.selector].sort().join(' ⨯ ');
        if (seen.has(key)) continue;

        const ov = overlapPx(el.node.box, sib.node.box);
        if (!ov) continue;
        seen.add(key);

        // Check z-index on both elements
        const elZ = hasExplicitZIndex(el);
        const sibZ = hasExplicitZIndex(sib);
        // Skip if at least one has explicit z-index (stacking is intentional)
        if (elZ || sibZ) continue;

        // Determine position type for context
        const elPos = el.node.styles.position;
        const sibPos = sib.node.styles.position;
        const bothStacked =
          (elPos === 'absolute' || elPos === 'fixed' || elPos === 'sticky') &&
          (sibPos === 'absolute' || sibPos === 'fixed' || sibPos === 'sticky');

        findings.push({
          id: `geometry/z-index-collision/${key}`,
          severity: bothStacked ? 'P1' : 'P2',
          message:
            `"${el.node.selector}" overlaps "${sib.node.selector}" by ${Math.round(ov.w)}×${Math.round(ov.h)}px ` +
            `but neither has an explicit z-index ` +
            `(${el.node.selector}: z=${el.node.styles.zIndex || 'auto'}, ` +
            `${sib.node.selector}: z=${sib.node.styles.zIndex || 'auto'}). ` +
            (bothStacked
              ? 'Both are positioned — stacking order depends on DOM order, which is brittle.'
              : 'The overlap may be unintentional.'),
          target: el.node.selector,
          remediation:
            bothStacked
              ? `Set explicit z-index on "${el.node.selector}" or "${sib.node.selector}". ` +
                'For positioned elements (absolute/fixed/sticky), z-index ensures ' +
                'consistent stacking regardless of DOM order.'
              : `If the overlap is intentional, set z-index on one of the elements ` +
                `to clarify stacking. If not, adjust layout to eliminate the overlap.`,
        });
      }
    }

    return findings;
  },
};

export default zIndexCollision;
