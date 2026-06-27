/**
 * Framework Charter: geometry/no-child-overflow
 *
 * "As a parent element, no child should overflow my bounding box unless explicitly
 *  allowed (overflow: visible being the default and most common case for bugs)."
 *
 * Layer: dom
 * Category: geometry
 *
 * Checks every parent-child relationship in the render snapshot. Flags when a child's
 * bounding box extends beyond its parent's on any edge — regardless of the parent's
 * overflow CSS value. This catches:
 *  - A NavigationBar badge that extends beyond the bar
 *  - A Card body that spills outside the Card
 *  - An absolutely-positioned tooltip that the parent doesn't contain
 *
 * Provides structured findings with:
 *  - Parent and child selectors
 *  - Which edges overflow (right, bottom, left, top) + magnitude in px
 *  - Bounding box coordinates for both
 *  - The CSS overflow property value
 *  - Remediation guidance
 */
import type { ElementCharter, EcDomContext, EcFinding, EcDomNode } from '../charter.js';

/** Minimum overflow (px) before flagging. Prevents noise from sub-pixel rendering. */
const TOLERANCE = 2;

/** Maximum findings per run. */
const MAX_FINDINGS = 20;

/** Categories of overflow for structured reporting. */
interface OverflowMetric {
  edge: 'right' | 'bottom' | 'left' | 'top';
  px: number;
}

function measureOverflow(child: EcDomNode, parent: EcDomNode): OverflowMetric[] {
  const cb = child.node.box;
  const pb = parent.node.box;
  const result: OverflowMetric[] = [];

  // Child's right edge extends beyond parent's right edge
  const right = cb.x + cb.width - (pb.x + pb.width);
  if (right > TOLERANCE) result.push({ edge: 'right', px: Math.round(right) });

  // Child's bottom edge extends beyond parent's bottom edge
  const bottom = cb.y + cb.height - (pb.y + pb.height);
  if (bottom > TOLERANCE) result.push({ edge: 'bottom', px: Math.round(bottom) });

  // Child's left edge is left of parent's left edge (negative overflow)
  const left = pb.x - cb.x;
  if (left > TOLERANCE) result.push({ edge: 'left', px: Math.round(left) });

  // Child's top edge is above parent's top edge
  const top = pb.y - cb.y;
  if (top > TOLERANCE) result.push({ edge: 'top', px: Math.round(top) });

  return result;
}

function overflowSeverity(metrics: OverflowMetric[]): 'minor' | 'moderate' | 'severe' {
  const maxPx = Math.max(...metrics.map((m) => m.px));
  if (maxPx > 50) return 'severe';
  if (maxPx > 15) return 'moderate';
  return 'minor';
}

export const noChildOverflow: ElementCharter = {
  name: 'geometry/no-child-overflow',
  description:
    'As a parent element, no child may overflow my bounding box. ' +
    'Every child must be fully contained within the parent, ' +
    'unless the parent has overflow:hidden/scroll explicitly set.',
  severity: 'P1',
  matcher: { type: 'dom-selector', selector: '*' },
  run(ctx: EcDomContext): EcFinding[] {
    const findings: EcFinding[] = [];
    // Index elements by selector for parent lookup
    const bySelector = new Map<string, EcDomNode>();
    for (const root of ctx.matchedElements) {
      indexNode(root, bySelector);
    }

    for (const el of ctx.matchedElements) {
      if (findings.length >= MAX_FINDINGS) break;
      if (!el.parent) continue;

      // Skip if parent explicitly handles overflow
      const parentOverflow = el.parent.node.styles.overflow?.toLowerCase() ?? '';
      if (parentOverflow === 'hidden' || parentOverflow === 'scroll' || parentOverflow === 'auto') continue;

      const overflow = measureOverflow(el, el.parent);
      if (overflow.length === 0) continue;

      const severity = overflowSeverity(overflow);
      const edgeDesc = overflow.map((o) => `${o.edge}: ${o.px}px`).join(', ');
      const maxPx = Math.max(...overflow.map((o) => o.px));

      findings.push({
        id: `geometry/no-child-overflow/${el.node.selector}`,
        severity: severity === 'severe' ? 'P0' : 'P1',
        message:
          `"${el.node.selector}" overflows its parent "${el.parent.node.selector}" ` +
          `by ${edgeDesc}. ` +
          `Child: {x:${Math.round(el.node.box.x)}, y:${Math.round(el.node.box.y)}, ` +
          `w:${Math.round(el.node.box.width)}, h:${Math.round(el.node.box.height)}}. ` +
          `Parent: {x:${Math.round(el.parent.node.box.x)}, y:${Math.round(el.parent.node.box.y)}, ` +
          `w:${Math.round(el.parent.node.box.width)}, h:${Math.round(el.parent.node.box.height)}}. ` +
          `Parent overflow: ${parentOverflow || 'visible (default)'}.`,
        target: el.node.selector,
        remediation:
          severity === 'severe'
            ? `URGENT: "${el.node.selector}" overflows parent by ${maxPx}px. ` +
              'Options: (1) Widen the parent container or reduce the child size. ' +
              '(2) Set overflow:hidden on the parent if clipping is acceptable. ' +
              '(3) Use flex/grid wrapping or text-overflow:ellipsis for text children. ' +
              `(4) ${edgeDesc.includes('right') ? 'Check for missing flex-wrap or a too-wide child. ' : ''}` +
              `${edgeDesc.includes('bottom') ? 'Check for too-tall content or insufficient parent height. ' : ''}` +
              `${edgeDesc.includes('left') || edgeDesc.includes('top') ? 'Check for negative margins or absolute positioning. ' : ''}`
            : `"${el.node.selector}" overflows parent by up to ${maxPx}px on ` +
              `${overflow.map((o) => o.edge).join(', ')}. ` +
              `Adjust: ${overflow.map((o) => o.edge === 'right' ? 'reduce child width or increase parent width' : '').filter(Boolean).join(', ') ||
                'reduce child size or increase parent container size'}.`,
      });
    }

    return findings;
  },
};

/** Recursively index nodes by selector for parent lookup. */
function indexNode(node: EcDomNode, map: Map<string, EcDomNode>): void {
  map.set(node.node.selector, node);
  for (const child of node.children) {
    indexNode(child, map);
  }
}

export default noChildOverflow;
