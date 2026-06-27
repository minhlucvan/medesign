---
name: "MDS: Craft Component"
description: Build a beautiful, on-system, tested component through the multi-feedback craft loop — analyze context, understand intent, build, verify (rule + visual + vision + LLM/human), iterate until the gate passes. Requires an active design system.
category: Craft
tags: [craft, workflow, feedback-loop, component]
---

# MDS: Craft Component

Drive the emdesign closed feedback loop to produce a component that is **beautiful, consistent, testable,
shippable**. **Precondition: an active design system** (`/mds:system:use <id>` or `/mds:system:create`).
The emdesign server must be running (`emdesign serve`) and Storybook up (`npm run studio`).

**Input**: a natural-language component request, optionally a PascalCase `name`.
Example: `/mds:craft:component "a testimonial section with three quotes" Testimonials`

## Workflow

1. **Approve scope.** Use `AskUserQuestion` to confirm the component `name`, the active design system, and
   the quality `threshold` (default 0.8). Do not proceed without approval.
2. **Analyze context.** Call MCP `get_design_context` (it injects the `@emdesign/graph` consistency brief:
   composable primitives, tokens by kind, governing rules, and the vibe). Read the DESIGN.md sections it
   points to.
3. **Understand intent (spec).** Write `design/changes/<slug>/intent.md` (what + why + acceptance) and
   `brief.md` (the consistency brief). `<slug>` = `kebab(name)`.
4. **Run the loop** via the workflow engine: `Workflow({ name: 'design-loop', args: { name, instruction, threshold } })`.
   The engine, each round: builds/edits the component (MCP `create_component`/`edit_component`), then fans
   out the four feedback sources in parallel —
   - **programmatic/rule**: MCP `lint_consistency` → findings + mustFix;
   - **visual**: MCP `run_visual_test` → pixel-diff status;
   - **vision**: the `vision-critic` subagent Reads MCP `screenshot_path` and returns a 0–1 score + findings;
   - **LLM**: the `design-reviewer` subagent critiques code + spec + DESIGN.md;
   then gates with MCP `critique_score` (`composite ≥ threshold && mustFix === 0 && ratchet`). On fail it
   feeds the P0-first findings + `graph_where_to_fix` (file:line) back into the next `edit_component`.
   It records each round via `record_evidence`.
5. **Human checkpoint.** When the gate passes (or after max rounds), present the preview URL + scores and
   `AskUserQuestion` whether to ship or request changes. Human change-requests re-enter via `/mds:craft:update`.
6. **Ship** only on approval: run `/mds:ship <name>`.

## Guardrails
- Never ship without the `critique_score` gate passing **and** explicit human approval (no self-ship).
- Reference token roles only; obey the design system's Anti-patterns. The lint gate is authoritative —
  do not rationalize a P0 away, fix it.
- Evidence required: every round's scores + screenshot are saved under `design/changes/<slug>/evidence/`.
- If the build doesn't compile/render, that's `mustFix` — fix before scoring anything else.
