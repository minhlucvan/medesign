---
name: "MDS: Craft Update"
description: Apply a human change-request to the current component — entry-workflow routes to component-edit for regression-prevented editing.
category: Craft
tags: [craft, update, change-request, component-edit]
---

# MDS: Craft Update

Apply a change request to an existing component. Routes through the **entry-workflow** which classifies
it as `component-edit` and delegates to the **component-edit** workflow for regression-prevented editing.

**Input**: a component name and a description of the change.
Example: `/mds:craft:update StatsCard "increase the padding and change the accent color"`

## Workflow

1. **Baseline.** `entry-workflow` captures current scores via `doctor all --json` before any change.
2. **Execute:** `Workflow({ name: 'entry-workflow', args: { type: 'component-edit', target: name, instruction } })`
   - The **component-edit** workflow:
     - Records baseline composite + mustFix
     - Applies the change
     - Verifies no regression (composite must not drop, mustFix must not increase)
     - Runs `graph impact art/<name>` to check dependents
3. **Verify.** Gate checks: `doctor all --gate` with delta against baseline.
4. **Reconcile.** Affected dependents are checked via `reconcile-workflow`.

## Skill

Invoke the **`component-build`** skill for detailed component editing guidance.

## Common Intents Routed Here

| Intent Example | Entry-Workflow Route | Layer |
|----------------|---------------------|-------|
| "Change the button color" | `type: component-edit` → `component-edit` | Component |
| "Fix the padding in StatsCard" | `type: component-edit` → `component-edit` | Component |
| "Update the header layout" | `type: component-edit` → `component-edit` | Component |

## Guardrails
- Baseline scores must not regress — composite drop > 0.05 or new mustFix blocks the gate.
- Always reconcile dependents after editing a shared component.
