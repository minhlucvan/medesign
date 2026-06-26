---
name: design-review
description: Designer-who-codes visual audit + fix. Use to tighten a component before shipping — run the four-source critique, then make atomic, on-system fixes with before/after screenshots. Adapted from open-design's design-review (gstack) to medesign's code-first loop.
---

# design-review

Adapted from open-design's `design-review` (Garry Tan / gstack) — but instead of editing shipped HTML, it
audits a medesign component through the four feedback sources and fixes it on-system.

## Steps
1. **Audit** — run `/mds:review <Name>`: rule (`lint_consistency` + `graph_where_to_fix`), visual
   (`run_visual_test`), vision (`vision-critic` on the screenshot), LLM (`design-reviewer`). Collect a
   P0-first finding list with `file:line`.
2. **Plan** — order fixes by severity; group into atomic edits. Each fix references a token role / primitive,
   never a raw value.
3. **Fix** — `edit_component` per atomic change. After each, re-run the relevant gate (`medesign lint`,
   `visual-test`) — keep a before/after screenshot pair from `__screenshots__/`.
4. **Re-gate** — `critique_score` must pass (`composite ≥ threshold && mustFix === 0`) before "done".
5. **Evidence** — `record_evidence` with the final scores + screenshot.

## Merge bar
Tightened means: zero P0s, visual baseline stable (or intentionally re-baselined), vision score ≥ threshold,
and the LLM review finds no composition/semantics/intent gaps. Beautiful, consistent, testable.
