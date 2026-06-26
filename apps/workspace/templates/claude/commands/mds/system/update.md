---
name: "MDS: System Update"
description: Update the active design system (tokens, spec, primitives) safely — assess blast radius via the graph, re-validate the token contract, and re-baseline affected components.
category: System
tags: [system, design-system, update, impact]
---

# MDS: System Update

Change the system itself (not a component). Because the system is the contract, changes ripple — use the
graph to see the blast radius first.

**Input**: a change to the active system (e.g. *"shift the accent warmer; add a `--color-info` role"*).

## Workflow
1. **Assess impact FIRST.** For any token change, MCP `graph_find_affected('<ds>/--<token>')` → the
   primitives, variants, stories, and artifacts that will move. Report them.
2. **Edit** `design-systems/<id>/DESIGN.md` and/or `tokens.css` to the quality bar (use the `design-md` /
   `color-expert` skills). Keep the contract consistent.
3. **Validate.** MCP `validate_design_system({id})` — must pass.
4. **Re-index + re-baseline.** `graph_rebuild`; re-run `/mds:review` (or `run_visual_test`) on affected
   components and intentionally re-baseline the visual snapshots that changed for the right reason.
5. Record what changed and why under `design/changes/<slug>/`.

## Guardrails
- Never weaken an anti-pattern just to make one component pass — fix the component instead.
- A token change is high-blast-radius: show the affected set and get approval before re-baselining.
- Re-validate the token contract after every edit.
