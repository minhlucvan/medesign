# ADDED Requirements

### Requirement: User can create a design system from an existing project

The system SHALL provide a "From Existing Project" path that takes a project directory (or the
current workspace) and produces a complete, validated emdesign design system following the standard
contract (`DESIGN.md`, `tokens.css`, `code/` primitives, `graph.json`) declared in
`emdesign.config.json`. The path SHALL work whether or not the project contains a `DESIGN.md`.

#### Scenario: Project has no DESIGN.md
- **WHEN** the user starts the flow against a project with a Tailwind config and components but no `DESIGN.md`
- **THEN** the system runs the `ds-from-project` workflow to extract design decisions from the source
- **THEN** the system generates a `DESIGN.md` covering the standard sections from the extracted evidence
- **THEN** the system generates `tokens.css` declaring all required semantic token roles
- **THEN** the system scaffolds/derives `code/` primitives and builds `graph.json`
- **THEN** the system declares the new design system in `emdesign.config.json`
- **THEN** the system validates the token contract and returns an adoption report

#### Scenario: Project already has a DESIGN.md
- **WHEN** the project contains a `DESIGN.md`
- **THEN** the system treats the existing `DESIGN.md` as the canonical source
- **THEN** the system reconciles it against the values actually used in the code
- **THEN** the report flags each place where the code diverges from the declared `DESIGN.md`
- **THEN** the generated `tokens.css` prefers the `DESIGN.md` values and notes overrides

#### Scenario: Generated system passes its own validation
- **WHEN** the workflow completes
- **THEN** the generated design system SHALL pass `ds validate` (token contract self-check)
- **THEN** any role that could not be confidently inferred uses a documented default and is listed in the report

### Requirement: A multi-stage workflow drives creation with progress feedback

The system SHALL implement a `ds-from-project` workflow with discrete stages — scan, extract,
synthesize `DESIGN.md`, generate `tokens.css`, derive primitives, adopt components, build graph,
validate — and SHALL emit progress for each stage so a client can show real-time status.

#### Scenario: Stage progress is streamed
- **WHEN** the workflow runs
- **THEN** each stage SHALL emit a progress event with the stage name and status (started / completed / failed)
- **THEN** a client subscribing to progress receives events in stage order
- **THEN** intermediate artifacts (extracted tokens, generated `DESIGN.md`) are available to the client as they complete

#### Scenario: A stage fails
- **WHEN** a stage fails (e.g., the project cannot be parsed)
- **THEN** the workflow SHALL stop, emit a failed event naming the stage and reason
- **THEN** no partial design system is registered in `emdesign.config.json`

### Requirement: Backend API starts and streams the ds-from-project workflow

The system SHALL expose backend endpoints to start the `ds-from-project` workflow, stream its
progress, and return the adoption report (see the `component-adoption` capability for the report's
shape).

#### Scenario: Start via API
- **WHEN** a client POSTs a start request with a project path
- **THEN** the backend validates the path exists and is a supported project type
- **THEN** the backend begins the workflow and returns a handle for streaming progress

### Requirement: CLI command `ds import project` runs the flow

The system SHALL provide a CLI command `ds import project <path>` as a sibling of the existing
`ds import awesome|git|vendor` commands that runs the `ds-from-project` workflow and emits the
adoption report.

#### Scenario: Start via CLI
- **WHEN** the user runs `ds import project ./my-app`
- **THEN** the CLI runs the workflow and prints stage progress
- **THEN** on completion it prints (or with `--json` emits) the adoption report
- **THEN** the exit code is non-zero if validation fails or with `--gate` if any component is not loop-ready

#### Scenario: Invalid project path
- **WHEN** the supplied path does not exist or is not a supported project
- **THEN** the system returns an error identifying the problem and does not create a design system
