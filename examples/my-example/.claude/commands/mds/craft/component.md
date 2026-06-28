---
name: "MDS: Craft Component"
description: Build a beautiful, on-system, tested component through the layered workflow system — entry-workflow routes to component-new for a full build loop. Requires an active design system.
category: Craft
tags: [craft, workflow, component, entry-workflow]
---

# MDS: Craft Component

Drive the emdesign layered workflow to produce a component that is **beautiful, consistent, testable,
shippable**. **Precondition: an active design system** (`/mds:system:use <id>` or `/mds:system:create`).
The emdesign server must be running (`emdesign serve`) and Storybook up (`npm run studio`).

**Input**: a natural-language component request, optionally a PascalCase `name`.
Example: `/mds:craft:component "a stats card with trend indicator" StatsCard`

## Workflow

1. **Approve scope.** Use `AskUserQuestion` to confirm the component `name`, the active design system, and
   the quality `threshold` (default 0.8). Do not proceed without approval.
2. **Enrich intent.** The `entry-workflow` reads the knowledge graph (`graph context`), design system info
   (`ds info`), and Storybook health to enrich the request before routing.
3. **Route to layer.** The `entry-workflow` classifies your intent as `component-new` and delegates to the
   **component-new** workflow:
   - Enrich: `ds context` + `graph guidance --intent` + `explore hierarchy`
   - Build: Generate source + `story auto`
   - Verify: Progressive cascade — `doctor lint` → `doctor visual` → `doctor spatial` → `doctor all --gate`
   - Capture: On pass → `capture --baseline` (if human-approved)
   - Reconcile: `graph impact art/<name>` → check dependents
4. **Execute:** `Workflow({ name: 'entry-workflow', args: { type: 'component-new', target: name, instruction, payload: { threshold } } })`
5. **Human checkpoint.** Present the preview URL + scores and `AskUserQuestion` whether to ship.
6. **Ship** only on approval: run `/mds:ship <name>`.

## Skill

Invoke the **`component-build`** skill for detailed component building guidance. It covers:
- Composing primitives from `@ds`
- Using semantic token classes only
- Writing CSF stories
- The verify loop

## Common Intents Routed Here

| Intent Example | Entry-Workflow Route | Layer |
|----------------|---------------------|-------|
| "Build a new stats card" | `type: component-new` → `component-workflow` | Component |
| "Create a data table" | `type: component-new` → `component-workflow` | Component |
| "I need a header component" | `type: component-new` → `component-workflow` | Component |

## Guardrails
- Never ship without gate passing **and** explicit human approval.
- Reference token roles only; obey the design system's anti-patterns.
- Evidence required: every round's scores + screenshot under `design/changes/<slug>/evidence/`.
