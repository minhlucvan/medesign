/**
 * Framework Charter: geometry/no-viewport-overflow
 *
 * "As a rendered component, I want none of my children to extend beyond the
 *  viewport bounds so the layout does not cause horizontal scrolling or clipping."
 *
 * Layer: dom
 * Category: geometry
 *
 * Flags elements whose bounding box extends beyond the root container
 * (#storybook-root) width or height. This catches horizontal scroll bugs,
 * elements escaping their containers, and content that's wider than the canvas.
 *
 * Ported from the `core-viewport-overflow` RenderedReviewRule, adapted to the
 * ElementCharter format with structured findings (coordinates, pixel measurements,
 * per-edge reporting) for agent consumption.
 */
import type { ElementCharter, EcDomContext, EcFinding } from '../charter.js';

/** Minimum overflow (px) before flagging. */
const TOLERANCE = 2;

/** Maximum findings per run. */
const MAX_FINDINGS = 20;

interface OverflowMetric {
  edge: 'right' | 'bottom';
  px: number;
}

function measureViewportOverflow(
  elementBox: { x: number; y: number; width: number; height: number },
  root: { width: number; height: number },
): OverflowMetric[] {
  const result: OverflowMetric[] = [];

  const right = elementBox.x + elementBox.width - root.width;
  if (right > TOLERANCE) result.push({ edge: 'right', px: Math.round(right) });

  const bottom = elementBox.y + elementBox.height - root.height;
  if (bottom > TOLERANCE) result.push({ edge: 'bottom', px: Math.round(bottom) });

  return result;
}

function overflowSeverity(metrics: OverflowMetric[]): 'minor' | 'moderate' | 'severe' {
  const maxPx = Math.max(...metrics.map((m) => m.px));
  if (maxPx > 100) return 'severe';
  if (maxPx > 30) return 'moderate';
  return 'minor';
}

export const noViewportOverflow: ElementCharter = {
  name: 'geometry/no-viewport-overflow',
  description:
    'As a rendered element, I must not extend beyond the viewport bounds. ' +
    'Every element must be fully visible within the root container.',
  severity: 'P1',
  matcher: { type: 'dom-selector', selector: '*' },
  run(ctx: EcDomContext): EcFinding[] {
    const findings: EcFinding[] = [];

    for (const snap of ctx.renders) {
      const root = snap.root;
      if (root.width === 0 && root.height === 0) continue;

      for (const el of ctx.matchedElements) {
        if (findings.length >= MAX_FINDINGS) break;

        const overflow = measureViewportOverflow(el.node.box, root);
        if (overflow.length === 0) continue;

        const severity = overflowSeverity(overflow);
        const edgeDesc = overflow.map((o) => `${o.edge}: ${o.px}px`).join(', ');
        const maxPx = Math.max(...overflow.map((o) => o.px));

        findings.push({
          id: `geometry/no-viewport-overflow/${el.node.selector}`,
          severity: severity === 'severe' ? 'P0' : 'P1',
          message:
            `"${el.node.selector}" extends beyond viewport by ${edgeDesc}. ` +
            `Element: {x:${Math.round(el.node.box.x)}, y:${Math.round(el.node.box.y)}, ` +
            `w:${Math.round(el.node.box.width)}, h:${Math.round(el.node.box.height)}}. ` +
            `Viewport: ${Math.round(root.width)}×${Math.round(root.height)}px.`,
          target: el.node.selector,
          remediation:
            severity === 'severe'
              ? `URGENT: "${el.node.selector}" overflows viewport by ${maxPx}px. ` +
                'Options: (1) Reduce the element width or use max-width. ' +
                '(2) Set overflow-x:hidden on the root container. ' +
                '(3) Use responsive sizing (w-full, max-w-screen, etc.). ' +
                (overflow.some((o) => o.edge === 'right')
                  ? ' (4) Check for fixed-width elements that exceed the viewport.'
                  : '')
              : `"${el.node.selector}" overflows viewport by ${maxPx}px on ` +
                `${overflow.map((o) => o.edge).join(', ')}. ` +
                'Adjust element size or use responsive utilities to keep content within bounds.',
        });
      }
    }

    return findings;
  },
};

export default noViewportOverflow;
