---
name: "MDS: Review"
description: Full read-only audit of a component — entry-workflow routes to component-audit for deterministic scores, spatial analysis, a11y scan, and prioritized fix list. No edits.
category: Design
tags: [design, review, audit, component-audit, read-only]
---

# MDS: Review

A one-shot, read-only pass of the full critique on an existing component. Routes through the
**entry-workflow** which classifies it as `audit` and delegates to **component-audit**.

**Input**: a component name. Example: `/mds:review PricingTiers`

## Workflow

1. **Execute:** `Workflow({ name: 'entry-workflow', args: { type: 'audit', target: name } })`
   - The **component-audit** workflow runs deterministically:
     - **Score check**: `doctor all --json` → current composite + mustFix
     - **Deep analysis**:
       - `render analyze` → semantic DOM tree + coordinates
       - `spatial audit --grid` → overlap detection + grid adherence
       - `component a11y` → axe-core violation tree
     - **Report**: Prioritized fix list (P0 → P1 → P2) with exact file:line locations
2. **Report.** Present the findings: composite score, mustFix count, spatial overlaps, a11y violations.
   No edits are made — this is a diagnostic pass.

## Skills

Invoke **`design-review`** for visual audit + fix planning and **`visual-quality`** for deep spatial/a11y analysis.

## Common Intents Routed Here

| Intent Example | Entry-Workflow Route | Layer |
|----------------|---------------------|-------|
| "Audit the StatsCard component" | `type: audit` → `component-audit` | Component |
| "Full review of the dashboard" | `type: audit` → `component-audit` | Component |
| "Check accessibility issues" | `type: audit` → `component-audit` | Component |

## Guardrails
- Read-only — no edits are made during review.
- The output is a prioritized fix list; use `/mds:craft:update` to apply fixes.
