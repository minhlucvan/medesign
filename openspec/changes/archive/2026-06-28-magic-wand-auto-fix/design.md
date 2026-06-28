## Context

The emdesign addon has a working element picker in the preview iframe (`preview.tsx`) that supports comment, copy, text, and reference modes. The ai-native-design-ide change is adding a `withComponentContext` decorator and a richer reference/selection tool. Separately, the workspace has mature verification workflows: `component-audit.js` (render analyze + spatial + a11y + doctor), `spatial-fix.js` (geometry checks), `element-workflow.js` (smallest fix unit), and `component-workflow.js` (progressive cascade gate).

What's missing is a **single-surface invocation** — the user points at a visual element and says "fix this." Today they must: notice an issue → describe it in chat → wait for AI response → iterate. For the common class of auto-detectable issues (contrast, spacing, alignment, token binding, visual polish), this round-trip is unnecessary.

The magic wand bridges the gap: element selection → multi-probe diagnostics → issue aggregation → fix generation → fix application → re-verification, all in one click.

## Goals / Non-Goals

**Goals:**
- Add a new "magic wand" tool mode to the preview iframe element picker — user clicks an element, auto-fix runs
- Chain existing diagnostic tools (render analyze, spatial audit, a11y, doctor) into a single pipeline
- Add optional LLM vision critique stage that reads the element screenshot for visual issues
- Aggregate all diagnostic outputs into a unified, prioritized issue list
- Auto-generate and apply fixes for auto-fixable issues (token binding, spacing, alignment, contrast, visual polish)
- Verify fixes through the existing gate (`doctor all --gate`) with automatic rollback on regression
- Surface results in a collapsible manager UI panel showing what was detected, fixed, and what needs human attention
- Add `/mds:wand` CLI command for scripted/CI-triggered auto-fix on a named component

**Non-Goals:**
- Not replacing the existing design loop or craft workflow — the wand is a shortcut for auto-detectable issues
- Not implementing complex layout restructuring (e.g., grid-to-flex conversion) — only local fixes
- Not adding new diagnostic capabilities — the wand orchestrates existing ones
- Not making changes that can't be reverted — every fix in a wand session is batch-revertible
- Not implementing the selection tool itself — that's built by ai-native-design-ide's `magic-wand-tool` spec

## Decisions

### 1. Add magic wand as a new tool mode in the existing element picker

The existing element picker (`preview.tsx`) handles click detection, element highlighting, and channel communication to the manager. We add a new mode `wand` alongside the existing `comment`, `copy`, `text`, and `reference` modes.

**Why:** Reuses all existing infrastructure: overlay rendering, element path resolution, channel events. The user already knows the toolbar pattern. No new DOM traversal or iframe communication code needed.

**Alternatives considered:** A separate floating wand button overlaid on the preview. Rejected — would conflict with the existing toolbar and add iframe communication complexity.

### 2. Auto-fix orchestration as a new workflow, not a backend endpoint

The auto-fix pipeline runs as a JavaScript workflow (`magic-wand-workflow.js`) in the agent harness, chaining: enrich context → diagnose (parallel probes) → aggregate issues → generate fixes → apply fixes → verify → rollback on failure. This is the same pattern as `component-audit.js` and `spatial-fix.js`.

The workflow receives the selected element's context (component name, CSS selector, tag, text, computed styles, bounding box) from the magic wand tool via channel events.

**Why:** Workflows have built-in parallel execution, error handling, and rollback. No new backend endpoint needed — the workflow shells out to existing CLI commands. The agent can tee up parallel diagnostic probes (render analyze + spatial audit + a11y + optional vision) for maximum speed.

**Alternatives considered:** A new backend `/api/auto-fix` endpoint with a backend-side pipeline. Rejected — adds latency, duplicates existing workflow infrastructure, and makes it harder to use agent-side context (graph, design context).

### 3. Diagnostic aggregator as a deterministic merge, not an AI gate

The aggregator collects outputs from all diagnostic probes and merges them into a single prioritized issue list. It uses deterministic deduplication (same file:line = same issue) and priority ordering (P0 contrast/spacing > P1 alignment > P2 polish). The LLM vision critique is optional — if available, its findings are merged at the corresponding priority level.

**Why:** Deterministic merge is fast (~1ms), reproducible, and testable. AI gate on the aggregator would add latency, cost, and non-determinism. The vision critique is a *probe*, not a *gate* — it feeds findings into the same priority pipeline.

### 4. Fix application as targeted, revertible edits with a session journal

Each fix is applied as a targeted edit to the component source file (`.tsx`). The fix engine maintains a session journal (`/tmp/emdesign-wand-<timestamp>.json`) recording every edit: file, line, old text, new text, fix reason. After the full fix pass, the gate runs. If the gate fails (composite drops or mustFix increases), the journal is replayed in reverse to rollback all changes.

**Why:** Allows atomic "fix all" with safe rollback. The journal also serves as an evidence artifact for the user (and can be attached to change requests).

**Alternatives considered:** Git-based rollback (stash/reset). Rejected because intermediate working-tree state matters for the verification gate — we need to verify the *applied* state, not the stashed state.

### 5. User confirmation gate in guided mode

The auto-fix workflow supports two modes via the `mode` parameter. In **guided mode** (default when triggered from the `/mds:wand` CLI command or agent invocation), the workflow runs all diagnostic probes and returns a prioritized issue list to the caller — it does NOT apply fixes automatically. The caller/agent presents the findings to the user with suggested fixes, and asks "Apply N auto-fix(es)?" before proceeding. Only after user confirmation does it re-invoke in `auto` mode to apply the fixes.

In **auto mode** (one-click from the preview wand tool), fixes are applied directly without user confirmation, followed by automatic re-verification and rollback on regression.

**Why:** Guided mode prevents surprises — the user sees what the wand found before any code changes. Auto mode is for power users who trust the wand. The two modes share the same diagnostic pipeline; only the fix-application step differs. This also enables the agent to inspect diagnostic results before committing to fixes.

**Alternatives considered:** Always asking vs. always applying. Neither suits all use cases. The dual-mode approach covers both novice (wants to review) and expert (wants speed) workflows.

### 6. Results panel as a Storybook addon panel tab

The magic wand results display in a new addon panel tab "Wand Results" (alongside the existing Canvas, Docs, Actions, etc. tabs). It shows: detection summary (issues found), fix summary (issues fixed, with file:line), before/after score comparison, and a "Fix Failed" section for issues that couldn't be auto-fixed.

**Why:** The addon panel is the natural home for fix results — it's visible alongside the Storybook canvas, so the user can immediately see the before/after. A panel tab is non-intrusive and doesn't interfere with the chat sidebar.

**Alternatives considered:** Inline in the chat sidebar. Rejected — the chat sidebar is for conversation, not diagnostic output. The wand result is a report, not a message.

### 7. /mds:wand CLI command for scripted use

A new slash command `/mds:wand <component> [--vision] [--guided]` that runs the auto-fix workflow on a named component without requiring preview selection. Default is guided mode (presents findings, asks for confirmation). Pass `--auto` for one-click apply. This exposes the wand for CI, batch, and non-visual workflows.

**Why:** The design loop and CI/CD pipeline should be able to run auto-fix without a browser. This also serves as a debugging tool for power users.

### 8. Vision critique is opt-in, not default

The LLM vision critique stage (screenshots the element and sends to Claude/Gemini for visual analysis) is opt-in because it's slow (~3-5s) and costs tokens. By default, the wand runs deterministic probes only (render analyze, spatial audit, a11y, doctor lint). The user enables vision mode by holding Shift while clicking the wand, or passing `--vision` to the CLI command.

**Why:** The deterministic probes catch ~80% of auto-fixable issues (contrast, spacing, alignment, token binding). Vision is useful for the remaining ~20% (subjective visual polish, aesthetic hierarchy) but shouldn't slow down the common case.

## Risks / Trade-offs

- **[Performance] Multiple diagnostic probes run sequentially could be slow**: Mitigation: probes run in parallel via the workflow's `parallel()`/`pipeline()` stages. Render analyze, spatial audit, a11y, and doctor each take ~200-500ms and run concurrently — total diagnostic time ~500ms.
- **[Regression] Auto-fix could make things worse**: Mitigation: before/after gate comparison with automatic rollback. The session journal enables full revert. The wand never ships a change that drops composite by more than 0.05.
- **[Scope] Wand fixes local issues but can't fix systemic problems**: Mitigation: the results panel explicitly separates "fixed" from "needs human" items. Systemic issues (e.g., wrong design system tokens) are flagged as needs-human with a recommendation to run `/mds:system:update` instead.
- **[UX] User might expect wand to fix everything**: Mitigation: the results panel clearly shows what was auto-fixed vs. what needs human attention. The wand is marketed as "auto-fix common issues" not "perfect component button."
- **[Safety] Auto-edit could introduce broken code**: Mitigation: every fix edit is regex/ast-targeted (no freeform AI code generation in the fix engine). Fixes are constrained to: replace token value, adjust spacing value, fix alignment class, update color reference. Complex changes fall through to "needs human."
- **[Dependency] Requires the selection tool from ai-native-design-ide**: Mitigation: the `/mds:wand` CLI command works independently of the preview tool. The preview wand tool is the premium UX path; CLI is always available.
