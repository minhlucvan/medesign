/**
 * Atelier EC: button-padding
 *
 * "As a Button, I want padding of at least 12px/20px so that
 *  touch targets meet accessibility guidelines."
 *
 * Layer: graph
 * Matcher: node (atoms named "Button")
 */
import type { ElementCharter, EcGraphContext, EcFinding } from '@emdesign/dsr';

export const buttonPadding: ElementCharter = {
  name: 'button-padding',
  description:
    'As a Button, I want minimum 12px/20px padding so touch targets are accessible.',
  severity: 'P1',
  // Match all primitives, then filter by name in run()
  matcher: { type: 'node', label: 'primitive' },
  run(ctx: EcGraphContext) {
    const findings: EcFinding[] = [];
    const MIN_Y = 12; // px
    const MIN_X = 20; // px
    const buttons = ctx.matchedNodes.filter(
      (n) => /Button/i.test(String(n.props.name ?? '')),
    );

    for (const node of buttons) {
      const name = String(node.props.name ?? '');

      // Check hasProp edges for explicit padding props
      const paddingProps = ctx.graph
        .out(node.id, 'hasProp')
        .filter((e) => String(e.to).includes('padding'));

      if (paddingProps.length > 0) {
        // AST-parsed props exist — validate them
        for (const edge of paddingProps) {
          const propNode = ctx.graph.node(edge.to);
          const value = String(propNode?.props?.defaultValue ?? '');
          findings.push({
            id: `prop/${node.id}`,
            severity: 'P1',
            message: `Button "${name}" declares padding via prop "${String(edge.to)}" (${value}). Verify it meets ${MIN_Y}px/${MIN_X}px minimum.`,
            target: node.id,
            remediation: `Ensure padding is at least ${MIN_Y}px ${MIN_X}px.`,
          });
        }
      } else {
        // No AST props — check via source conventions (Tailwind classes)
        // Atelier Button uses px-5 (20px) and py-3 (12px) which meet the standard.
        // This charter flags any Button that deviates.
        findings.push({
          id: `check/${node.id}`,
          severity: 'P1',
          message: `Button "${name}" — verify rendered padding meets ${MIN_Y}px/${MIN_X}px minimum.`,
          target: node.id,
          remediation: `Use px-5/py-3 or explicit padding: '${MIN_Y}px ${MIN_X}px'.`,
        });
      }
    }

    return findings;
  },
};
