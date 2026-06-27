/**
 * Framework Charter: geometry/alignment
 *
 * "As an element sharing a parent with siblings, I want to align to the
 *  same grid lines so the composition looks intentional."
 *
 * Layer: dom
 * Category: geometry
 *
 * Checks sibling elements in flex/grid containers for consistent alignment:
 * - Elements in a row should share the same y-position or have clear baseline alignment
 * - Elements in a column should share the same x-position or have clear edge alignment
 *
 * This catches the common layout issue where items in a navigation bar,
 * card grid, or button group are visually misaligned by a few pixels.
 */
import type { ElementCharter, EcDomContext, EcFinding } from '../charter.js';

/** Maximum variation in position (px) before flagging as misaligned. */
const ALIGNMENT_TOLERANCE = 3;

/** Maximum findings per run. */
const MAX_FINDINGS = 20;

export const alignment: ElementCharter = {
  name: 'geometry/alignment',
  description:
    'As an element sharing a parent with siblings, I want to align to the same grid lines so the composition looks intentional.',
  severity: 'P2',
  matcher: { type: 'dom-selector', selector: '*' },
  run(ctx: EcDomContext): EcFinding[] {
    const findings: EcFinding[] = [];
    const reportedParents = new Set<string>();

    for (const el of ctx.matchedElements) {
      if (findings.length >= MAX_FINDINGS) break;
      if (!el.parent) continue;
      if (el.siblings.length < 2) continue;

      // Deduplicate: report once per parent
      if (reportedParents.has(el.parent.node.selector)) continue;
      reportedParents.add(el.parent.node.selector);

      const siblings = [el, ...el.siblings];
      const parentStyles = el.parent.node.styles;
      const parentDisplay = parentStyles.display;

      // Skip parents with explicit centering — misalignment is expected by design
      if (parentDisplay === 'flex' || parentDisplay === 'inline-flex') {
        const parentClasses = el.parent.node.classes ?? '';
        if (/\bitems-center\b/.test(parentClasses)) continue;
      }

      if (parentDisplay === 'flex' || parentDisplay === 'inline-flex') {
        // Check horizontal alignment (row direction) — all should share similar y
        const yMin = Math.min(...siblings.map((s) => s.node.box.y));
        const yMax = Math.max(...siblings.map((s) => s.node.box.y));
        const yDiff = yMax - yMin;

        if (yDiff > ALIGNMENT_TOLERANCE) {
          // Find the outlier(s)
          const outliers = siblings.filter((s) => Math.abs(s.node.box.y - yMin) > ALIGNMENT_TOLERANCE);
          if (outliers.length > 0 && outliers.length < siblings.length) {
            findings.push({
              id: `geometry/alignment/${el.parent.node.selector}`,
              severity: 'P2',
              message:
                `Flex children of "${el.parent.node.selector}" are misaligned vertically ` +
                `by ${Math.round(yDiff)}px. ` +
                `${outliers.length}/${siblings.length} children are off the grid line.`,
              target: outliers[0].node.selector,
              remediation:
                'Ensure all flex children have the same height or use `items-center` ' +
                'to align them to the cross axis center.',
            });
          }
        }
      } else if (parentDisplay === 'grid' || parentDisplay === 'inline-grid') {
        // Check grid cell alignment — ensure consistent x and y within rows/cols
        const xValues = siblings.map((s) => Math.round(s.node.box.x));
        const yValues = siblings.map((s) => Math.round(s.node.box.y));

        const uniqueX = new Set(xValues);
        const uniqueY = new Set(yValues);

        // If grid has more than 2 distinct x positions but only 1 row, things are off
        if (uniqueX.size > 2 && uniqueY.size <= 1) {
          findings.push({
            id: `geometry/alignment/${el.parent.node.selector}`,
            severity: 'P2',
            message:
              `Grid children of "${el.parent.node.selector}" have ${uniqueX.size} distinct column positions ` +
              `in a single row (expected 1-2).`,
            target: el.parent.node.selector,
            remediation:
              'Ensure grid-template-columns defines consistent column widths, ' +
              'or check for items spanning multiple columns incorrectly.',
          });
        }
      }
    }

    return findings;
  },
};

export default alignment;
