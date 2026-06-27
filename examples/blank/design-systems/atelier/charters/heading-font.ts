/**
 * Atelier EC: heading-font
 *
 * "As a Heading, I want to use the display font so that
 *  typographic hierarchy is maintained."
 *
 * Layer: graph
 * Matcher: node (all primitives, filtered to headings in run())
 *
 * Atelier's DESIGN.md mandates:
 * - h1-h3 use the display (serif) family (Newsreader) — never the sans family
 * - Eyebrow uses the sans family (allowed — not a display heading)
 */
import type { ElementCharter, EcGraphContext, EcFinding } from '@emdesign/dsr';

export const headingFont: ElementCharter = {
  name: 'heading-font',
  description:
    'As a Heading, I want to use the display font so that typographic hierarchy is maintained.',
  severity: 'P0',
  // Match all primitives, filter in run()
  matcher: { type: 'node', label: 'primitive' },
  run(ctx: EcGraphContext) {
    const findings: EcFinding[] = [];
    const headings = ctx.matchedNodes.filter(
      (n) => /Heading/i.test(String(n.props.name ?? '')),
    );

    for (const node of headings) {
      const name = String(node.props.name ?? '');

      // Check uses edges to see which font token this primitive references
      const usesEdges = ctx.graph.out(node.id, 'uses');
      const fontEdges = usesEdges.filter((e) =>
        String(e.to).includes('font'),
      );

      for (const edge of fontEdges) {
        const tokenNode = ctx.graph.node(edge.to);
        const tokenName = String(tokenNode?.props?.name ?? '');

        if (!tokenName.includes('display')) {
          findings.push({
            id: `font/${node.id}`,
            severity: 'P0',
            message:
              `Heading "${name}" uses font token "${tokenName}", ` +
              `but headings must use the display font.`,
            target: node.id,
            remediation: `Replace ${tokenName} with --font-display in ${name}.`,
          });
        }
      }

      // If no font uses edges found, flag for review
      if (fontEdges.length === 0) {
        findings.push({
          id: `check/${node.id}`,
          severity: 'P1',
          message:
            `Heading "${name}" has no detectable font token usage — ` +
            `verify it uses the display font.`,
          target: node.id,
          remediation:
            'Ensure the component references --font-display.',
        });
      }
    }

    return findings;
  },
};
