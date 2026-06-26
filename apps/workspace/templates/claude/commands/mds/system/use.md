---
name: "MDS: System Use"
description: Select the active design system and rewire the workspace — rebind tokens.css + the @ds alias, rebuild the knowledge graph. Everything crafted next uses this system.
category: System
tags: [system, design-system, select, workspace]
---

# MDS: System Use

Make a design system active. This is the "select → update workspace" action.

**Input**: a design-system `id`. Example: `/mds:system:use atelier2`

## Workflow
1. (Optional) `list_design_systems` to show choices.
2. MCP `apply_design_system({id})` → rewires the workspace:
   - rewrites `src/active-design-system.css` to import the system's `tokens.css` (hot-reloads),
   - writes `.medesign/active-ds` (the `@ds` Vite alias reads it),
   - rebuilds the knowledge graph (`design-systems/<id>/graph.json`).
3. Tell the user to **restart Storybook** so the `@ds` alias repoints (tokens hot-reload without restart).
4. Confirm with `validate_design_system({id})`; surface any missing roles.

## Guardrails
- Selecting a system is the precondition for the craft flow — do it before `/mds:craft:*`.
- If `validate_design_system` fails, route back to `/mds:system:update` (don't craft on a broken contract).
