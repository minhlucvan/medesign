# Improvement Roadmap — Closing the Feedback Loop

> **Phased plan to bridge the gap between the research vision and the shipping engine.**
> Each phase is designed to produce a "shippable improvement" — independently valuable,
> not dependent on later phases.

---

## Phase P0 — Close the Loop Automation Gaps (Immediate)

**Status: ✅ Complete (June 2026)**

All P0.1–P0.5 items have been implemented in the `loop-close-gaps` branch.
See [`implementation-gaps.md`](./implementation-gaps.md) for the change log.

**Objective:** Make the critique gate truly automated — the agent calls one tool
and gets back scores from all four sources, then can iterate without manual
score construction.

**Why this phase first:** This is where the friction is highest today. An agent
must call 3-4 tools and manually construct a `RoleScores` object. This is the
single biggest usability gap in the design loop.

### Work Items

| # | Item | Files | Effort | Status |
|---|---|---|---|---|
| P0.1 | **Add `ScoreCollector` orchestrator** — one function that runs lint + visual test + vision critique + doctor rendered rules and returns a pre-populated `RoleScores`. | `packages/backend/src/critique/collector.ts` | Medium | ✅ Done |
| P0.2 | **Add `DiffResult → visual_score` mapping** — implement the documented mapping (`pass=1, new=1, changed=0.5, error=0`). | `packages/backend/src/visualTest.ts` | Small | ✅ Done |
| P0.3 | **Wire `tokenScore()` into MCP** — have `lint_component` return a numeric `tokens` score alongside findings. | `packages/mcp-server/src/mcp.ts` | Small | ✅ Done |
| P0.4 | **Make `evaluate_component` auto-collect** — if `scores` not provided, run `ScoreCollector` internally. | `packages/mcp-server/src/mcp.ts` | Medium | ✅ Done |
| P0.5 | **Fix harness stdin** — keep stdin open in `harness/driver.ts` for iterative prompts. | `packages/backend/src/harness/driver.ts` | Small | ⏳ Pending |
| P0.6 | **Scaffold `.claude/` loop as part of `init`** — install `.claude/workflows/` on `emdesign init`. | `packages/cli/src/init.ts`, `packages/workspace/src/installer.ts` | Medium | ⏳ Pending |

**Dependencies:** None. All items are self-contained package changes.

**Verification:** An agent should be able to call `evaluate_component` with just a
component name (no manual scores) and get back a complete gate verdict with
scores from all active sources.

---

## Phase P1 — Real-Time Spatial Evaluation (Near-term)

**Objective:** Make the DOM-based spatial evaluation the primary visual feedback
source, alongside or replacing pixelmatch diffing. The agent should receive
deterministic layout metrics, not just "pass/fail" screenshot comparisons.

### Work Items

| # | Item | Files | Effort |
|---|---|---|---|
| P1.1 | **Add `spatial_audit` MCP tool** — runs the `doctor` rendered rules (overlap, overflow, off-scale spacing, contrast, tap targets) against the current component and returns structured findings with element coordinates. | `packages/mcp-server/src/mcp.ts`, `packages/doctor/src/spatial.ts` | Medium |
| P1.2 | **Add `spatial` score source** — register `'spatial'` in `ScorerKey` with weight 0.15 in the composite. Feed `spatial_audit` results into an automated score. | `packages/backend/src/critique/scoreboard.ts`, `packages/backend/src/critique/collector.ts` | Small |
| P1.3 | **Round-to-round spatial diff** — compare `RenderSnapshot` of round N vs. round N-1 and report layout shifts > 5px as findings. | `packages/backend/src/renderProbe.ts` (new diff function) | Medium |
| P1.4 | **Expose element bounding boxes to vision-critic** — pass extracted element coordinates alongside the screenshot so the VLM can reference specific elements by region. | `packages/vision-critic/src/context/builder.ts` | Small |
| P1.5 | **Add Storybook health check before visual test** — probe `STORYBOOK_URL` on startup, report clean error if unreachable instead of a cryptic Playwright timeout. | `packages/backend/src/visualTest.ts` | Small |

**Dependencies:** P1.2 depends on P0.1 (ScoreCollector should include spatial).
P1.3 depends on `renderProbe.ts` (already built). Others are independent.

**Verification:** `spatial_audit --component Testimonials` returns findings like
`{"type": "overlap", "elements": [".card:3", ".badge:1"], "overlap": 4}`. The
critique gate's composite includes a `spatial` score.

---

## Phase P2 — Dual-Agent Architecture (Medium-term)

**Objective:** Decouple code generation from visual inspection by introducing a
dedicated inspector agent. The builder generates code; the inspector evaluates
output and feeds structured feedback back — no context-switching cost.

### Work Items

| # | Item | Files | Effort |
|---|---|---|---|
| P2.1 | **Define `InspectorAgent` interface** — a minimal agent that takes a screenshot + design system context and returns structured scores (visual, spatial, accessibility). | `packages/backend/src/harness/types.ts` | Small |
| P2.2 | **Build dedicated vision inspector agent adapter** — a lightweight Claude Sonnet agent (or external VLM) that takes one job: score the screenshot. No codegen tools. | `packages/backend/src/harness/inspectors/vision.ts`, `.claude/agents/vision-inspector.md` | Medium |
| P2.3 | **Package `LoopOrchestrator` in `@emdesign/backend`** — extract the loop control logic from `.claude/workflows/design-loop.js` into a first-class package API. Parallel critic fan-out, score collection, gate, iterate. | `packages/backend/src/loop/orchestrator.ts`, `packages/backend/src/loop/stages.ts` | Large |
| P2.4 | **Add `run_design_loop` MCP tool** — agent calls one tool with a component name + prompt; the orchestrator manages iteration internally, returns after loop converges or hits max rounds. | `packages/mcp-server/src/mcp.ts` call into `LoopOrchestrator` | Medium |
| P2.5 | **Make vision feedback mandatory** — the critique gate requires at least one vision score for `ship`, with deterministic fallback (doctor rendered rules score) if no VLM configured. | `packages/backend/src/critique/score.ts` | Small |

**Dependencies:** P2.3 depends on the automatic score collection from P0.1.
P2.4 depends on P2.3 and P0.4. P2.5 depends on P1.5 (health check) and P1.1
(spatial fallback).

**Verification:** `run_design_loop "a testimonial section" Testimonials` completes
in 1-3 iterations without the user seeing intermediate steps. The builder and
inspector are separate processes.

---

## Phase P3 — Design System Compiler Hardening (Medium-term)

**Objective:** Constrain the agent to the design system's primitives at generation
time, not just catch violations after the fact. Move from "free code gen with
linting" to "structured orchestration of pre-compiled primitives."

### Work Items

| # | Item | Files | Effort |
|---|---|---|---|
| P3.1 | **Add primitive-usage lint rule (P0)** — flag raw `<div>` / `<span>` when `Box`/`Stack` exists, inline `className` with non-token values. | `packages/dsr/src/rules/lint.ts` | Medium |
| P3.2 | **Dynamic codegen instructions** — the prompt composer should enumerate the actual `code/` primitives available for the active design system with their props and accepted values, not just generic guidance. | `packages/backend/src/designContext.ts` | Medium |
| P3.3 | **Define structural primitive set** — `Box`, `Stack`, `Grid`, `Cluster`, `Center` — these handle ALL spacing and layout. Codegen instructions say "no flexbox classes." | `design-systems/*/code/` per system, documented in `spec.md` | Large |
| P3.4 | **AST-level structural lint** — parse the generated JSX into a lightweight AST and check component hierarchy: are primitives nested correctly? Are structural primitives used for layout? | `packages/dsr/src/rules/ast-lint.ts` (new) | Large |

**Dependencies:** P3.1 is independent. P3.2 depends on the design system having
a complete `code/` directory. P3.3 is a design-system authoring effort, not an
engine change. P3.4 is the largest item.

**Verification:** A component written with raw `<div className="flex gap-4">`
instead of `<Stack gap="md">` fails with P0. The codegen prompt tells the agent
"the only layout primitives are Box, Stack, Grid, Cluster, Center."

---

## Phase P4 — Uniform Code Pipelines (Long-term)

**Objective:** Bridge from design tools (Figma) to emdesign components. A Figma
file becomes a deterministic transformation into primitives, tokens, and
component code — no guessing.

### Work Items

| # | Item | Files | Effort |
|---|---|---|---|
| P4.1 | **Figma token export plugin** — extracts colors, typography, spacing, shadows from a Figma file into `tokens.css` format. | `tools/figma-token-export/` (new repo or plugin) | Large |
| P4.2 | **Layout-to-primitive mapper** — given a Figma frame JSON tree, map each node to the closest emdesign primitive and scaffold a component. | `packages/backend/src/import/layout-mapper.ts` (new) | Very Large |
| P4.3 | **Two-way AST diff** — Figma change → AST diff → component patch. Bidirectional: component change → Figma frame update. | `packages/backend/src/import/ast-diff.ts` (new) | Very Large |
| P4.4 | **Design system auto-extraction** — from a Figma file, auto-generate a complete `design-systems/<id>/` directory structure with DESIGN.md, tokens.css, and code/ primitives. | `packages/cli/src/import-from-figma.ts` (new) | Very Large |

**Dependencies:** P4.1 is independent. P4.2 depends on a robust set of structural
primitives (P3.3). P4.3 builds on the DOM diff work from P1.3.

**Verification:** Running `emdesign figma-import <file-key>` produces a
fully-functioning `design-systems/<id>/` that passes `ds validate`.

---

## Effort Summary

| Phase | Description | Effort | Value | Shippable standalone? |
|---|---|---|---|---|
| **P0** | Close loop automation | ~2 weeks | ✅ Immediate UX improvement | ✅ Yes |
| **P1** | Spatial evaluation | ~2-3 weeks | ✅ Makes visual feedback deterministic | ✅ Yes |
| **P2** | Dual-agent architecture | ~4-6 weeks | ✅ Production-quality loop | ⚠️ Depends on P0 |
| **P3** | DS compiler hardening | ~4-6 weeks | ✅ Eliminates whole classes of bugs | ⚠️ Depends on DS authoring |
| **P4** | Uniform code pipelines | ~8-12 weeks | ✅ Figma→code bridge | ✅ Yes, but big |

**Recommended sequencing:** P0 → P1 → (P2 parallel with P3) → P4.
P0 and P1 are independent of each other and can run concurrently with different
contributors. P2 and P3 depend on P0's score collector but not on each other,
so they can also be parallelized.

---

## What We Should NOT Do

1. **Rewrite the critique gate.** The gate logic (composite + dual-gate + ratchet +
   per-source floors) is correct and clean. What needs fixing is the automation
   around it, not the gate itself.

2. **Replace pixelmatch with an LLM judge.** Pixelmatch is deterministic and
   zero-cost per run. The vision critic complements it. Don't replace one with
   the other.

3. **Build the Figma pipeline before the loop works.** The biggest bottleneck today
   is the feedback loop, not the import pipeline. Closing the loop (P0+P1) should
   come first.

4. **Over-engineer the state machine.** A lightweight FSM with transition guards
   (3-4 states, no nested workflows) is enough. A full BPMN-style workflow engine
   would be overkill for the current complexity.
