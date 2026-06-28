---
name: "MDS: System Use"
description: Select the active design system and rewire the workspace — rebind tokens.css + the @ds alias, rebuild the knowledge graph. Direct CLI path, no workflow needed.
category: System
tags: [system, design-system, use, switch]
---

# MDS: System Use

Select a design system as the active one and rewire the workspace. This is a direct CLI operation.

**Input**: a design system ID. Example: `/mds:system:use atelier`

## Workflow

1. **List options.** `emdesign ds list` (or `emdesign ds search <query>`) to see available systems.
2. **Activate.** `emdesign use <id>`
   - Rebinds `active-design-system.css` to the selected system's `tokens.css`
   - Updates the `@ds` alias in the Vite/TS config
   - Rebuilds the knowledge graph
   - Confirms with token validation
3. **Verify.** `emdesign ds validate <id> --strict`
4. **Restart Storybook** if it was running, so it picks up the new tokens.

## Common Intents Routed Here

| Intent Example | Action |
|----------------|--------|
| "Switch to the atelier design system" | `emdesign use atelier` |
| "Activate my custom brand" | `emdesign use my-brand` |

## Guardrails
- Always validate after switching: `ds validate --strict`.
- Storybook needs a restart after switching design systems.
