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
1. Run the full four-source verify (as `/mds:review`) and MCP `critique_score({ scores, mustFix, component })`.
2. If `decision !== 'ship'` (gate or ratchet fails), STOP and report what's blocking + `where_to_fix`. Do not capture.
3. `AskUserQuestion`: show the preview, the composite + per-source scores, and the visual diff; ask for explicit
   approval to ship.
4. On approval: MCP `capture_reusable_component <name>` (promotes to `src/components/`, git-adds) and
   `record_evidence` for the final round. Suggest `graph_rebuild` so the new component is indexed.

## Guardrails
- Hard gate: no capture unless `critique_score.decision === 'ship'` and the human approved. Two conditions, both required.
- Evidence required: the final scores + screenshot are saved under `design/changes/<slug>/evidence/`.
- Capturing updates the component's ratchet baseline; a later version must score at least as high.
