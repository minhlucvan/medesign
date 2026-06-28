---
name: "MDS: Craft Story"
description: Add or refine the variants & states (CSF stories) for a component — entry-workflow routes to story-fix for auto-generation. Requires an active design system.
category: Craft
tags: [craft, story, variants, states, story-fix]
---

# MDS: Craft Story

Automatically generate or update CSF stories for a component. Routes through the **entry-workflow**
which classifies it as `story` and delegates to the **story-fix** workflow.

**Input**: a component name. Example: `/mds:craft:story StatsCard`

## Workflow

1. **Execute:** `Workflow({ name: 'entry-workflow', args: { type: 'story', target: name } })`
   - The **story-fix** workflow:
     - Assesses current story state via `doctor charters`
     - Auto-generates stories via `story auto <name>` (parses props → generates Default + variant stories)
     - Verifies via `doctor charters --gate` and `doctor visual`
2. **Review.** Check the generated stories cover all variants and states.

## CLI Alternative

```bash
emdesign story auto <name>
emdesign doctor charters <name> --gate
```

## Common Intents Routed Here

| Intent Example | Entry-Workflow Route | Layer |
|----------------|---------------------|-------|
| "Generate stories for StatsCard" | `type: story` → `story-fix` | Element |
| "Missing story variants" | `type: story` → `story-fix` | Element |
| "Update story files" | `type: story` → `story-fix` | Element |
