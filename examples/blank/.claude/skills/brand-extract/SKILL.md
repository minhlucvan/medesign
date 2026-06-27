---
name: brand-extract
description: Infer a design system's tokens + voice from a brand reference (screenshots or a URL) — vision-assisted. Use for /mds:system:create --mode extract, feeding the design-system-author skill.
---

# brand-extract

Adapted from open-design's `brand-extract`, constrained to emdesign's token contract: extraction produces
**token roles + a DESIGN.md draft**, never raw values pasted into components.

## Steps
1. Gather the reference: screenshots (read the images) and/or a URL. If screenshots are provided, Read them.
2. Infer the palette → map to **roles** (`--color-surface/-raised`, `--color-text/-muted`,
   `--color-accent/-hover`, `--color-border`, status). Infer the type families (display/sans/mono), the
   spacing rhythm, radius, shadow, and the **voice** (tone, casing).
3. Draft the 9-section DESIGN.md + `tokens.css` via the `design-system-author` skill — exact values, semantic
   roles, anti-patterns implied by the brand ("never X").
4. MCP `validate_design_system({id})` until the contract passes.

## Guardrails
- Output is roles + a DESIGN.md, not a pile of hex. Every value lands as a token role.
- Be honest about uncertainty — flag inferred values for human confirmation rather than inventing precision.
- Respect trademarks: extract *style direction*, don't clone a protected brand wholesale.
