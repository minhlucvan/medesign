---
name: using-design-skills
description: Meta-router for medesign's design loop. Use at the START of any design/build/fix task to pick the right skill + /mds command + feedback sources, and to follow the non-negotiable operating behaviors. Maps each phase (analyze → intent → build → verify → ship) to its tools.
---

# Using design skills (router)

medesign has **two flows**. **Always select or create a design system first** (Flow A), then craft
against it (Flow B). This skill routes a request; read it first, then dispatch.

## Flow A — Design System (the contract every project starts from)

| Do | Skill | Command | Tools |
|---|---|---|---|
| Create a system (brief/blank/import/extract) | `design-system-author` (+ `brand-extract`) | `/mds:system:create` | `create_design_system`, `validate_design_system`, `design-system-loop` |
| Update a system (tokens/spec) | `design-md`, `color-expert` | `/mds:system:update` | `graph_find_affected` (impact first), `validate_design_system`, `graph_rebuild` |
| Select a system → rewire workspace | — | `/mds:system:use` | `apply_design_system` (tokens.css + `@ds` + graph) |

## Flow B — Craft (uses the active design system)

| Phase | Do | Skill | Command | Feedback sources |
|---|---|---|---|---|
| Analyze + intent | consistency brief + `intent.md`/`brief.md` | `component-build` | (in `/mds:craft:component`) | `get_design_context`, `graph_get_context` |
| Build component | generate code-first via `@ds` | `component-build` (+ `web-section`) | `/mds:craft:component` | — |
| Build view (page) | decompose → author/reuse leaves → compose → verify the whole | `page-architect` (+ `component-build`) | `/mds:craft:view` | the 4 sources, per-leaf + page-level |
| Stories | variants & states | — | `/mds:craft:story` | visual |
| Verify | score against all sources | `design-review` | `/mds:review` | rule, visual, vision, LLM |
| Vision only | critique how it looks | — | `/mds:vision` | vision |
| Update | apply human change-request | `component-build` | `/mds:craft:update` | human + re-verify |
| Ship | gate + capture | — | `/mds:ship` | `critique_score` + human approval |

## Browser bridge (the Storybook panel)
Humans also drive both flows from the **medesign Storybook panel** — pointing at an element to comment,
or clicking *New component* / *Create design system*. Those become **typed intents** in a queue. Start a
working session with **`/mds:inbox`**: it runs the `inbox-loop` workflow, which drains the whole queue
(`poll_intent`), has the **`intent-router`** subagent classify + group each intent — sub-classifying free-text
(a comment that's really a token change → `system:update`; a "new X" → `craft:component`/`craft:view`),
keying each by target — then dispatches independent groups to **isolated subagents in parallel**, while
**serializing + coalescing** same-target work so two agents never edit the same file. Component edits and new
artifacts run automatically (gated, never auto-shipped); **design-system edits and ambiguous intents are
surfaced** for a human gate (`surface-don't-mutate`). Every intent ends `resolve_intent(done|error)` so the
panel's Activity tab stays current.

## The gate (how "done" is decided)
`critique_score`: `composite ≥ threshold && mustFix === 0 && composite ≥ baseline`. The deterministic tools
(lint, visual test) are authoritative — derive pass/fail from `critique_score`, never from prose.

## Core operating behaviors (non-negotiable)
0. **Design system first** — there must be an active design system before crafting; create/select one (Flow A).
1. **Analyze before building** — always start from `get_design_context` + the graph; never free-hand.
2. **Token roles only** — never raw hex/off-system values; the lint gate blocks them.
3. **Verify, don't assume** — re-run the gate after every edit; "looks fine" is not evidence.
4. **Evidence required** — `record_evidence` each round (scores + screenshot).
5. **Never self-ship** — `/mds:ship` needs a passing gate AND human approval.
6. **Fix at the source** — use `graph_where_to_fix` to fix the responsible token/primitive/section, not the symptom.
7. **Surface, don't silently mutate** — a component change that needs a design-system change goes back to the human.

The full engine: [`docs/harness-engine.md`](../../../docs/harness-engine.md).
