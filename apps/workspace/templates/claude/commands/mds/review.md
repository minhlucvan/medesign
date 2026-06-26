---
name: "MDS: Review"
description: Run the four-source critique once on a component and report scores + concrete where-to-fix (file:line) — no edits.
category: Design
tags: [design, review, feedback-loop, read-only]
---

# MDS: Review

A one-shot, read-only pass of the full critique on an existing generated component.

**Input**: a component name (default: the current component). Example: `/mds:review PricingTiers`

## Workflow
1. **Programmatic/rule**: MCP `lint_consistency` → findings + mustFix. For each finding, MCP
   `graph_where_to_fix` → the responsible token/section + exact `file:line`.
2. **Visual**: MCP `run_visual_test` → pixel-diff status vs baseline.
3. **Vision**: spawn the `vision-critic` subagent on MCP `screenshot_path` → score + findings.
4. **LLM**: spawn the `design-reviewer` subagent → score + findings.
5. **Gate**: MCP `critique_score({ scores, mustFix })` → composite + decision.
6. Report a compact table: each source's score, the composite + decision, and the P0-first fix list with
   `file:line`. Do **not** edit anything (use `/mds:refine` to act on it).

## Guardrails
- Read-only. No `edit_component`, no capture.
- Always derive pass/fail from `critique_score`, never from prose ("looks fine").
