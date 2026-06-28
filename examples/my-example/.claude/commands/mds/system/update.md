---
name: "MDS: System Update"
description: Update the active design system — entry-workflow routes to ds-layer-workflow for blast-radius-checked token/spec/primitive changes.
category: System
tags: [system, design-system, update, ds-layer-workflow, reconcile]
---

# MDS: System Update

Update an existing design system with blast radius check. Routes through the **entry-workflow**
which classifies it as `ds-update` and delegates to **ds-layer-workflow**.

**Input**: the design system ID and the changes.
Example: `/mds:system:update atelier --primary "#7c3aed" --body-font "Inter"`

## Workflow

1. **Assess impact.** `ds info` + `graph impact <token>` to find affected components.
2. **Execute:** `Workflow({ name: 'entry-workflow', args: { type: 'ds-update', target: id, payload: { changes: { primary, font } } } })`
   - The **ds-layer-workflow**:
     - Determines which layer: token → `ds customize`, rule → `ds lint-rules preset`, primitive → `ds scaffold`
     - Applies changes layer-appropriately
     - Verifies: token → `ds validate --strict`, primitive → `doctor lint`, rule → `ds validate`
     - Reconciles: checks `graph impact` for affected components → runs `doctor` on each
3. **Recompile.** `ds compile` + `ds export` to update generated types.

## Skills

Invoke **`design-md`** for DESIGN.md/tokens.css changes and **`color-expert`** for color decisions.

## Common Intents Routed Here

| Intent Example | Entry-Workflow Route | Layer |
|----------------|---------------------|-------|
| "Change primary color to purple" | `type: ds-update` → `ds-layer-workflow` | DS |
| "Switch to fintech lint rules" | `type: ds-update` → `ds-layer-workflow` | DS |
| "Add a new primitive" | `type: ds-update` → `ds-layer-workflow` | DS |

## Guardrails
- Always check blast radius before changing tokens. A token change can affect many components.
- After update, run `ds compile` so downstream consumers get fresh types.
