/**
 * Atelier EC: accent-restraint
 *
 * "As the Accent token, I want to be used at most 2 times per screen
 *  so that the system stays restrained."
 *
 * Layer: graph
 * Matcher: custom (find all artifacts that use the accent token)
 *
 * Atelier's DESIGN.md states: "The accent is precious: a screen has
 * at most two accent elements."
 */
import type { ElementCharter, EcGraphContext, EcFinding } from '@emdesign/dsr';

export const accentUsage: ElementCharter = {
  name: 'accent-restraint',
  description:
    'As the Accent token, I want to appear at most 2 times per screen so the system stays restrained.',
  severity: 'P1',
  matcher: {
    type: 'custom',
    match(g) {
      // Find the accent token node
      const accentToken = g.nodes({
        label: 'token',
        where: { name: 'color-accent' },
      })[0];
      if (!accentToken) return [];

      // Find everything that references the accent token transitively
      const reached = g.traverse(accentToken.id, {
        edgeLabels: ['uses', 'references', 'composes'],
        direction: 'in',
        maxDepth: 5,
      });
      return reached.map((r) => r.node.id);
    },
  },
  run(ctx: EcGraphContext) {
    const findings: EcFinding[] = [];
    const accentToken = ctx.graph.nodes({
      label: 'token',
      where: { name: 'color-accent' },
    })[0];
    if (!accentToken) return findings;

    // Count accent references per top-level artifact
    const countMap = new Map<string, number>();

    for (const id of ctx.matched) {
      // Skip non-artifact nodes
      const node = ctx.graph.node(id);
      if (!node || node.label !== 'artifact') continue;

      // Count direct references + uses of the accent token
      const refs = ctx.graph.in(id, 'references');
      const uses = ctx.graph.in(id, 'uses');
      const accentRefs = [...refs, ...uses].filter(
        (e) => e.to === accentToken.id || e.from === accentToken.id,
      );

      if (accentRefs.length > 0) {
        countMap.set(id, (countMap.get(id) ?? 0) + accentRefs.length);
      }
    }

    for (const [artifact, count] of countMap) {
      if (count > 2) {
        findings.push({
          id: `overuse/${artifact}`,
          severity: 'P1',
          message:
            `Accent token referenced ${count} times in "${artifact}"; ` +
            `maximum is 2 per screen.`,
          target: artifact,
          remediation:
            'Reduce accent usage. Consider using --color-text-muted or --color-border instead.',
        });
      }
    }

    return findings;
  },
};
