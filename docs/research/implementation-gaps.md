# Implementation Gaps — Concrete Gap Catalog

> **A reference catalog of every discrepancy between documented design, implemented
> behavior, and research vision.** Organized by package, with code references and
> recommended fixes.
>
> Format per entry: **Gap** | **Where** | **Documented** | **Actual** | **Impact** | **Fix**
>
> ## ✅ Completed Fixes (June 2026)
>
> The following gaps have been addressed in the `loop-close-gaps` branch:
>
> | Gap | Fix Summary | Status |
> |-----|-------------|--------|
> | GAP-VT-1 | Added `toVisualScore()` mapping `pass→1.0, new→1.0, changed→0.5, error→0.0` | ✅ Done |
> | GAP-VT-2 | Added `checkStorybookHealth()` — probes Storybook with HEAD before launching browser | ✅ Done |
> | GAP-VT-3 | Fixed `toStoryId()` with proper kebab-case: dash before uppercase, acronym handling | ✅ Done |
> | GAP-LI-1 | Wired `tokenScore()` into `lint_component` MCP tool — returns numeric score | ✅ Done |
> | GAP-CR-1 | Added `ScoreCollector` (`critique/collector.ts`) + auto-collect in `evaluate_component` | ✅ Done |
> | GAP-CR-2 | Extended baseline to store per-source scores; ratchet enforces per-source non-regression | ✅ Done |
> | GAP-CR-3 | (Partial) `recordEvidence()` returns file path; evidence index tracked in collector | In progress |
> | GAP-DC-1 | Verified: `mcp.ts` already calls `composePrompt()` at line 102 — no duplicate code | ✅ Already fixed |
> | GAP-TE-1 | Added vitest tests for `scoreboard.ts` (16 tests) | ✅ Done |
> | GAP-TE-2 | Added vitest tests for `visualTest.ts` (12 tests) | ✅ Done |
> | GAP-TE-3 | Added vitest tests for `lint/index.ts` (12 tests) | ✅ Done |
>
> **Results:** 51 new tests added (85 total across monorepo), all passing. TypeScript compiles clean
> for both `@emdesign/backend` and `@emdesign/mcp-server`.

---

## `packages/backend/src/visualTest.ts`

| # | Field | Detail |
|---|---|---|
| GAP-VT-1 | **No visual score mapping** | |
| | **Where** | `visualTest.ts` — entire file |
| | **Documented** | `harness-engine.md` says: "pass/new=1, changed=0.5" — a numeric `visual` score is supposed to feed into the critique gate |
| | **Actual** | `runVisualTest()` returns `DiffResult.status: 'pass' | 'changed' | 'new' | 'error'` — a string, not a number. No one converts it to a 0-1 score. |
| | **Impact** | HIGH. The `evaluate_component` MCP tool expects the agent to supply a numeric `visual` score. The agent must guess. |
| | **Fix** | Add `exposeVisualScore(status): number` mapping and export it. Have the MCP `test_component` tool return it alongside the `DiffResult`. |

| # | Field | Detail |
|---|---|---|
| GAP-VT-2 | **No Storybook connectivity check** | |
| | **Where** | `visualTest.ts` — `runVisualTest()` function |
| | **Documented** | (implied by architecture docs: loop should handle failures gracefully) |
| | **Actual** | If Storybook is down, Playwright's `chromium.launch()` navigates to `STORYBOOK_URL` which times out or throws a cryptic Playwright error |
| | **Impact** | MEDIUM. Troubleshooting requires knowing Playwright + Storybook. No agent-friendly error message. |
| | **Fix** | Probe `STORYBOOK_URL/iframe.html` with a 2-second fetch before launching Playwright. Return `{ status: 'error', message: 'Storybook not reachable at <url>' }` instead of throwing. |

| # | Field | Detail |
|---|---|---|
| GAP-VT-3 | **`toStoryId()` fragile slugify** | |
| | **Where** | `visualTest.ts` — `toStoryId()` function |
| | **Documented** | (internal implementation detail, no doc) |
| | **Actual** | `"PricingTiers" → "generated-pricingtiers--default"`. `"CTAAction" → "generated-ctaaction--default"`. No dash insertion before uppercase. "PricingTiers" and "Pricingtiers" collide. |
| | **Impact** | LOW currently (few components), but will cause story ID collisions as the library grows |
| | **Fix** | Replace with proper kebab-case: `str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').toLowerCase()` |

---

## `packages/backend/src/lint/index.ts`

| # | Field | Detail |
|---|---|---|
| GAP-LI-1 | **`tokenScore()` dead code** | |
| | **Where** | `lint/index.ts:28-35` |
| | **Documented** | (function exists with JSDoc) |
| | **Actual** | `tokenScore()` is defined — computes a 0-1 score from lint findings using penalty weights (P0=-0.34, P1=-0.12, P2=-0.04) — but **it is never imported or called** anywhere in the codebase. |
| | **Impact** | HIGH (with GAP-VT-1). The automated score pipeline is doubly broken: visual scores aren't computed, and token scores are computed but never surfaced. |
| | **Fix** | Wire into the `lint_component` MCP tool as a return field. Wire into `ScoreCollector` (see P0.1 in the roadmap). |

---

## `packages/backend/src/critique/`

| # | Field | Detail |
|---|---|---|
| GAP-CR-1 | **No automated score collection pipeline** | |
| | **Where** | `critique/score.ts`, `mcp.ts` (`evaluate_component` tool) |
| | **Documented** | `harness-engine.md` describes a fan-out of four critics → scores collected → gate. `architecture.md` shows `critique_score` as one step receiving scores. |
| | **Actual** | `evaluate_component` MCP tool takes `scores: RoleScores` as **input** from the agent. The agent calls 3-4 separate MCP tools (test_component, lint_component, vision_review) and manually assembles the score object. No automation. |
| | **Impact** | HIGH. Every agent must re-discover this protocol. The loop is not automated. |
| | **Fix** | Add `ScoreCollector` in `critique/collector.ts`. Have `evaluate_component` optionally auto-collect if scores not supplied. |

| # | Field | Detail |
|---|---|---|
| GAP-CR-2 | **Baseline ratchet only tracks composite** | |
| | **Where** | `critique/score.ts` — `readBaseline()` / `writeBaseline()` |
| | **Documented** | "quality never regresses across iterations" |
| | **Actual** | Baseline stores only the composite score. A component could ship with vision=0.2 if composite=0.85. The per-source floor check catches this on first evaluation but the ratchet doesn't enforce per-source non-regression. |
| | **Impact** | LOW. The floor check catches most cases. But iterative improvement within a loop could mask per-source regression. |
| | **Fix** | Extend `baselines.json` to store per-source scores. Enforce per-source non-regression in the ratchet check: each source must be ≥ its own baseline. |

| # | Field | Detail |
|---|---|---|
| GAP-CR-3 | **No evidence consumer** | |
| | **Where** | `evidence.ts` |
| | **Documented** | "evidence for every round" |
| | **Actual** | `recordEvidence()` writes `design/changes/<slug>/evidence/round-<n>.json` + screenshot PNG. No programmatic consumer ever reads these files. Only the HTTP bridge's `/api/logs` endpoint lists them for UI display. |
| | **Impact** | LOW. Evidence is valuable for debugging but not actionable. |
| | **Fix** | Add a lightweight index. Make the critique gate query "what was the vision score in round N-1?" from evidence for the ratchet. |

---

## `packages/backend/src/designContext.ts`

| # | Field | Detail |
|---|---|---|
| GAP-DC-1 | **`composePrompt()` exported but never called** | |
| | **Where** | `designContext.ts` vs `mcp.ts` |
| | **Documented** | `designContext.ts` is the prompt composer. Architecture labels it as the authoritative prompt construction path. |
| | **Actual** | `composePrompt()` is exported but `mcp.ts`'s `get_design_context` tool re-implements prompt composition inline (concatenating DESIGN.md + tokens.css + graph context manually). Two implementations, one of which is dead. |
| | **Impact** | MEDIUM. Any improvements to `composePrompt()` (dynamic codegen instructions, graph context formatting) never reach the MCP tool. |
| | **Fix** | Have `mcp.ts` call `composePrompt()` instead of inline concatenation. Remove the dead path. |

| # | Field | Detail |
|---|---|---|
| GAP-DC-2 | **No dynamic codegen instructions** | |
| | **Where** | `designContext.ts` — `composePrompt()` output |
| | **Documented** | `codegenInstructions(ds)` is part of `FrameworkAdapter` — returns stack-specific generation rules |
| | **Actual** | The codegen instructions are static strings from the plugin, not dynamically referencing the active design system's actual `code/` primitives and their props. |
| | **Impact** | MEDIUM. Agent doesn't know which primitives are available with which props. It writes generic JSX instead of composing the system's primitives. |
| | **Fix** | Have `composePrompt()` read the `code/` directory's `index.ts` exports and enumerate available primitives with their prop types. |

---

## `packages/mcp-server/src/mcp.ts`

| # | Field | Detail |
|---|---|---|
| GAP-MCP-1 | **Tool names mismatch documentation** | |
| | **Where** | Entire file vs `architecture.md` `harness-engine.md` |
| | **Documented** | `critique_score`, `run_visual_test`, `render_preview`, `record_evidence`, `lint_consistency`, `poll_change_request` |
| | **Actual** | `evaluate_component`, `test_component`, no separate `render_preview`, side-effect of evaluate, `lint_component`, `handle_change_request` (mode: poll) |
| | **Impact** | MEDIUM. Confusing for agents trained on the docs. Agent may hallucinate the documented tool names and fail. |
| | **Fix** | Add tool aliases. Register both old and new names pointing to the same handler. |

| # | Field | Detail |
|---|---|---|
| GAP-MCP-2 | **`manage_design_system` mega-tool** | |
| | **Where** | `mcp.ts` — `manage_design_system` handler |
| | **Documented** | (no documented equivalent; this is the actual implementation) |
| | **Actual** | One tool with a `mode` parameter that dispatches to 8 different operations (create, apply, validate, grade, scaffold, conflicts, history, list). Makes it hard for agents to discover individual operations. |
| | **Impact** | MEDIUM. Agents typically only discover `list` and `apply`. The other operations are invisible. |
| | **Fix** | Split into individual tools: `create_design_system`, `apply_design_system`, `validate_design_system`, `grade_design_system`, `scaffold_primitives`, `list_design_systems`, `detect_conflicts`, `get_history`. |

| # | Field | Detail |
|---|---|---|
| GAP-MCP-3 | **`vision_review` uses wrong URL source** | |
| | **Where** | `mcp.ts:314` (approximate) — `vision_review` tool handler |
| | **Documented** | (implementation detail) |
| | **Actual** | `vision_review` calls `runVisualTest()` which reads `STORYBOOK_URL` from `process.env`. This may differ from the configured `storybookUrl` in `emdesign.config.json`. |
| | **Impact** | LOW. Environment variable and config should match in dev, but can diverge in CI. |
| | **Fix** | Read `storybookUrl` from project config first, fall back to env var. |

---

## `packages/backend/src/state.ts`

| # | Field | Detail |
|---|---|---|
| GAP-ST-1 | **No state machine, no FSM guards** | |
| | **Where** | `state.ts` — entire file |
| | **Documented** | `architecture.md` says "queued in the shared Store (.emdesign/state.json)" — state diagram implied |
| | **Actual** | It's a flat JSON store with no transition guards. `setChangeRequestStatus(id, status)` just maps over an array. No validation that `queued → in_progress → done` is enforced. Two processes can mutate simultaneously and silently clobber each other (the mtime check refreshes reads but doesn't prevent write conflicts). |
| | **Impact** | MEDIUM. In practice the single-user dev loop doesn't trigger races, but as soon as the harness drives the loop and the addon panel also enqueues requests, conflicts are possible. |
| | **Fix** | Add lightweight FSM guards to `setChangeRequestStatus`: reject invalid transitions, detect stale mtime on write and retry. |

---

## `packages/backend/src/harness/driver.ts`

| # | Field | Detail |
|---|---|---|
| GAP-HN-1 | **Stdin closed after first prompt** | |
| | **Where** | `harness/driver.ts` — `runAgent()` function |
| | **Documented** | `harness-engine.md` describes an iterative loop (poll → work → critique → revise) driven through the harness |
| | **Actual** | `child.stdin.end()` is called immediately after writing the initial prompt. The child process cannot receive follow-up prompts. This makes the harness unsuitable for iterative loops. (Note: `AgentRunner` in `@emdesign/session` keeps stdin open — the fix is already in a sibling package.) |
| | **Impact** | MEDIUM. The harness can only drive single-turn operations. Iterative loops must use the session package. |
| | **Fix** | Remove `child.stdin.end()`. Add a `sendPrompt(text)` method that writes to stdin and returns the response. Align with `AgentRunner`'s behavior. |

---

## `packages/vision-critic/src/`

| # | Field | Detail |
|---|---|---|
| GAP-VC-1 | **Hardcoded context truncation limits** | |
| | **Where** | `vision-critic/src/context/builder.ts` |
| | **Documented** | (implementation detail) |
| | **Actual** | DESIGN.md truncated to 2000 chars, tokens.css to 1500 chars. These are hardcoded constants with no configurability. A large design system loses detail. |
| | **Impact** | LOW. Most systems stay under these limits, but the limits are opaque. |
| | **Fix** | Move to configurable limits in `vision-critic` package options. Default to current values. |

---

## `apps/workspace/templates/claude/`

| # | Field | Detail |
|---|---|---|
| GAP-WS-1 | **Loop orchestration is project-specific, not scaffolded** | |
| | **Where** | `.claude/workflows/design-loop.js`, `core-loop.js` |
| | **Documented** | `harness-engine.md` describes these as the canonical loop. `architecture.md` shows the loop as a system property. |
| | **Actual** | The loop logic lives in `.claude/workflows/` which is part of the workspace template, not part of the `@emdesign` packages. It is only installed if you use `emdesign init` or manually copy the template. The workflow files fetch scores by calling CLI commands, not by importing package APIs. |
| | **Impact** | HIGH (with GAP-CR-1). The "out of the box" experience has no automated loop. Users must:
1. Know that `.claude/workflows/` exists
2. Have it scaffolded
3. Understand that the loop is CLI-command-based, not API-based |
| | **Fix** | Two-stage: (1) Make `emdesign init` scaffold the full `.claude/` set. (2) Phase 2 (roadmap P2.3) should move loop logic into `@emdesign/backend` so the workflows become thin wrappers around package APIs. |

---

## `packages/dsr/src/`

| # | Field | Detail |
|---|---|---|
| GAP-DS-1 | **No primitive-usage lint rule** | |
| | **Where** | `dsr/src/rules/lint.ts` |
| | **Documented** | (implied by the token-binding invariant: "Components reference semantic roles... never hex colors") |
| | **Actual** | The lint catches off-token colors, unresolved `var()`, anti-patterns (indigo, emoji icons, filler copy). It does NOT check whether the component uses the design system's `code/` primitives or writes raw `<div>`/`<span>` elements. |
| | **Impact** | MEDIUM. Components can bypass the system's structural primitives entirely. |
| | **Fix** | Add P0 rule: if the design system provides a `<Box>` primitive, raw `<div>` with layout-relevant classes flags as P0. Check `code/` manifest for available primitives. |

| # | Field | Detail |
|---|---|---|
| GAP-DS-2 | **No AST-level structural lint** | |
| | **Where** | `dsr/src/rules/` |
| | **Documented** | (not documented; aspirational) |
| | **Actual** | All lint rules operate on text patterns (regex) or CSS parsing. There is no JSX/TSX AST parser. The lint cannot answer structural questions like "is this button wrapped in a Card header?" or "does this form use Stack for field spacing?" |
| | **Impact** | LOW currently, but will limit the lint's capability as the system matures. Component structure is invisible to the current ruleset. |
| | **Fix** | Add a lightweight AST walker using `@typescript-eslint/parser` or `ts-morph`. Structural rules can then check component composition. |

---

## Testing Gaps

| # | Field | Detail |
|---|---|---|
| GAP-TE-1 | **No tests for critique/scoring** | |
| | **Where** | `packages/backend/src/critique/` — no `.test.ts` files exist |
| | **Actual** | `computeComposite`, `decideRound`, `scoreComponent`, per-source floor checks, ratchet — none have automated tests |
| | **Impact** | HIGH. Refactoring the gate is blind. Cannot verify fixes to the critical path. |
| | **Fix** | Vitest tests for scoreboard.ts and score.ts. Test: dual-gate semantics, per-source floors, ratchet non-regression, threshold changes. |

| # | Field | Detail |
|---|---|---|
| GAP-TE-2 | **No tests for visual test** | |
| | **Where** | `packages/backend/src/visualTest.ts` — no `.test.ts` |
| | **Actual** | `toStoryId`, `runVisualTest`, URL construction — no tests |
| | **Impact** | MEDIUM. The fragile `toStoryId` function is the most likely to regress. |
| | **Fix** | Vitest tests for `toStoryId` edge cases, `DiffResult` handling, error paths. |

| # | Field | Detail |
|---|---|---|
| GAP-TE-3 | **No tests for lint rules** | |
| | **Where** | `packages/dsr/src/rules/lint.ts` — no `.test.ts` |
| | **Actual** | 15 lint rules, no tests |
| | **Impact** | MEDIUM. Anti-slop rules drift without detection. False positives and false negatives can ship silently. |
| | **Fix** | Vitest tests for each rule: matching input → finding, non-matching input → no finding, edge cases, severity assignment. |

| # | Field | Detail |
|---|---|---|
| GAP-TE-4 | **No tests for MCP tool surface** | |
| | **Where** | `packages/mcp-server/src/` — no `.test.ts` |
| | **Actual** | All MCP tool handlers — no tests |
| | **Impact** | LOW. Integration tests require a running Storybook + design system. Unit tests can still test helper functions and score computation paths. |

---

## Documentation Gaps

| # | Field | Detail |
|---|---|---|
| GAP-DO-1 | **`architecture.md` tool table is stale** | |
| | **Where** | `docs/architecture.md:43-58` — the "Components" table |
| | **Actual** | Lists tools like `critique_score`, `run_visual_test`, `render_preview`, `record_evidence` by their documented names. None of these match the actual MCP tools. The table also says MCP server is at `backend/src/mcp.ts` but it moved to `packages/mcp-server/src/mcp.ts`. |
| | **Impact** | LOW. Users reading the architecture doc will see tools that don't exist when they inspect the code. |
| | **Fix** | Update the table with actual tool names and file paths. |

| # | Field | Detail |
|---|---|---|
| GAP-DO-2 | **`build.sh` references stale tsconfig** | |
| | **Where** | `scripts/gates/build.sh` |
| | **Actual** | Still points at `apps/studio/tsconfig.json` which no longer exists (absorbed into `apps/workspace-react/`). NOTE: CLAUDE.md already flags this. |
| | **Impact** | LOW (known, documented in CLAUDE.md). |
| | **Fix** | Update path to `apps/workspace-react/tsconfig.json`. |

---

## Gap Severity Distribution

```
HIGH:      7 gaps (automated score pipeline, dead tokenScore, no state machine, no loop scaffold)
MEDIUM:    9 gaps (mega-tool, tool names mismatch, composePrompt dead code, fragile slugify, etc.)
LOW:       6 gaps (evidence write-only, hardcoded limits, URL mismatch, etc.)
```

The **7 HIGH-severity gaps** all relate to the same root cause: the feedback loop
exists as documentation and ad-hoc workflow scripts, not as packaged, tested,
scaffolded code.
