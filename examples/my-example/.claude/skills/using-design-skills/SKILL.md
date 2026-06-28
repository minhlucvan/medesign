---
name: using-design-skills
description: Meta-router for emdesign's design loop. Use at the START of any design/build/fix task to pick the right skill + /mds command + feedback sources, and to follow the non-negotiable operating behaviors. Maps each phase (analyze → intent → build → verify → ship) to its tools.
---

# Using design skills (router)

emdesign has **two flows**. **Always select or create a design system first** (Flow A), then craft
against it (Flow B). This skill routes a request; read it first, then dispatch.

## Flow A — Design System (the contract every project starts from)

| Do | Skill | MCP Command | CLI Equivalent | Tools |
|---|---|---|---|---|
| Create a system (brief/blank/import/extract) | `design-system-author` (+ `brand-extract`) | `/mds:system:create` | `ds create/import/search` | `create_design_system`, `validate_design_system`, `design-system-loop` |
| Update a system (tokens/spec) | `design-md`, `color-expert` | `/mds:system:update` | `ds customize/update/lint-rules` | `graph_find_affected` (impact first), `validate_design_system`, `graph_rebuild` |
| Select a system → rewire workspace | — | `/mds:system:use` | `use <id>` | `apply_design_system` (tokens.css + `@ds` + graph) |
| Compile tokens | `ds-compile` | — (CLI only) | `ds compile/export/version` | Token → TypeScript compilation |
| Configure lint rules | `ds-lint-rules` | — (CLI only) | `ds lint-rules preset/set` | Rule presets, exemption management |

## Flow B — Craft (uses the active design system)

| Phase | Do | Skill | MCP Command | CLI Equivalent | Feedback sources |
|---|---|---|---|---|---|
| Analyze + intent | consistency brief | `component-build` | `/mds:craft:component` | `design/ds context` | `get_design_context`, `graph_get_context` |
| Build component | generate code via `@ds` | `component-build` | `/mds:craft:component` | `generate [--content]` | — |
| Build view (page) | decompose → compose | `page-architect` | `/mds:craft:view` | `compose + screen create` | 4 sources, per-leaf + page |
| Stories | variants & states | — | `/mds:craft:story` | `story auto` | visual |
| Verify | score all sources | `design-review` | `/mds:review` | `doctor all --gate` | rule, visual, vision, LLM |
| Vision only | critique looks | — | `/mds:vision` | `vision` | vision |
| Deep analysis | DOM/spatial/a11y | `visual-quality` | — (CLI only) | `render analyze/spatial audit/component a11y` | Deterministic metrics |
| Blueprints | composition patterns | `screen-compose` | — (CLI only) | `ds blueprint apply` | — |
| Pipeline | batch/loop | `pipeline-loop` | — (CLI only) | `loop/generate --batch/capture --all` | Composite gate |
| Update | apply change-request | `component-build` | `/mds:craft:update` | `generate --mode edit` | human + re-verify |
| Ship | gate + capture | — | `/mds:ship` | `capture [--baseline]` | `critique_score` + human approval |

## Which Interface to Use

| Situation | Use MCP (`/mds:*`) | Use CLI Directly |
|-----------|-------------------|-----------------|
| Interactive agent loop with critique | ✅ | ❌ |
| CI/CD pipeline | ❌ | ✅ `doctor all --gate` |
| Batch operations | ❌ | ✅ `generate --batch` |
| Human-in-the-loop review | ✅ | ❌ |
| Headless / server environment | ❌ | ✅ |
| Token compilation | ❌ | ✅ `ds compile` |
| Deep DOM/spatial debugging | ❌ | ✅ `render analyze` |
| Storybook panel integration | ✅ | ❌ |

## Browser bridge (the Storybook panel)
Humans also drive both flows from the **emdesign Storybook panel** — pointing at an element to comment,
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
