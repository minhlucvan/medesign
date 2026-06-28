---
name: "MDS: System Create"
description: Create a design system — entry-workflow routes to ds-layer-workflow for import, customization, validation, and compilation.
category: System
tags: [system, design-system, create, ds-layer-workflow]
---

# MDS: System Create

Create the design system the whole project builds from. Routes through the **entry-workflow**
which classifies it as `ds-create` and delegates to **ds-layer-workflow** for the appropriate layer.

**Input**: an `id`, a `name`, and a `mode`:
- **brief** — author from a prompt
- **blank** — a skeleton to fill
- **import** — start from a prebuilt base and customize (`from <ref>`)
- **extract** — infer from a brand/reference (vision-assisted)

Example: `/mds:system:create atelier2 "Studio Noir" --mode brief "dark, editorial, electric-lime accent"`

## Workflow

1. **Approve.** `AskUserQuestion` to confirm `id`, `name`, `mode`.
2. **Execute:** `Workflow({ name: 'entry-workflow', args: { type: 'ds-create', target: id, payload: { mode, from, name } } })`
   - The **ds-layer-workflow** determines which DS layer to modify:
     - **Token layer**: `ds customize --primary --font` → `ds validate --strict` → `ds compile`
     - **Primitive layer**: `ds scaffold --blocks`
     - **Lint rule layer**: `ds lint-rules preset`
     - **Compilation**: `ds compile` → `ds export`
3. **Validate.** `ds validate --strict` — the token contract must pass.
4. **Select.** Offer `/mds:system:use <id>` to activate.

## Skill

Invoke the **`design-system-author`** skill for detailed system authoring guidance. For brand extraction, also use **`brand-extract`**.

## Common Intents Routed Here

| Intent Example | Entry-Workflow Route | Layer |
|----------------|---------------------|-------|
| "Create a new design system" | `type: ds-create` → `ds-layer-workflow` | DS |
| "Import Stripe's design" | `type: ds-create` → `ds-layer-workflow` | DS |
| "Extract from brand image" | `type: ds-create` → `ds-layer-workflow` | DS |

## Guardrails
- `tokens.css` must declare every required role; `ds validate --strict` is authoritative.
- Don't invent off-system values; everything maps to a token role.
