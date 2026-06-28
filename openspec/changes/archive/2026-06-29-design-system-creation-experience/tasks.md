## 1. Backend: Scaffold & API extensions

- [x] 1.1 Add `POST /api/design-systems/from-prompt` endpoint — accepts prompt string, creates a workflow session, returns session ID for progress polling
- [x] 1.2 Add `POST /api/design-systems/from-design-md` endpoint — accepts DESIGN.md content (or file path), creates a workflow session, returns session ID
- [x] 1.3 Add `GET /api/design-systems/:id/workflow-status` endpoint — returns per-stage progress for an active workflow session
- [x] 1.4 Add `GET /api/design-systems/:id/workflow-stream` SSE endpoint — streams real-time per-stage progress events
- [x] 1.5 Add `POST /api/design-systems/:id/tokens` endpoint — bulk update token values with validation
- [x] 1.6 Add `POST /api/design-systems/:id/primitives` endpoint — scaffold one or more primitives from the block registry
- [x] 1.7 Add `GET /api/design-systems/create-options` endpoint — returns available create modes, sample prompts, tips
- [x] 1.8 Extend `POST /api/design-systems/customize` with new options: `labelFont`, `colorMode`, `colorVariant`
- [x] 1.9 Add `refine-design-system` intent type handler in the intent queue — creates a dedicated agent session with system context

## 2. Backend: Agent workflow for DS generation

- [x] 2.1 Implement `analyze-design-prompt` MCP tool — extracts mood, category, keywords, accent color hints, font preferences from natural language prompt
- [x] 2.2 Implement `generate-design-md` MCP tool — produces a complete 9-section DESIGN.md from analysis result (or from a DESIGN.md upload for stage 2 of the from-design-md flow)
- [x] 2.3 Implement `generate-tokens` MCP tool — parses DESIGN.md color/typography/spacing values, produces complete tokens.css with all semantic token roles
- [x] 2.4 Implement the workflow orchestrator for create-from-prompt: analyze → generate DESIGN.md → generate tokens → scaffold primitives → build graph → validate, with per-stage progress reporting via SSE
- [x] 2.5 Implement the workflow orchestrator for create-from-DESIGN.md: parse DESIGN.md → extract tokens → generate tokens.css → scaffold primitives → build graph → validate
- [x] 2.6 Add workflow progress store (in-memory) — keyed by session ID, tracks stage name, status, progress percentage, and any error
- [x] 2.7 Add workflow cancellation support — user can cancel a running generation via `POST /api/workflows/:sessionId/cancel`

## 3. Backend: Agent refinement system

- [x] 3.1 Implement `refine-design-system` MCP tool — reads current system state (DESIGN.md, tokens.css, manifest), applies a natural language instruction, returns diff of changes
- [x] 3.2 Add pre-modification snapshot recording — before any refinement, copy the current system directory to a `.snapshots/` subdirectory with a timestamp
- [x] 3.3 Implement revert endpoint `POST /api/design-systems/:id/revert` — restores the most recent snapshot
- [x] 3.4 Add activity logging for refinements — log instruction, files changed, validation result, timestamp to the existing activity log

## 4. Frontend: Creation form UI (3-path selector + progressive workflow)

- [x] 4.1 Add "Create New" view toggle to DesignSystemTab alongside "Design System" and "Catalog"
- [x] 4.2 Build 3-path selector — 3 visual cards in a row (Gallery, From Prompt, DESIGN.md) with icons and descriptions
- [x] 4.3 Build **Gallery path** — reuse/expose existing CatalogView as a picker, add a "Quick-customize form" after selection with name, seed color, font selects, roundness, light/dark toggle, live preview, and [Create Design System] button
- [x] 4.4 Build **From Prompt form** — textarea with floating example prompts below ("Dark editorial with lime accent…", "Minimal fintech, blue primary…"), name & ID fields, [Generate] button
- [x] 4.5 Build **DESIGN.md upload form** — drag-and-drop zone, file picker fallback, file validation (.md + YAML frontmatter), parsed preview showing name/category/sections found, name & ID fields, [Generate Design System] button
- [x] 4.6 Build `ProgressView` component — live stage list with status icons (✓ pending / 〜 running / ✓ done / ✗ error), timing per stage, hover detail, cancel button
- [x] 4.7 Build `IntermediatePreview` panel — shows progressive artifacts as they appear: DESIGN.md lines, color swatches, font previews, primitive list, validation status
- [x] 4.8 Wire all 3 creation paths to backend — submit → show ProgressView + IntermediatePreview → on completion auto-switch to Design System view
- [x] 4.9 When no design system exists yet, show Create New view as the default landing page (instead of an empty Design System view)
- [x] 4.10 Simplify CreateWizard — remove DesignSystemForm, keep Component/Story/View forms

## 5. Frontend: Gallery quick-customize form

- [x] 5.1 Build quick-customize form (replaces the old 5-step flow) — single-page form with all controls visible at once: name, ID, seed color, font selects, roundness slider, light/dark toggle
- [x] 5.2 Integrate live preview panel — right-side iframe showing the base reference-example.html with CSS overrides injected via query params, updates on every control change
- [x] 5.3 Add fallback preview for bases without reference-example.html — gradient + swatches derived from accent color and category
- [x] 5.4 Wire to `POST /api/design-systems/customize` — submit all params, handle success/error, on success switch to Design System view

## 6. Frontend: Section-card dashboard UI (DS detail view)

- [x] 6.1 Build section-card container component — collapsible cards with consistent header, body, and action bar pattern
- [x] 6.2 Build **Branding Card** — name, description, category inline editing, brand voice excerpt, [Customize with AI] button
- [x] 6.3 Build **DESIGN.md Card** — collapsed preview with expand to full markdown, inline textarea editing, [Customize with AI] button
- [x] 6.4 Build **Colors Card** — color swatches with role labels, click swatch to edit hex inline, [Customize with AI] button
- [x] 6.5 Build **Typography Card** — font family tokens with preview text ("The quick brown fox…"), click to edit inline, [Customize with AI] button
- [x] 6.6 Build **Spacing & Shape Card** — space unit, radius values with sliders for quick adjustment, [Customize with AI] button
- [x] 6.7 Build **Motion Card** — duration and easing tokens with display, [Customize with AI] button
- [x] 6.8 Build **Primitives Card** — list of scaffolded components with status, [Add primitive +] button opening block registry picker, [Customize with AI] button
- [x] 6.9 Add scoped refinement payload to each [Customize with AI] button — pre-fills intent with section scope (branding, design-md, colors, typography, spacing, motion, primitives)

## 7. Frontend: Agent refinement UI (scoped per-section)

- [x] 7.1 Add `scope` parameter to refinement intent payload — each [Customize with AI] button sends its section scope (branding, colors, typography, spacing, motion, primitives)
- [x] 7.2 Build inline refinement status per card — shows "Refining…" spinner in the card that triggered it (not a global overlay)
- [x] 7.3 Build refinement result display per card — summary of changes with diff, success/error state
- [x] 7.4 Add "Revert last change" button in the card footer — appears after a successful refinement on that card
- [x] 7.5 Wire each [Customize with AI] button to `submitIntent` with type `refine-design-system`, scope, and system ID

## 8. Integrations & polish

- [x] 8.1 Update the emdesign/deisgn surface API to include `dsWorkflowStatus` field
- [x] 8.2 Add loading skeletons for catalog cards and detail views during workflow operations
- [x] 8.3 Add error states for all new forms and flows (network error, validation error, timeout)
- [x] 8.4 Test create-from-prompt end-to-end: prompt → DESIGN.md → tokens → primitives → validate
- [x] 8.5 Test create-from-DESIGN.md end-to-end: upload → parse → tokens → primitives → validate
- [x] 8.6 Test customization flow end-to-end: pick base → 5 steps → create → system appears
- [x] 8.7 Test refinement flow: request change → agent modifies → system updates → revert works
- [x] 8.8 Test token editor: view → edit → save → verify tokens.css on disk
