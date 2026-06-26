# Gap Analysis — emdesign: Research Vision vs. Current Implementation

> **What the `broken-fe-loop.md` proposes, what we actually built, and what bridges the gap.**
> Covers all four research pillars plus cross-cutting findings across the critique gate,
> agent orchestration, tool surface, and testing maturity.

---

## Overview

The research document [`broken-fe-loop.md`](./broken-fe-loop.md) makes a compelling case:
*stronger models alone won't solve the frontend bottleneck.* It argues for four
infrastructure-level shifts. This document measures each proposal against what exists in the
codebase today, describes where we already deliver, and surfaces the concrete gaps
that prevent the vision from being realized.

**Bottom line:** We built ~80% of the engine (lint, visual test, critique gate, plugin
system, graph engine, vision critic, doctor, MCP surface), but the **orchestration layer**
that connects these parts into the seamless double-loop described in the vision does not
live in the packages — it lives in `.claude/workflows/` as ad-hoc scripts, leaving the
"out of the box" experience with no automated feedback loop.

---

## 1. Real-Time Headless Rendering & Semantic DOM Trees

### Vision (from `broken-fe-loop.md`)

> "Instead of relying on slow VLMs to look at screenshots, agents need a native, real-time
> spatial evaluation engine. A specialized compilation layer that translates code directly
> into a semantic, coordinate-based grid."
>
> "Rather than asking 'Does this look centered?', the agent's environment should calculate:
> `Component A overlaps Component B by 4px` or `Contrast ratio is 2.1:1 (Fail)`."

### Current Reality

We have the **foundation** but it is **not used as the primary feedback mechanism**.

| Piece | Status | Location |
|---|---|---|
| `renderProbe.ts` — Playwright-based DOM snapshot | ✅ Built | `packages/backend/src/renderProbe.ts` |
| Extracts full computed styles + element geometry | ✅ Built | Returns `RenderSnapshot` with DOM tree |
| `doctor` rendered rules (overlap, overflow, contrast, tap targets) | ✅ Built | `packages/plugin-core/src/doctor/rendered.ts` with 7 rules |
| `render_preview` MCP tool | ✅ Built | `packages/mcp-server/src/mcp.ts` |
| **Used as primary visual feedback in the agent loop** | ❌ Not done | Visual feedback is still pixelmatch-based |
| **Spatial metrics API exposed to agent** | ❌ Not done | No MCP tool returns spatial metrics on demand |
| **Deterministic layout scoring** | ❌ Not done | `doctor` rules run offline, not as feedback per round |

### The Gap

We extract a rich DOM snapshot (`RenderSnapshot` with full element hierarchy, computed
styles, and box model) but the agent never sees it. The primary visual feedback channel
remains pixelmatch diffs against a baseline image — a 0/1 pass/fail signal with no
actionable spatial information. The `doctor` rendered rules (overlap, overflow, off-scale
spacing, contrast, tap targets) run as a batch diagnostic, not as per-round critique
feedback.

### Recommended Improvements

1. **Promote `RenderSnapshot` to a first-class critique source.** Add an MCP tool
   `spatial_audit` that runs the rendered doctor rules against the current component and
   returns findings with element coordinates. Feed these into the critique gate as a new
   `spatial` score source.

2. **Spatial diff between rounds.** Compare the `RenderSnapshot` of round N vs. round N-1
   to answer: "Did fixing the off-token color shift the layout by > 5px?" Surface this
   as part of the critique output.

3. **Expose element geometry to the vision-critic.** Pass the extracted bounding boxes
   along with the screenshot so the VLM can reference specific elements by coordinate
   region rather than guessing "top-left area."

---

## 2. Shift from "Free Code Gen" to "Design System Compilers"

### Vision (from `broken-fe-loop.md`)

> "Asking an agent to write raw CSS or Tailwind from scratch creates infinite surface
> area for bugs and visual drift. The agent shouldn't choose colors or padding sizes; it
> should only orchestrate pre-compiled, bulletproof structural layout primitives and
> design tokens."
>
> "If the design system code itself is structurally sound and accessible by default, the
> agent cannot physically generate broken layouts or invalid CSS paradigms."

### Current Reality

We have **strong enforcement after generation** but the **agent still generates free-form
JSX** with no structural constraints.

| Piece | Status | Location |
|---|---|---|
| Token contract (`tokens.css` required role families) | ✅ Built | `packages/dsr/src/domain/values.ts` — 11 required roles |
| Plugin system with 5 real plugins | ✅ Built | `packages/backend/src/plugins/` — react, css, tailwind, shadcn, core |
| Consistency lint (15 rules, P0 blocks gate) | ✅ Built | `packages/dsr/src/rules/lint.ts` |
| Token reference lint (every `var()` resolved) | ✅ Built | P0 if unresolved |
| `code/` primitives directory | ✅ Built | `design-systems/<id>/code/` with composable React primitives |
| **Structured output constraints on the agent** | ❌ Not done | Agent can write arbitrary JSX, any component structure |
| **Pre-compiled layout primitives enforced** | ❌ Not done | Agent may bypass `code/` primitives and write raw divs |
| **AST-level lint (check structure, not just tokens)** | ❌ Not done | All lint is text-pattern based or CSS-parser based |

### The Gap

After generation, the lint catches token violations and anti-patterns. But the **agent
is free to write any JSX it wants** — it can ignore `code/` primitives, write raw `<div>`
elements, use arbitrary Tailwind classes, or invent component APIs not in the design
system. The only enforcement is the token reference lint (`var()` resolution) and the
anti-slop rules (indigo gradients, emoji icons, filler copy). There is no mechanism to
constrain the agent to the design system's primitives at generation time.

### Recommended Improvements

1. **Primitive-usage lint rule (P1 → P0).** Add a lint rule that flags usage of:
   - Raw `<div>` / `<span>` where a `Box` or `Stack` primitive exists
   - Inline `className` strings with non-token values
   - Components not in the design system's `code/` manifest

2. **Pre-compiled structural primitives.** Define a set of "structural" primitives (`Box`,
   `Stack`, `Grid`, `Cluster`, `Center`) that handle all spacing and layout. The agent's
   codegen instructions should say "you may NOT use flexbox classes directly — use
   `<Stack gap="md">` instead."

3. **Scaffold-aware codegen instructions.** Have the codegen instructions dynamically
   reference the actual `code/` primitives available for the active design system, with
   their props and accepted values, not just generic guidance.

---

## 3. Double-Loop Execution (Dual-Agent Architecture)

### Vision (from `broken-fe-loop.md`)

> "We need a division of labor where code generation and visual validation are entirely
> decoupled, mimicking how a human Developer and a QA/Designer work together."
>
> "Agent A (The Builder): Focuses strictly on component composition, state mapping, and
> passing the right props. Agent B (The Visual Inspector): A highly specialized, fast
> vision model whose only job is to diff the expected design artifact against the
> generated output and feed precise layout telemetry back to the Builder."

### Current Reality

**Single-agent architecture.** The builder also handles critique, self-correction, and
iteration. The vision-critic is a subagent called from within the same turn.

| Piece | Status | Location |
|---|---|---|
| Single agent builds AND critiques | ✅ Current design | Agent calls MCP tools in sequence |
| Vision-critic subagent | ✅ Built | `.claude/agents/vision-critic.md` |
| Design-reviewer subagent | ✅ Built | `.claude/agents/design-reviewer.md` |
| Consistency-auditor subagent | ✅ Built | `.claude/agents/consistency-auditor.md` |
| **Separate builder and inspector processes** | ❌ Not done | Single MCP connection |
| **Dedicated VLM loop** | ❌ Not done | Vision critique is best-effort, not mandatory |
| **Parallel critic fan-out with barrier** | ❌ Not done | `design-loop.js` uses `parallel()` in `.claude/workflows/` |

### The Gap

The architecture docs (`harness-engine.md`) describe four critics running in parallel,
feeding into a deterministic gate — but this logic lives in `.claude/workflows/design-loop.js`,
not in the packages. The packages export the building blocks (tools to lint, test, vision-critique,
score) but no orchestrator connects them. The result is that every agent session must
re-discover the loop protocol, and the vision critic is entirely opt-in (no API key = no
vision feedback).

More critically, the single-agent design means the agent spends reasoning tokens on
both building and critiquing. A dedicated inspector agent could run lightweight vision
models repeatedly with no context-switching cost.

### Recommended Improvements

1. **Package a `LoopOrchestrator` in `@emdesign/backend`.** Move the loop control logic
   (fan-out critics → collect scores → gate → decide iterate or ship) from
   `.claude/workflows/` into a first-class package API. The `.claude/` workflows then
   become thin wrappers.

2. **Dedicated vision inspector agent.** Make the vision-critic an always-on companion
   agent that the main process can hand a screenshot to and receive structured scores
   back — decoupled from the builder's context.

3. **Mandatory vision feedback.** The critique gate should require at least one vision
   score to produce a `ship` verdict (with a fallback to a deterministic visual score
   from the `doctor` rendered rules if no VLM is configured).

---

## 4. Uniform Code Pipelines (Figma-to-React Standard)

### Vision (from `broken-fe-loop.md`)

> "Standardizing the pipeline so that design tools output a deterministic AST will
> eliminate the 'guessing game.' If an AI agent can read a layout as a precise structural
> tree rather than a flat image, the frontend bottleneck completely evaporates."

### Current Reality

**Nothing exists.** There is no Figma integration, no design-tool import, and no
AST-to-code pipeline.

| Piece | Status |
|---|---|
| Figma plugin / API connector | ❌ Not built |
| Design-file AST parser | ❌ Not built |
| Design-tool-to-primitive mapping | ❌ Not built |
| AST-based code generation | ❌ Not built |

### The Gap

This is the farthest-future pillar. The entire emdesign pipeline starts from a
hand-authored `DESIGN.md` + `tokens.css` — there is no path from a Figma file or
Sketch document to a design system. The `broken-fe-loop.md` research correctly
identifies this as the missing layer, but bridging it requires significant investment
in Figma's REST API, layout-to-primitive mapping algorithms, and AST differencing.

### Recommended Improvements

1. **Figma token export.** Build a Figma plugin that exports design tokens (colors,
   typography, spacing, shadows) from a Figma file into emdesign's `tokens.css` format.
   This is the highest-leverage starting point because tokens cover ~60% of the
   design-system contract.

2. **Layout-to-primitive mapping.** Given a Figma frame (a JSON tree of nodes with
   absolute positioning), map each node to the closest emdesign primitive (`Box`,
   `Stack`, `Button`, `Card`, etc.) and produce a scaffolded component. This would
   give the agent a starting point rather than a blank file.

3. **AST-based code transformations.** After the layout mapping is stable, build a
   two-way diff: Figma change → AST diff → component patch, and component change →
   AST diff → Figma update. This closes the designer-developer loop.

---

## 5. Critique Gate Automation Gaps

### The Gap

The critique gate is the **most architecturally sound but least automated** part of
the system. The gate itself (`critique/scoreboard.ts` + `critique/score.ts`) is clean,
deterministic, and has the right dual-gate + ratchet + per-source floors semantics.
However, **feeding scores into the gate is entirely the agent's responsibility.**

| Gap | Detail | Impact |
|---|---|---|
| **No automated `visual` score** | `visualTest.ts` returns `DiffResult` (pass/changed/new/error) but no one converts this to a 0-1 numeric score. Docs say "pass=1, changed=0.5, new=1" but this mapping is nowhere in code. | Agent must guess the visual quality score |
| **No automated `tokens` score** | `lint/index.ts` exports `tokenScore()` function that computes a 0-1 score from findings — but it is **never called** anywhere in the codebase. | Agent must hand-compute or guess the token score |
| **No automated `vision` score integration** | `vision_review` MCP tool returns a `VisionCritiqueResult` with axes scores, but nothing pipes these into `evaluate_component`. | Agent must manually extract and re-submit scores |
| **Agent constructs the score object by hand** | The `evaluate_component` MCP tool takes `scores: RoleScores` as input — the agent supplies all values. The architecture describes an automated pipeline where critics fan out and scores flow in. | Agent must call 3-4 tools, extract results, and construct the score object manually |
| `tokenScore()` is dead code | Defined at `packages/backend/src/lint/index.ts:28-35`, never imported or called. | Maintained but unused |

### Recommended Improvements

1. **Add a `ScoreCollector` orchestrator** in `packages/backend/src/critique/collector.ts`.
   One function: given a component name, runs lint (`tokenScore`), visual test
   (`DiffResult → visual score`), vision critique (if configured), and returns a
   pre-populated `RoleScores` object. The agent calls one tool instead of four.

2. **Add `visual_score` utility.** A one-liner mapping `DiffResult.status` to a
   numeric score: `{ pass: 1, new: 1, changed: 0.5, error: 0 }`. Use it in the
   `ScoreCollector`.

3. **Wire `tokenScore()` into the MCP tools.** The `lint_component` tool should
   return a numeric `tokens` score alongside the finding list.

4. **Have `evaluate_component` optionally auto-collect scores.** If the agent doesn't
   supply `scores`, have the tool run the collectors itself.

---

## 6. Orchestration & Loop Control Gaps

### The Gap

The feedback loop described in `harness-engine.md` (analyze → build → verify →
gate → ship or revise) is **not programmatically enforced by any code in the packages**.
It exists as prose in docs and as `.claude/workflows/` scripts that are project-specific.

| Gap | Detail | Impact |
|---|---|---|
| **Loop lives in `.claude/workflows/`, not in packages** | `design-loop.js`, `core-loop.js` are part of the workspace template, not scaffolded or versioned with the engine | Out-of-the-box experience has no loop |
| **No state machine for change requests** | `state.ts` is a flat JSON store with no FSM transitions or guards. `setChangeRequestStatus` just maps over an array. | No lifecycle enforcement, two processes can simultaneously mutate |
| **Harness driver closes stdin after first prompt** | `harness/driver.ts: child.stdin.end()` after writing the initial prompt | Cannot support iterative loops through the harness |
| **No scaffold produces a working loop setup** | `emdesign init` creates the project structure but doesn't install `.claude/workflows/` with loop scripts | Every new project must manually wire the loop |
| `composePrompt()` is exported but never called | `designContext.ts` exports `composePrompt()` but `mcp.ts` re-implements composition inline | Dead code, drift between the two implementations |

### Recommended Improvements

1. **Extract loop orchestration into `@emdesign/backend`.** Create
   `packages/backend/src/loop/` with a `DesignLoop` class that encapsulates the
   four-stage lifecycle: analyze → build → critique → gate. The MCP tool surface
   can then expose `run_design_loop(componentName, prompt)` that returns after the
   loop converges or hits max rounds. This makes the loop a package-level primitive
   rather than an ad-hoc workflow script.

2. **Add a lightweight FSM for change requests.** Add status transition guards to
   `state.ts` so that `queued → in_progress → done` transitions are enforced and
   concurrent mutations are detected.

3. **Fix harness stdin.** Make `harness/driver.ts` keep stdin open (like
   `AgentRunner` in `@emdesign/session` already does) so the harness can drive
   iterative loops without needing the session package.

4. **Scaffold the loop as part of `init`.** The `emdesign init` command should
   install `.claude/workflows/`, `.claude/commands/mds/`, and `.claude/agents/`
   so a fresh project immediately has the loop wired.

5. **Refactor `mcp.ts` to call `composePrompt()`.** Instead of duplicating the
   composition logic, have the `get_design_context` tool call
   `designContext.composePrompt()`.

---

## 7. Tool Surface Inconsistencies

### The Gap

The architecture docs (`architecture.md`, `harness-engine.md`) and the MCP tool
implementation are out of sync. Tool names, boundaries, and contracts differ.

| Documented Name | Actual Name | Impact |
|---|---|---|
| `critique_score` | `evaluate_component` | Confusing, agent training data references the old name |
| `run_visual_test` | `test_component` (also wraps render) | Semantic mismatch — test_component does more |
| `render_preview` | No separate tool | Docs say it exists, it doesn't |
| `record_evidence` | Side-effect of `evaluate_component` | No standalone evidence recording tool |
| `lint_consistency` | `lint_component` | Name change, same semantics |
| `poll_change_request` | `handle_change_request` (mode: poll) | Folded into one tool |

Additionally:

- `manage_design_system` is a **mega-tool** that does ~8 things (create, apply,
  validate, grade, scaffold, conflicts, history, list). This violates the MCP
  principle of one tool per operation. It's hard for the agent to discover and
  use individual operations.
- `vision_review` uses `STORYBOOK_URL` from env instead of the configured URL
  in `emdesign.config.json`, creating a potential mismatch.

### Recommended Improvements

1. **Alias tools** so both old and new names resolve to the same handler (e.g.,
   register both `critique_score` and `evaluate_component` pointing to the same
   function).

2. **Split `manage_design_system`** into individual tools:
   `create_design_system`, `apply_design_system`, `validate_design_system`,
   `grade_design_system`, `scaffold_primitives`, `list_design_systems`,
   `detect_conflicts`, `get_history`. The single mega-tool is hard for agents
   to discover and typically only used for `list` and `apply`.

3. **Fix `vision_review`** to read `storybookUrl` from the project config before
   falling back to the env var.

4. **Update architecture.md** to match the actual tool names.

---

## 8. Quality & Testing Gaps

### The Gap

Despite the complexity of the critique, lint, and scoring systems, there are
**no automated tests** for these critical paths. This makes refactoring risky.

| Gap | Detail | Impact |
|---|---|---|
| **No tests for critique/scoring** | `critique/scoreboard.ts` and `critique/score.ts` are pure functions with no unit tests | Refactoring the gate is blind |
| **No tests for visual test** | `visualTest.ts` has no tests | Changes to screenshot/pixelmatch logic untested |
| **No tests for lint rules** | `lint/index.ts` and `@emdesign/dsr` lint rules have no tests | Anti-slop rules drift without detection |
| **`toStoryId()` is fragile** | Uses naive kebab-case — "PricingTiers" → `pricingtiers` (should be `pricing-tiers`). "CTAAction" → `ctaaction` | Story IDs may collide |
| **Evidence system is write-only** | Round JSON files are written but never read by any programmatic consumer | Evidence accumulates without value |
| **Baseline ratchet only tracks composite** | Per-source floor improvements over baseline are not tracked | A component could ship with lower vision score if composite is high enough |

### Recommended Improvements

1. **Add vitest tests for critique/scoreboard.ts.** At minimum: `computeComposite`
   with various score subsets, `decideRound` dual-gate semantics (high composite +
   mustFix > 0 → continue), per-source floor checks, ratchet logic.

2. **Add vitest tests for visualTest.ts.** Test `toStoryId` with edge cases
   (all-caps, numbers, single-word), `DiffResult` status mapping, error on
   missing Storybook.

3. **Add vitest tests for lint rules.** Test each anti-slop rule with matching
   and non-matching input, P0/P1 severity assignment, fringe cases.

4. **Fix `toStoryId()`** with a proper slugify: insert dash before uppercase
   letters, lowercase, strip non-alphanumeric.

5. **Add evidence indexing.** Create a lightweight index so the critique gate
   can query "what was the vision score last round?" without parsing JSON files.

6. **Track per-source baselines.** Extend `baselines.json` to store per-source
   scores so the ratchet can enforce "never regress on vision score" independently
   of composite.

---

## Summary: Where We Stand

| Research Pillar | Implementation Status | Automation Gap |
|---|---|---|
| Headless rendering / DOM trees | ✅ Foundation built (`renderProbe.ts`, doctor rules) | ❌ Not used as primary feedback |
| Design system compilers | ✅ Token enforcement + linting | ❌ No generation-time constraints |
| Dual-agent architecture | ❌ Single-agent only | ❌ No dedicated inspector agent |
| Uniform code pipelines | ❌ Nothing built | ❌ Full gap |
| **Critique gate automation** | ✅ Gate logic clean | ❌ Score collection manual |
| **Loop orchestration** | ✅ Building blocks exist | ❌ No programmatic loop in packages |
| **Tool surface** | ✅ Tools work | ⚠️ Names mismatch docs, mega-tool |
| **Testing** | ❌ No automated tests | ❌ Full gap |

The central insight: **emdesign has the engine of a race car but the control loop
of a bicycle.** The components are there — deterministic lint, visual regression,
vision critique, doctor rules, composable plugins, a clean dual gate — but
connecting them into the seamless, automated feedback loop the research doc
envisions is the work ahead.

> **June 2026 update:** 10 of the gaps identified in this analysis have been closed
> in the `loop-close-gaps` branch. See [`implementation-gaps.md`](./implementation-gaps.md)
> for the detailed fix log. Key wins: `ScoreCollector` automation, `tokenScore()` wired
> into MCP, per-source baseline ratchet, proper `toStoryId()` kebab-case, Storybook
> health check, and 51 new unit tests. The research vision's "critique gate automation"
> gap is now bridged; what remains is the dual-agent orchestration and the Figma pipeline.
