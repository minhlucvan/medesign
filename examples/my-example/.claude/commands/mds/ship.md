---
name: "MDS: Ship"
description: Gate a component and, only if it passes and a human approves, capture it as a reusable, documented, committed component with saved evidence.
category: Design
tags: [design, ship, capture, gate, checkpoint]
---

# MDS: Ship

The shippable checkpoint. The agent never ships on its own — this requires a passing gate **and** human approval.

**Input**: a component name. Example: `/mds:ship Testimonials`

## Workflow

1. **Gate check.** Run the full composite gate:
   ```bash
   emdesign doctor all <name> --gate --json
   ```
   This checks: token lint, visual diff, spatial geometry, charters — all must pass with `mustFix === 0`
   and `composite >= 0.8`.
2. **Human approval.** `AskUserQuestion` — present the scores and ask: "Ship this component?"
3. **Capture.** If approved:
   ```bash
   emdesign capture <name> --baseline
   ```
   This promotes the component from `src/generated/` to `src/components/<name>/` and seeds a
   Playwright visual baseline screenshot.
4. **Reconcile.** Run `graph impact art/<name>` to check if any dependent components need re-verification.
5. **Record.** Log the evidence: scores, screenshot, and decision under `design/changes/<slug>/evidence/`.

## Gate Criteria (from `scoreComponent`)

```
composite >= 0.8  AND  mustFix === 0  AND  composite >= baseline (ratchet)
```

## Common Intents Routed Here

| Intent Example | Action |
|----------------|--------|
| "Ship the StatsCard" | `doctor all --gate` → `capture --baseline` |
| "Promote the DataTable" | Gate check → human approval → capture |

## Guardrails
- **Never self-ship.** Always require human approval after gate passes.
- If gate fails, report the unsatisfiedConditions and return to `/mds:craft:update`.
