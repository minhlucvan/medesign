## ADDED Requirements

### Requirement: Auto-fix orchestrator workflow

A new workflow `auto-fix-workflow.js` SHALL be added to `apps/workspace/templates/claude/workflows/`. It SHALL orchestrate the full auto-diagnose and fix pipeline, supporting two modes:

- **Guided mode** (default): runs diagnostics, returns findings to caller, the caller asks user for confirmation before applying fixes
- **Auto mode** (one-click): applies all auto-fixable issues directly, then re-verifies with rollback on regression

The pipeline stages:

1. **Baseline** — capture pre-fix scores via `emdesign doctor all --json`
2. **Diagnose (parallel)** — run ALL probes concurrently: `doctor visual`, `doctor lint`, `spatial audit`, `component a11y`, `render analyze`, `component diff`, and optionally `vision` critique
3. **Analyze** — parse each probe's JSON output into structured `DiagnosticIssue` items with priority (P0/P1/P2), deduplicate, sort, determine fixability
4. **Propose Fixes** — in guided mode, return findings with `awaitingConfirmation: true` so the caller presents them to the user
5. **Apply** — in auto mode, apply all fixable issues; token-binding fixes delegate to `element-workflow`
6. **Re-verify** — run `doctor all --gate`, compare post-fix scores against baseline, detect regression
7. **Report** — return standardized result with findings, applied fixes, gate verdict, improvement summary

#### Scenario: Complete guided auto-fix pipeline
- **WHEN** `auto-fix-workflow` receives `{ name: "Button", mode: "guided" }`
- **THEN** it SHALL run all pipeline stages 1-4 (Baseline, Diagnose, Analyze, Propose Fixes)
- **AND** return a result with `awaitingConfirmation: true`, `findings[]`, `autoFixable[]`, `needsHuman[]`, and `_instructions` for the caller
- **AND** NOT apply any fixes
- **AND** the caller/agent SHALL present the findings to the user and ask for confirmation
- **AND** on user confirmation, the caller SHALL re-invoke with `{ mode: "auto" }`

#### Scenario: Complete auto-mode pipeline (one-click)
- **WHEN** `auto-fix-workflow` receives `{ name: "Button", mode: "auto" }`
- **THEN** it SHALL run ALL 7 pipeline stages
- **AND** token-binding fixes SHALL delegate to `element-workflow`
- **AND** return the final result with `applied[]`, `gate`, `improvements`

#### Scenario: Parallel diagnostic probes (all check types)
- **WHEN** the workflow reaches the Diagnose stage
- **THEN** ALL of the following SHALL be invoked in parallel via `workflow.parallel()`:
  - `emdesign doctor visual <name> --json` (visual regression check)
  - `emdesign doctor lint <name> --json` (token binding / anti-pattern lint)
  - `emdesign spatial audit <name> --grid --json` (overlaps, grid alignment)
  - `emdesign component a11y <name> --json` (accessibility audit)
  - `emdesign render analyze <name> --json` (DOM tree depth, node count)
  - `emdesign component diff <name> --json` (generated vs captured comparison)
- **AND** the workflow SHALL wait for all probes to complete
- **AND** probes that fail/timeout SHALL be reported as "unavailable" rather than blocking the pipeline
- **AND** each probe's output SHALL be parsed into structured findings

#### Scenario: Visual check findings
- **WHEN** the visual check returns a score < 0.85
- **THEN** a `P0` (score < 0.6) or `P1` (score < 0.85) finding SHALL be added with source `visual` and type `visual-regression`
- **WHEN** `diffPixels > 0` from the visual check
- **THEN** a `P1` or `P2` finding SHALL be added with source `visual`, type `pixel-drift`, and the number of differing pixels

#### Scenario: Vision critique is optional
- **WHEN** `vision: true` is set in the trigger event
- **THEN** the workflow SHALL also run `emdesign vision <name> --json` as a parallel probe
- **AND** vision findings SHALL be merged into the aggregate issue list
- **WHEN** `vision: false` (default)
- **THEN** the vision probe SHALL NOT be invoked

#### Scenario: Fixability determination
- **WHEN** analyzing findings, the workflow SHALL mark findings as `fixable: true` only for:
  - Token-binding violations with a known replacement token (`!!f.fixCandidate`)
  - Small spatial overlaps (≤ 10px)
  - Grid alignment violations
- **WHEN** findings cannot be auto-fixed (a11y violations, deep DOM, complex overlaps, vision polish)
- **THEN** they SHALL be marked `fixable: false` with an `autoFixHint` for the human

#### Scenario: Gate verification with rollback only in auto mode
- **WHEN** all fixes are applied in auto mode and `doctor all --gate` runs
- **THEN** the workflow SHALL compare the new composite score and mustFix count against pre-fix baselines
- **AND** if `newComposite < oldComposite - 0.05` OR `newMustFix > oldMustFix`
- **THEN** the workflow SHALL flag `rollbackNeeded: true` and return `gate: "regression"`
- **AND** the caller/agent SHALL decide whether to rollback

#### Scenario: Improvement summary
- **WHEN** the workflow completes successfully
- **THEN** the `improvements[]` array SHALL contain human-readable strings summarizing what improved:
  - Composite score delta (positive)
  - MustFix count reduction
  - Whether the component now passes all gates
  - How many issues need human review

### Requirement: Workflow registration in entry-workflow.js

The `entry-workflow.js` SHALL be updated to route `auto-fix`/`wand` intents to `auto-fix-workflow`:

- Intent type `auto-fix`, `wand`, or `magic-wand` SHALL classify as element-layer `auto-fix-workflow`
- Combined intents containing "auto fix", "fix this", or "fix component" SHALL also route to `auto-fix-workflow`
- The `mode` parameter SHALL be passed from the payload (default: `auto` for preview tool, `guided` for CLI/agent)
- The `vision` flag SHALL be passed from the payload or detected from the intent string

#### Scenario: Entry workflow routes auto-fix intent
- **WHEN** `entry-workflow` receives type `auto-fix` with target `Button`
- **THEN** it SHALL classify to `element/auto-fix-workflow` layer
- **AND** enrich context with workspace, DS, Storybook, and graph info
- **AND** execute `auto-fix-workflow` with args `{ name: "Button", mode: "auto", vision: false }`

#### Scenario: Entry workflow routes wand intent with vision
- **WHEN** `entry-workflow` receives type `wand` with target `Button` and payload `{ vision: true }`
- **THEN** it SHALL execute `auto-fix-workflow` with args `{ name: "Button", mode: "auto", vision: true }`

#### Scenario: Entry workflow routes guided fix intent
- **WHEN** `entry-workflow` receives type `wand` with target `Button` and payload `{ mode: "guided" }`
- **THEN** it SHALL execute `auto-fix-workflow` with args `{ name: "Button", mode: "guided", vision: false }`

### Requirement: /mds:wand CLI command

A new slash command `/mds:wand` SHALL be added to `apps/workspace/templates/claude/commands/mds/`. It SHALL:

- Accept a component name as argument: `/mds:wand Button`
- Accept `--vision` flag: `/mds:wand Button --vision`
- Accept `--guided` flag (default) or `--auto` flag for mode selection
- Invoke the entry workflow with type `wand`
- In guided mode: display findings as formatted markdown, ask "Apply these N fixes?", wait for user response before applying
- Display results in a formatted summary with findings, fixes, and improvement summary

#### Scenario: CLI wand in guided mode (default)
- **WHEN** user runs `/mds:wand Button`
- **THEN** the entry workflow SHALL run `auto-fix-workflow` on `Button` with `mode: "guided"`
- **AND** display a formatted findings list with auto-fixable and needs-human items
- **AND** ask the user "Apply N auto-fix(es)?"
- **AND** only apply fixes after user confirms

#### Scenario: CLI wand auto mode
- **WHEN** user runs `/mds:wand Button --auto`
- **THEN** the entry workflow SHALL run `auto-fix-workflow` on `Button` with `mode: "auto"`
- **AND** output a summary of what was detected, fixed, and the gate result

#### Scenario: CLI wand with vision
- **WHEN** user runs `/mds:wand Button --vision`
- **THEN** vision critique SHALL be included in the diagnostic pipeline
