---
name: "MDS: System Create"
description: Create a design system (the contract every project starts from) — author a full 9-section DESIGN.md + tokens.css + base primitives from a brief, a blank skeleton, an import, or a brand/reference.
category: System
tags: [system, design-system, create, workflow]
---

# MDS: System Create

Create the design system the whole project builds from. Mirrors open-design's `create_design_system` +
`design-md`, but lands a code-first system (DESIGN.md + tokens.css + `code/` primitives) verified by the
token contract.

**Input**: an `id`, a `name`, and a `mode`:
- **brief** — author from a prompt (e.g. *"warm editorial, serif display, terracotta accent"*).
- **blank** — a skeleton to fill.
- **import** — start from a prebuilt **base** and customize (`from <ref>`). Bases include the vendored
  open-design systems (`open-design/brutalist`, `open-design/editorial-burgundy`, …) and any local system.
- **extract** — infer from a brand/reference (URL or screenshots) — vision-assisted.

Example: `/mds:system:create atelier2 "Studio Noir" --mode brief "dark, editorial, electric-lime accent"`
Import example: `/mds:system:create acme "Acme" --mode import open-design/brutalist`

## Workflow
1. **Approve.** `AskUserQuestion` to confirm `id`, `name`, `mode`. For **import**, first call
   `list_design_system_bases` (MCP) and present the catalog (name · category · description) so the user
   picks a base; pass the chosen `ref` as `from`.
2. **Scaffold.** MCP `create_design_system({id,name,mode,from})` → writes `design-systems/<id>/` (skeleton
   DESIGN.md + base tokens.css + manifest) and copies the base primitive set into `code/`. For **import**
   it clones the chosen base, re-ids it, builds the graph, and validates the token contract — the new
   system arrives ready to re-skin; you then edit DESIGN.md/tokens to differentiate.
3. **Author** (brief/extract) via the `design-system-author` skill (+ `brand-extract` for extract): fill the
   9 sections to the quality bar (exact values, semantic roles, anti-patterns) and re-value `tokens.css`.
   Run `Workflow({ name: 'design-system-loop', args: { id, mode } })` to author → validate → refresh.
4. **Validate.** MCP `validate_design_system({id})` — the token contract must pass (every role declared,
   every `var()` resolves). Loop until clean.
5. **Select.** Offer `/mds:system:use <id>` to make it active and rewire the workspace.

## Guardrails
- Hit the quality bar (see `docs/authoring-design-systems.md`): exact values, semantic role names, real
  anti-patterns. A vague DESIGN.md produces vague UI.
- `tokens.css` must declare every required role; `validate_design_system` is authoritative.
- Don't invent off-system values; everything maps to a token role.
