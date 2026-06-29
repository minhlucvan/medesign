## Context

emdesign already has two DS-creation entry points, both implemented as staged workflows with
SSE-streamed progress:

- `POST /api/design-systems/from-prompt` and `POST /api/design-systems/from-design-md` in
  `packages/backend/src/workflow-api.ts`, driven by the in-memory `WorkflowStore` +
  `WorkflowOrchestrator` in `packages/backend/src/workflow.ts`. Each runs ~6 sequential stages
  (`analyze|parse → generate DESIGN.md → tokens → scaffold primitives → build graph → validate`),
  calling `updateStage(sessionId, name, status, progress)`; clients subscribe via
  `GET /api/design-systems/:id/workflow-stream` (`event: stage` … `event: done`).
- The on-disk contract per system: `design-systems/<id>/{DESIGN.md, tokens.css, manifest.json,
  graph.json, code/, charters/}`, declared via `emdesign.config.json` (`designSystemsDir`,
  `componentsDir`, `generatedDir`). `manifest.json.source` records provenance (`awesome-design-md`,
  `git`, …).
- The CLI `ds import awesome|git|vendor` lives in `packages/cli/src/commands/ds.ts` (`cmdDs()`
  case-dispatch), delegating to `importAwesomeDesign` / `importGitDesign` in
  `packages/backend/src/scaffold.ts`; both end by calling `scaffoldPrimitives(paths, id, 'atelier')`.
- The consistency lint is `componentLint` in `packages/dsr/src/rules/lint.ts` (shimmed by
  `packages/backend/src/lint/index.ts`). `off-token-color` (P1) flags raw hex when a token contract
  exists; `unresolved-token` (P0) flags `var(--x)` that doesn't resolve. `countMustFix()` (P0 count)
  is the ship gate.
- The graph (`@emdesign/graph`) ingests `token`/`primitive`/`file`/`story` nodes and
  `uses`/`references`/`violates` edges, each with `{ file, line }` provenance; built via
  `buildAndSave` and overlaid via `overlayGenerated`/`overlayArtifact` in
  `packages/backend/src/graph.ts`.
- MCP tools are registered in `packages/mcp-server/src/mcp.ts` via
  `server.registerTool(name, { description, inputSchema: z.object(...) }, handler)` returning
  `text(JSON.stringify(...))`.

What is missing is the inverse direction: starting from an existing project and producing the
standardized contract by **mining the decisions already in the code**, then adopting the project's
components so they enter the loop.

## Goals / Non-Goals

**Goals:**
- A third creation path, `ds-from-project`, that reuses the existing `WorkflowStore`/SSE machinery
  so the frontend gets the same real-time progress as the other two paths.
- Deterministic-first extraction (Tailwind config, CSS custom properties, component source) with
  agent assistance only for interpretation/clustering, and `file:line` provenance + confidence on
  every inference.
- Make a project's existing components loop-ready: placed in `componentsDir`, rebound to tokens
  where unambiguous, registered in the graph, with a triageable adoption report.
- Work whether or not a `DESIGN.md` exists; when present, treat it as canonical and reconcile.
- A `ds import project <path>` CLI command and the supporting backend endpoints + MCP tools.

**Non-Goals:**
- Changing the DS file format, `tokens.css` role vocabulary, or the lint rule set.
- Auto-fixing every off-token value — ambiguous rebinds are deferred to the user, not guessed.
- Supporting non-React/Tailwind projects in this change (extraction is gated by the active
  `FrameworkAdapter`; other frameworks stay stubbed).
- Runtime design-system switching (one system per workspace remains invariant).

## Decisions

**1. Reuse `WorkflowOrchestrator` + SSE rather than a new progress mechanism.**
Add `runFromProject(sessionId, { projectPath, name?, id? })` alongside `runFromPrompt`/
`runFromDesignMd`, with stages `scan → extract → synthesize DESIGN.md → tokens → primitives → adopt
→ graph → validate`. Endpoint `POST /api/design-systems/from-project`; progress reuses
`GET /api/design-systems/:id/workflow-stream`. *Alternative considered:* a bespoke streaming layer —
rejected; it would duplicate the store and fragment the frontend's progress handling.

**2. Extraction is a deterministic core + an agent interpretation pass.**
A new `packages/backend/src/project/extract.ts` parses `tailwind.config.*` (theme/extend), stylesheet
custom properties, and scans component files for raw values/utility usage, emitting raw observations
with `{ file, line }` and occurrence counts. A clustering step (near-duplicate merge, e.g. `#0a0a0a`
≈ `#0b0b0b`) proposes semantic roles with a confidence score; the agent is consulted only to name
roles and resolve ambiguity. *Alternative:* pure-LLM extraction — rejected as non-deterministic and
unverifiable; provenance is required for the graph and the report.

**3. Adoption rebinds only high-confidence, single-candidate mappings.**
`packages/backend/src/project/adopt.ts` copies components into `componentsDir`, and for each
hardcoded value that maps to exactly one high-confidence role, rewrites it to the semantic role
(e.g. `#fff` → `bg-surface`). Multi-candidate or low-confidence values are left untouched and
recorded as blocking. Readiness is derived by running the existing lint on the rebound source:
`countMustFix() === 0 && no off-token-color` ⇒ loop-ready. This reuses the real gate rather than
inventing a parallel notion of "ready." Adoption is idempotent (re-running diffs against placed
files; no duplicates).

**4. The adoption report is a first-class artifact.**
A structured report (per-component status `loop-ready | needs-manual-fix`, the rebinds with
before/after + provenance, and remaining blocking values) is persisted with the workflow session and
served by the surface API for the triage UI, and emitted by the CLI (`--json` structured, default
human summary). It is the contract between the workflow and both UIs. **Triage is display-only:**
the `design-surface-api` exposes progress + report read-only; accepting a rebind or marking a
component for follow-up is a client-side view state with no write-back endpoint, so no triage
decision is persisted in this change (re-running adoption re-derives the report). The canonical
shape/contents of the adoption report are owned by the `component-adoption` capability; other
capabilities reference it rather than re-enumerating its fields.

**5. New MCP tools mirror the existing pattern.**
Add `analyze_project` (path → extracted values, proposed roles, confidence, provenance) and
`adopt_components` (run/preview adoption, return the report) via `registerTool` with Zod schemas, so
an MCP-driven agent can run the same flow the CLI/UI trigger.

**6. CLI command slots into existing `cmdDs` dispatch.**
`ds import project <path>` adds an `else if (importSrc === 'project')` branch calling a new
`importProjectDesign(paths, projectPath, opts)` in `scaffold.ts` that drives the orchestrator
in-process (one-shot, like the embedded-engine path), honoring `--name`, `--json`, and `--gate`
(non-zero when validation fails or any component is needs-manual-fix).

## Risks / Trade-offs

- **Misclassified roles from noisy codebases** → confidence scoring + the report surface every
  inference; low-confidence proposals are flagged, not silently committed; nothing is registered in
  `emdesign.config.json` until validation passes.
- **Incorrect auto-rebind changes a component's appearance** → only single-candidate, high-confidence
  rebinds are applied; every rebind is logged with before/after for review; ambiguous ones are
  deferred. Adoption runs on copies in `componentsDir`, leaving the source project untouched.
- **Large projects exceed the workflow timeout** → extraction/adoption are batched per file and the
  workflow timeout is configurable (as today); the scan stage caps and `log()`s anything it skips so
  truncation is never silent.
- **A pre-existing `DESIGN.md` contradicts the code** → reconcile stage prefers `DESIGN.md` values
  and records each divergence in the report (mirrors the `ds-from-design-md` contradiction handling).
- **Adoption mutating files in parallel** → the workflow runs adoption sequentially per component
  within one session; no parallel writers to the same path.

## Migration Plan

Purely additive. New endpoint, CLI subcommand, MCP tools, and `project/` backend module; no changes
to existing creation paths, file format, or lint rules. `design-surface-api` gains read-only progress
+ report endpoints. No data migration; existing systems are unaffected. Rollback = revert the change;
no persisted schema changes beyond the per-session report (in-memory + alongside the generated
system).

## Open Questions

- Should the adoption report persist to `design-systems/<id>/` (e.g. `adoption-report.json`) for
  later re-triage, or stay attached to the workflow session only? (Leaning: persist alongside the
  system so the UI can re-open it.)
- For a `DESIGN.md`-present project, do we also rewrite the `DESIGN.md` to the 9-section standard, or
  preserve it verbatim and only layer reconciliation notes? (Leaning: preserve verbatim like
  `ds-from-design-md`, append a reconciliation appendix.)
- Confidence thresholds for auto-rebind — fixed default vs. configurable via a flag? (Resolved: a
  fixed default constant of `0.8` is the high-confidence threshold for this change — a proposal at
  `confidence >= 0.8` is high-confidence; a flag may be exposed later if needed.)
