---
name: "MDS: Craft Update"
description: Apply a human change-request to the current component (or view) and re-verify through the loop until the gate passes again.
category: Craft
tags: [craft, update, human-feedback, feedback-loop]
---

# MDS: Craft Update

Human feedback enters here. Apply a change-request, then re-run the loop so the result stays on-system and
verified.

**Input**: a change-request in natural language (or pull the queued one from the panel via MCP
`poll_change_request`). Example: `/mds:craft:update "make the highlighted tier use the accent and add a badge"`

## Workflow
1. Get the change-request (argument, or MCP `poll_change_request`).
2. Run `Workflow({ name: 'design-loop', args: { name: '<Component>', instruction: '<change-request>', mode:
   'update' } })`. In `update` mode round 1 calls `edit_component` (modify the existing component in place,
   token roles only, obey Anti-patterns) instead of creating from scratch; it then runs the same four-source
   critique + `critique_score` gate + `record_evidence` each round until it passes. This is the same engine
   `/mds:inbox` routes component edits through.
3. If you are applying a quick one-off without the loop: MCP `get_design_context` → `edit_component` →
   re-run the four-source verify (as in `/mds:review`) and gate with `critique_score`.
4. If it fails, use `graph_where_to_fix` + `graph_find_affected` (to catch knock-on effects) and iterate.
5. Report the new scores + preview URL.

## Guardrails
- A change-request that would alter the design system itself (tokens/spec), not just the component, must be
  surfaced back to the human — don't silently mutate the design system from a component refine.
- Re-verify after every edit; never report "done" without a passing `critique_score`.
