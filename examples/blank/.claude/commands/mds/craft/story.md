---
name: "MDS: Craft Story"
description: Add or refine the variants & states (CSF stories) for a component or view, and visual-test each so the matrix stays verified.
category: Craft
tags: [craft, story, variants, states, visual-test]
---

# MDS: Craft Story

Stories document a component's **variants & states** (the props/states from the design system's Components
section). This keeps the visual-test matrix complete.

**Input**: a component/view `name`, optionally which variants/states.
Example: `/mds:craft:story PricingTiers` or `/mds:craft:story Button "hover, disabled, secondary"`

## Workflow
1. MCP `graph_get_context('<ds>/<Name>')` → the component's declared props/variants/states (so stories cover
   the real matrix, not invented ones).
2. Edit the component's `*.stories.tsx` to add a named export per variant/state (`edit_component` or direct
   story edit), composing `@ds` primitives, token roles only.
3. For each new story, MCP `run_visual_test` → establish/compare its baseline.
4. Report the matrix + any visual diffs. No code-quality gate needed here — this is documentation + coverage.

## Guardrails
- Cover the variants/states the DESIGN.md actually defines; don't invent off-system ones.
- Each story must render (build gate) and get a visual baseline.
