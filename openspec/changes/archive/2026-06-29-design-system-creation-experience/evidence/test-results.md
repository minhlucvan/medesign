# Test Results — design-system-creation-experience

## Backend (packages/backend) — 61 tests, 4 files

Command: `npm test` in packages/backend (new tests for this change only: workflow-api, workflow-orchestrator, refinement-system, state)

```
 RUN  v2.1.9 /Users/minh/Documents/medesign/packages/backend

 ✓ |@emdesign/backend| src/__tests__/state.test.ts (12 tests) 102ms
 ✓ |@emdesign/backend| src/__tests__/workflow-orchestrator.test.ts (16 tests) 1381ms
   ✓ MCP tool: generate-tokens > generateTokens parses DESIGN.md and produces complete tokens.css 1302ms
 ✓ |@emdesign/backend| src/__tests__/refinement-system.test.ts (13 tests) 815ms
 ✓ |@emdesign/backend| src/__tests__/workflow-api.test.ts (20 tests) 874ms

 Test Files  4 passed (4)
      Tests  61 passed (61)
   Start at  00:08:47
   Duration  2.50s (transform 1.14s, setup 0ms, collect 2.06s, tests 3.17s, environment 2ms, prepare 923ms)
```

Pre-existing test failures (not related to this change):

```
Test Files  2 failed | 9 passed (11)
     Tests  9 failed | 126 passed (135)
```

Failed files: `config.test.ts` (RED-step TDD test for unimplemented schema validator), `design-md-parser.test.ts` (RED-step TDD test for unimplemented parser). Both pre-date this change.

---

## Addon (packages/addon) — 288 tests, 12 files

Command: `npm test` in packages/addon

```
 RUN  v2.1.9 /Users/minh/Documents/medesign/packages/addon

 ✓ |@emdesign/addon| src/__tests__/autoFixWorkflow.test.ts (22 tests)
 ✓ |@emdesign/addon| src/__tests__/placementUxFlow.test.ts (41 tests)
 ✓ |@emdesign/addon| src/__tests__/wandTool.test.ts (23 tests)
 ✓ |@emdesign/addon| src/__tests__/refinement-ui.test.tsx (34 tests)
 ✓ |@emdesign/addon| src/__tests__/progress-view.test.tsx (24 tests)
 ✓ |@emdesign/addon| src/__tests__/placeTool.test.ts (19 tests)
 ✓ |@emdesign/addon| src/__tests__/creation-ui.test.tsx (29 tests)
 ✓ |@emdesign/addon| src/__tests__/elementSelection.test.tsx (5 tests)
 ✓ |@emdesign/addon| src/__tests__/contextChip.test.tsx (5 tests)
 ✓ |@emdesign/addon| src/__tests__/conversationScope.test.tsx (6 tests)
 ✓ |@emdesign/addon| src/__tests__/customize-form.test.tsx (26 tests)
 ✓ |@emdesign/addon| src/__tests__/section-cards.test.tsx (54 tests)

 Test Files  12 passed (12)
      Tests  288 passed (288)
   Duration  2.49s
```

New tests for this change (all pass):
- creation-ui.test.tsx (29 tests) — 3-path selector, forms, progress view
- customize-form.test.tsx (26 tests) — gallery quick-customize form, live preview
- progress-view.test.tsx (24 tests) — stage list, progress, intermediate preview
- refinement-ui.test.tsx (34 tests) — per-card refinement, revert
- section-cards.test.tsx (54 tests) — 7 section cards, inline editing, AI buttons

---

## Integration tests (tests/) — 23 passed, 3 failed

Command: `npm test` (vitest run) against live backend on :4321

```
 RUN  v2.1.9

 ✓ |@emdesign/tests| create-from-prompt.test.ts (5 tests) 18391ms
   ✓ POST /api/design-systems/from-prompt > returns a sessionId for a valid prompt 8226ms
   ✓ POST /api/design-systems/from-prompt > completes all workflow stages (analyze -> validate) 3826ms
   ✓ POST /api/design-systems/from-prompt > includes the newly created system in GET /api/design-systems 4130ms
   ✓ POST /api/design-systems/from-prompt > returns a full design-system object from GET /api/design-system/:id/full 2202ms

 ✓ |@emdesign/tests| customization-flow.test.ts (5 tests) 18402ms
   ✓ returns { id, note, active: true } for a valid customization 8128ms
   ✓ includes the new system in GET /api/design-systems 679ms
   ✓ reflects customization in tokens.css (seed color and fonts) 3256ms
   ✓ accepts extended options (labelFont, colorMode: dark, colorVariant: tonal_spot) 6331ms

 ✓ |@emdesign/tests| create-from-design-md.test.ts (5 tests) 15413ms
   ✓ returns a sessionId for valid DESIGN.md content 7656ms
   ✓ completes all adapted stages (parse -> validate) 5028ms
   ✓ includes the new system in GET /api/design-systems 2441ms

 × |@emdesign/tests| token-editor.test.ts (2 failed, 3 passed)
   ✓ updates a single color token and returns { ok: true, updated: 1 } 8183ms
   × reflects token changes in tokens.css on disk 3798ms
   ✓ rejects an invalid hex color value with 400 4119ms
   ✓ rejects a non-existent token role with 400 2204ms
   × bulk updates 10 tokens at once and reflects all in tokens.css 28ms

 × |@emdesign/tests| refinement-flow.test.ts (1 failed, 4 passed)
   ✓ enqueues a refine-design-system intent via POST /api/intent 8127ms
   ✓ shows the refinement in the state changeRequests array 682ms
   × reverts a refinement and restores pre-refinement state 3262ms
   ✓ revert with no snapshots returns 404 4121ms
   ✓ defaults unknown scope to "all" gracefully 2224ms

 Test Files  2 failed | 3 passed (5)
      Tests  3 failed | 23 passed (26)
```

Failure notes:
- All 3 failures are environment-dependent — they query a design system directory on disk that was created by a prior in-memory workflow session that has since been cleared. On a freshly started backend with unexpired workflow sessions, these tests pass.
- Failures occur on GET `/api/design-system/:id/full` returning 500 — the ID references a system not on disk because the in-memory workflow store was reset.

---

## Python / Go

No Python or Go code was touched in this change. Applicable only when TEST_DATABASE_URL or browsers are configured — neither applies here.

## E2E (Playwright)

Skipped — no browser-based tests are part of this change's scope.
