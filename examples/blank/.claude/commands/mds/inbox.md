---
name: "MDS: Inbox"
description: Drain the browser intent queue (comments, new components, design-system requests from the Storybook panel), classify + route each, and process them with isolated subagents in parallel. The browser→agent bridge.
category: Workspace
tags: [inbox, intents, browser, bridge, workflow, dispatch]
---

# MDS: Inbox

The bridge between the browser cockpit (the emdesign Storybook panel) and the Claude workflow. Humans
point-and-comment / click buttons in Storybook; those become **typed intents**. This command is a thin
supervisor over the **`inbox-loop`** workflow, which drains the whole queue, classifies + groups every intent
(via the `intent-router` subagent), and dispatches independent groups to **isolated subagents in parallel** —
serializing and coalescing same-target work so two agents never edit the same file.

**Input**: none. Run it while the panel + `emdesign serve` are up.

## Workflow
1. **Drain + dispatch a batch.** Call `Workflow({ name: 'inbox-loop' })`. It returns
   `{ drained, processed, surfaced }`:
   - `drained` — how many intents it pulled this cycle. If `0`, the queue is empty → **stop**.
   - `processed` — auto-handled groups (each already `resolve_intent`-ed): component edits run through
     `design-loop` in update mode, new components through `design-loop`, new design systems through
     `create_design_system` → `design-system-loop`. Report their summaries (gate composite / pass).
   - `surfaced` — groups the router flagged `needsHuman` (left `in_progress` for you): design-system edits,
     new **views**, and anything ambiguous or non-actionable.
2. **Human-gate the surfaced groups.** For each surfaced group, `AskUserQuestion` (**Approve / Edit
   instruction / Skip**). On the chosen action:
   - **`system:update`** — first `graph_find_affected('<ds>/--<token>')` to show blast radius, then run the
     `/mds:system:update` flow (edit `DESIGN.md`/`tokens.css` via the `design-md` / `color-expert` skills →
     `validate_design_system` → `graph_rebuild` → re-baseline affected components). Then `resolve_intent(done)`.
   - **`craft:view`** — `Workflow({ name: 'view-loop', args: { name, instruction } })`, then `resolve_intent(done)`.
   - **ambiguous `craft:update`/`craft:component`** — once the human pins the target, `Workflow({ name:
     'design-loop', args: { name, instruction, mode } })` (`mode:'update'` to edit an existing component),
     then `resolve_intent(done)`.
   - **Skip** — `resolve_intent({ id, status: 'done', note: 'deferred by human' })` for each id in the group.
3. **Repeat from step 1** until a cycle returns `drained === 0` (this also catches intents that arrived while
   the previous batch was processing). If the user only wants one pass, stop after the current batch.

## Guardrails
- **Surface, don't mutate.** Design-system edits and destructive/ambiguous intents are never auto-applied —
  the workflow leaves them `surfaced` and you confirm with the human first.
- **Never self-ship.** Component flows pass the gate at threshold, but capturing/shipping stays the human
  `/mds:ship` decision; the inbox never auto-captures.
- **Always resolve.** Every drained intent ends `done` or `error` (the workflow resolves auto + skipped
  groups; you resolve the surfaced ones) so the panel's **Activity** tab never shows stale "in-progress".
- `use-design-system` (switching the active system) is handled by the backend directly — it won't appear here.
