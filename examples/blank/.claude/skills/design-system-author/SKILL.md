---
name: design-system-author
description: Create or update a design system to the emdesign quality bar — author the 9-section DESIGN.md + tokens.css + base primitives. Use for the System flow (/mds:system:create | :update). Knows the four sources: brief, blank, import, extract.
---

# design-system-author

Authors the contract every project builds from. The richness of the DESIGN.md is the #1 lever on output
quality (see `docs/authoring-design-systems.md`).

## Sources
- **brief** — turn a prompt ("warm editorial, serif display, terracotta accent") into a full system.
- **blank** — fill the scaffolded skeleton.
- **import** — start from a prebuilt **base** and customize. Call `list_design_system_bases` (or
  `emdesign ds bases`) to see the catalog of vendored open-design systems under
  `design-systems/_vendor/open-design/` (e.g. `open-design/brutalist`, `open-design/editorial-burgundy`),
  pass its `ref` as `from`, then differentiate. Each base bundles its origin SKILL.md + reference assets.
- **extract** — infer tokens/voice from a brand/reference (pair with the `brand-extract` skill).

## Steps
1. Scaffold via MCP `create_design_system({id,name,mode,from})` (skeleton DESIGN.md + base tokens.css +
   manifest + base primitives copied in).
2. Author the **9 sections** to the bar: exact hex/rem/ms, a real type-scale table, per-component states,
   and **anti-patterns** (each maps to a lint rule). Give the system an opinionated point of view (§1) and
   a voice (§8).
3. Re-value `tokens.css` for every required role — semantic names only; keep it self-consistent.
4. MCP `validate_design_system({id})` until the token contract passes (every role declared, every `var()`
   resolves). Use `/mds:system:create`'s `design-system-loop` to drive author→validate→refresh.
5. Hand off: `/mds:system:use <id>` to make it active, then the craft flow can build against it.

## Guardrails
- Exact values + semantic roles + enforced anti-patterns. Vague prose → generic UI.
- Never leave a required token role undeclared; `validate_design_system` is authoritative.
- Updating an existing system is high-blast-radius — assess `graph_find_affected` first (see `/mds:system:update`).
