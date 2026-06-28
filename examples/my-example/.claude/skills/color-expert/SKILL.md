---
name: color-expert
description: Reason about color on-system — pick/adjust accent, surfaces, and status colors within a design system's palette, check contrast/accessibility, and propose token changes (not raw hex). Adapted from open-design's color-expert. Use for color decisions during build, review, or system edits.
---

# color-expert

Adapted from open-design's `color-expert`, constrained to emdesign's token contract: color decisions are
**token-role** decisions, never raw hex in a component.

## Steps
1. Read the system's Color section + `tokens.css` color roles (`--color-surface/-raised`, `--color-text/-muted`,
   `--color-accent/-hover`, `--color-border`, status). Use `graph query {label:'token', where:{kind:'color'}}`
   and `tokenValue` edges to see the concrete swatches.
2. For a component: choose the right **role** for each element (respect the accent budget ≤ ~2). Verify
   contrast (text on surface ≥ WCAG AA). Never introduce a new hex inline — if a needed color is missing,
   propose a token (escalate to `design-md`).
3. For a system edit: change the role's value in `tokens.css`, then `graph_find_affected` to see every
   primitive/variant/artifact that moves; re-baseline visual tests as needed.

## Guardrails
- Output is roles + (for system edits) token values — never a raw hex pasted into a component.
- A palette change is a system change: surface it, show the affected set, re-verify.
