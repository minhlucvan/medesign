# ADDED Requirements

### Requirement: Existing components are adopted into the standardized workspace

The system SHALL bring an existing project's components under emdesign management by placing them in
the standardized component directory and registering them in the knowledge graph, so that downstream
workflows (design, edit, doctor, capture, critique) can operate on them.

#### Scenario: Components are placed and registered
- **WHEN** the adoption stage runs after the design system is generated
- **THEN** each discovered component is placed under the standardized component directory
- **THEN** each adopted component is registered in `graph.json` with `file:line` provenance
- **THEN** a story is generated for any component that lacks one, so it is visible in Storybook

#### Scenario: Adoption is idempotent
- **WHEN** the adoption stage runs again on the same project
- **THEN** already-adopted components are not duplicated
- **THEN** the report reflects unchanged vs. updated components

### Requirement: Hardcoded values are rebound to inferred tokens where safe

The system SHALL rebind hardcoded values in adopted components to the inferred semantic token roles
when the mapping is unambiguous — exactly one candidate token role with `confidence >= 0.8` (the
high-confidence threshold) — and SHALL leave all other values unchanged while flagging them.

#### Scenario: Unambiguous value is rebound
- **WHEN** a component hardcodes a value that maps to exactly one token role with `confidence >= 0.8`
- **THEN** the system rebinds the value to the semantic role (e.g., `#fff` → `bg-surface`)
- **THEN** the rebind is recorded in the report with before/after and provenance

#### Scenario: Ambiguous value is left for manual fix
- **WHEN** a hardcoded value maps to more than one candidate role, or to no role with `confidence >= 0.8`
- **THEN** the system does NOT rebind it automatically
- **THEN** the component is marked needs-manual-fix with the specific value and candidate roles

### Requirement: Adoption produces a per-component readiness report

The system SHALL produce an adoption report classifying each component as loop-ready or
needs-manual-fix, with the reasons, so users know which components will pass the consistency lint and
which require attention before they enter the loop.

#### Scenario: Report classifies components
- **WHEN** adoption completes
- **THEN** the report lists every component with a status of loop-ready or needs-manual-fix
- **THEN** loop-ready components contain no off-token hardcoded values
- **THEN** needs-manual-fix components list each blocking value and its location

#### Scenario: Report is machine-readable and human-readable
- **WHEN** the report is requested with `--json`
- **THEN** the system returns a structured report (per-component status, rebinds, blocking values)
- **WHEN** requested without `--json`
- **THEN** the system prints a human-readable summary with counts and the triage list

### Requirement: Adoption is exposed as an MCP tool

The system SHALL expose component adoption as an MCP tool (`adopt_components`) so the agent loop can
run or preview adoption and receive the structured adoption report.

#### Scenario: Agent invokes adoption in run or preview mode
- **WHEN** the agent calls the `adopt_components` tool with a run or preview mode argument
- **THEN** in run mode the system performs adoption (place, rebind, classify) and in preview mode it computes the planned rebinds and classification without writing files
- **THEN** it returns the structured adoption report (per-component status, rebinds, blocking values) as defined by the adoption-report requirement above
