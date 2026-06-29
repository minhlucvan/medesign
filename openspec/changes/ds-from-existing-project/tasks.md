## 1. Project analysis & extraction (backend)

- [x] 1.1 Create `packages/backend/src/project/extract.ts` with a deterministic Tailwind config reader (theme/extend: colors, fonts, spacing, radius, shadows) emitting raw observations with `{ file, line }`
- [x] 1.2 Add CSS custom-property extraction (scan stylesheets for `--*` declarations + resolved values; flag conflicts with the Tailwind config)
- [x] 1.3 Add component-source scanning for raw values (hex, px) and inline utility usage with occurrence counts and provenance
- [x] 1.4 Implement clustering: merge near-duplicate values into proposed semantic token roles, each with a confidence score and the merged evidence
- [x] 1.5 Fill required roles that have no evidence with documented defaults, marked as `default` (not extracted)
- [x] 1.6 Unit-test extraction + clustering against a fixture project (tailwind config + css vars + components) — assert proposed roles, confidence, and provenance

## 2. Component adoption (backend)

- [x] 2.1 Create `packages/backend/src/project/adopt.ts` that places discovered components into `componentsDir` (idempotent: diff against already-placed files, no duplicates)
- [x] 2.2 Implement safe rebinding: rewrite hardcoded values to a semantic role only when exactly one high-confidence candidate exists; leave ambiguous values untouched
- [x] 2.3 Generate a CSF story for any adopted component lacking one
- [x] 2.4 Derive per-component readiness by running the existing lint (`countMustFix() === 0 && no off-token-color` ⇒ loop-ready); collect blocking values with locations
- [x] 2.5 Build the structured adoption report (per-component status, rebinds before/after + provenance, blocking values)
- [x] 2.6 Unit-test adoption: unambiguous rebind applied, ambiguous left + flagged, report classification correct, re-run is idempotent

## 3. ds-from-project workflow + API

- [x] 3.1 Add `runFromProject(sessionId, { projectPath, name?, id? })` to `WorkflowOrchestrator` (`packages/backend/src/workflow.ts`) with stages `scan → extract → synthesize DESIGN.md → tokens → primitives → adopt → graph → validate`
- [x] 3.2 Synthesize `DESIGN.md` from extracted evidence when absent; when present, treat it as canonical, reconcile against code, and record divergences
- [x] 3.3 Generate `tokens.css` from proposed roles (prefer `DESIGN.md` values when present), scaffold/derive `code/` primitives, and build `graph.json` via `buildAndSave`
- [x] 3.4 Declare the new system in `emdesign.config.json` / write `manifest.json` with `source.type: "project"` ONLY after `validate` passes; on any stage failure stop and register nothing
- [x] 3.5 Add `POST /api/design-systems/from-project` in `packages/backend/src/workflow-api.ts`; validate the project path/type before starting
- [x] 3.6 Ensure stage progress flows through the existing `WorkflowStore` and `GET /api/design-systems/:id/workflow-stream` SSE (stage events + intermediate artifacts)

## 4. Surface API (design-surface-api)

- [x] 4.1 Expose ds-from-project workflow status (terminal state + failing stage/reason) via the surface API
- [x] 4.2 Serve the adoption report for a completed workflow (per-component readiness, rebinds, blocking values)

## 5. MCP tools

- [ ] 5.1 Add `analyze_project` tool in `packages/mcp-server/src/mcp.ts` (path → extracted values, proposed roles, confidence, provenance) with a Zod input schema
- [ ] 5.2 Add `adopt_components` tool (run/preview adoption, return the structured report)

## 6. CLI

- [ ] 6.1 Add `else if (importSrc === 'project')` branch to `cmdDs` and `importProjectDesign(paths, projectPath, opts)` in `scaffold.ts` driving the orchestrator in-process
- [ ] 6.2 Print stage progress; on completion emit the adoption report (`--json` structured / default human summary)
- [ ] 6.3 Honor `--gate`: non-zero exit when validation fails or any component is `needs-manual-fix`; error clearly on an invalid/unsupported project path
- [ ] 6.4 Document `ds import project <path>` in `docs/cli-commands.md`

## 7. Frontend (addon)

- [ ] 7.1 Add a "From Existing Project" path to the System tab creator (project-path/current-workspace input)
- [ ] 7.2 Subscribe to the workflow SSE and render live stage progress with intermediate artifacts
- [ ] 7.3 Build the adoption-report triage view — client-side display only over the read-only report (mark rebinds reviewed / components for follow-up as view state; no write-back persistence): loop-ready vs needs-manual-fix

## 8. Verification

- [ ] 8.1 End-to-end: run `ds import project` against a fixture with no `DESIGN.md` → produces a system that passes `ds validate` and a report classifying every component
- [ ] 8.2 End-to-end: run against a fixture WITH a `DESIGN.md` → `DESIGN.md` preserved as canonical, divergences reported
- [ ] 8.3 Confirm an adopted loop-ready component passes the consistency lint and is usable by `design`/`edit`/`doctor`/`capture`
- [ ] 8.4 Update `CLAUDE.md` CLI overview to list the new `ds import project` path
