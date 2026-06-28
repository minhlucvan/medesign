## 1. Fix Application Engine

- [ ] 1.1 Create `packages/backend/src/wand/fix-engine.ts` with `applyFix(candidate: FixCandidate): Promise<JournalEdit>` — reads file, locates oldValue on specified line (exact match then fuzzy), replaces with newValue, records edit
- [ ] 1.2 Define `SessionJournal` interface and `FixCandidate`/`JournalEdit` types in `packages/dsr/src/wand.ts`
- [ ] 1.3 Implement session journal management: `createSession()`, `appendEdit()`, `rollbackSession()`, `getSession()` — JSON file at `/tmp/emdesign-wand-<sessionId>.json`
- [ ] 1.4 Implement batch fix application: accept `FixCandidate[]`, sort by file:line descending, apply each, write file once per file
- [ ] 1.5 Implement full rollback: replay journal in reverse, revert each edit, mark `rolledBack: true`, set journal status to `rolled_back`
- [ ] 1.6 Support fuzzy matching fallback: whitespace-normalized and quote-style tolerant matching when exact match fails
- [ ] 1.7 Implement fix type constraints table: only `token-binding`, `spacing`, `contrast`, `grid-alignment`, `border-radius`, `font-size` are auto-fixable; everything else goes to `needsHuman`
- [ ] 1.8 Add rollback idempotency: second rollback call on same journal is a no-op (all edits already marked `rolledBack`)

## 2. Visual Diagnostic Aggregator

- [ ] 2.1 Create `packages/backend/src/wand/diagnostic-aggregator.ts` with `aggregate(probes: ProbeResult[]): AggregatedReport`
- [ ] 2.2 Define `DiagnosticIssue` interface (id, source, priority, type, message, file, line, fixable, fixCandidate) in `packages/dsr/src/wand.ts`
- [ ] 2.3 Implement priority assignment: P0 for contrast/a11y-critical/overlaps, P1 for alignment/grid/token violations, P2 for polish
- [ ] 2.4 Implement deterministic deduplication by hash of `(source + file + line + type)`
- [ ] 2.5 Implement probe result parsers for: `emdesign render analyze --json`, `emdesign spatial audit --json`, `emdesign doctor lint --json`, `emdesign component a11y --json`
- [ ] 2.6 Implement optional vision critique parser: merge vision findings at declared priority level, attach fix candidates
- [ ] 2.7 Implement fix candidate generation strategies: token binding (DS token map lookup), spacing (snap to grid unit), contrast (nearest accessible DS color), alignment (adjust to grid), polish (normalize to DS scale)
- [ ] 2.8 Return sorted output: issues sorted by priority desc, then by type, with `fixable` and `needsHuman` split

## 3. Magic Wand Auto-Fix Workflow

- [ ] 3.1 Create `apps/workspace/templates/claude/workflows/auto-fix-workflow.js` with 7-stage pipeline: Baseline → Diagnose → Analyze → Propose Fixes → Apply → Re-verify → Report
- [ ] 3.2 Implement Baseline stage: run `emdesign doctor all --json` to capture pre-fix composite, mustFix, and per-source scores
- [ ] 3.3 Implement Diagnose stage: run ALL probes in parallel via `workflow.parallel()` — visual check (`doctor visual`), lint (`doctor lint`), spatial audit, a11y audit, render analyze, component diff, and optional vision critique
- [ ] 3.4 Implement Analyze/Aggregate stage: collect probe outputs, parse each into structured findings with priority (P0/P1/P2), deduplicate, sort. Determine fixability per finding (token binding, small overlaps, grid violations are fixable; a11y, complex spatial issues are needs-human)
- [ ] 3.5 Implement Propose Fixes stage (guided mode): group findings by type, log diagnostic summary, return `awaitingConfirmation: true` with full findings list so the caller can present to user
- [ ] 3.6 Implement Apply stage (auto mode): apply all fixable issues. Token-binding fixes delegate to `element-workflow`; other fixes log the edit intent for the caller/agent to apply
- [ ] 3.7 Implement Re-verify stage: run `emdesign doctor all --gate --json`, compare post-fix scores against baseline, detect regression (composite drop > 0.05 or mustFix increase), recommend rollback on regression
- [ ] 3.8 Implement Report stage: return standardized result with findings, applied fix count, gate verdict, improvement summary, and elapsed time
- [ ] 3.9 Register `auto-fix-workflow` in `entry-workflow.js`: route type `auto-fix`, `wand`, `magic-wand`, and combined intents "auto fix", "fix this", "fix component" to element-layer `auto-fix-workflow`. Pass `mode` and `vision` from payload
- [ ] 3.10 Add `emdesign wand <component> [--vision] [--guided]` CLI command to `packages/cli/` — delegates to backend wand workflow

## 4. Magic Wand Preview Tool

- [ ] 4.1 Add `wand` tool mode to the element picker in `packages/addon/src/preview.tsx` (alongside comment/copy/text/reference modes)
- [ ] 4.2 Define `EVT_WAND_TRIGGER` channel event with payload: componentName, tag, selector, textContent (200 char max), computedStyles (color, bg, font-size, weight, padding, margin, border, radius, shadow), boundingBox, viewport, storyId, vision
- [ ] 4.3 On element click in wand mode: highlight element with wand badge overlay, emit `EVT_WAND_TRIGGER`, show "Auto-fix running..." progress
- [ ] 4.4 Add keyboard shortcut `Ctrl+Shift+W` / `Cmd+Shift+W` for toggling wand mode
- [ ] 4.5 Implement Shift+click behavior: hold Shift sets `vision: true` in the trigger event
- [ ] 4.6 Add pulse/spinner animation on wand toolbar icon while fix is in progress; checkmark on success, X on failure
- [ ] 4.7 Queue/dedup logic: if wand is triggered while previous fix is still running, show toast and ignore or cancel (implementation choice)
- [ ] 4.8 Listen for `EVT_WAND_RESULT` channel event from manager and show inline notification

## 5. Wand Results Panel

- [ ] 5.1 Create `packages/addon/src/panels/WandResultsPanel.tsx` — a Storybook addon panel registered as "Wand Results" tab
- [ ] 5.2 Display Detection Summary section: count and type breakdown (contrast, spacing, alignment, token, polish) of issues found
- [ ] 5.3 Display Fix Summary section: list of auto-fixed issues with file:line links, old/new value
- [ ] 5.4 Display Before/After score comparison: composite, visual, tokens, spatial, a11y — with delta indicators (🟢 improved, 🔴 regressed)
- [ ] 5.5 Display "Needs Human" section: issues that couldn't be auto-fixed, with recommendations
- [ ] 5.6 Implement Rollback button: calls `POST /api/wand/rollback/<sessionId>`, reverts all changes, updates panel to "Rolled back" status
- [ ] 5.7 Auto-open panel when auto-fix completes; persist content across story navigation with "from different story" note
- [ ] 5.8 Register `EVT_WAND_RESULT` channel event and wire to panel state updates

## 6. /mds:wand CLI Command

- [ ] 6.1 Create `apps/workspace/templates/claude/commands/mds/wand.md` — defines `/mds:wand <component> [--vision] [--guided]` slash command
- [ ] 6.2 Wire `/mds:wand` to invoke entry workflow with type `wand`, target component, optional `--vision` flag, `mode: auto|guided`
- [ ] 6.3 In guided mode: display findings as formatted markdown, ask "Apply these N fixes?", wait for user response before applying
- [ ] 6.4 Display formatted output: issues found, issues fixed, needs-human items, before/after scores, improvement summary in markdown
