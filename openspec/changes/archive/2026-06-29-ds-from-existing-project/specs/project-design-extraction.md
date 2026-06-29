# ADDED Requirements

### Requirement: System extracts design decisions from project source

The system SHALL analyze an existing project and mine its design decisions — color, typography,
spacing, radius, and shadow values — from the Tailwind config, CSS custom properties, and
component source files. Extraction SHALL be deterministic where possible and agent-assisted only for
interpretation.

#### Scenario: Extract from Tailwind config
- **WHEN** the project has a `tailwind.config.js`/`.ts` with a `theme`/`theme.extend` block
- **THEN** the system reads declared colors, font families, spacing scale, border radii, and shadows
- **THEN** each extracted value is recorded with its source `file:line` provenance

#### Scenario: Extract from CSS custom properties
- **WHEN** the project declares CSS custom properties (e.g., `--color-*`, `--radius-*`) in a stylesheet
- **THEN** the system collects them and their resolved values
- **THEN** values that shadow or conflict with the Tailwind config are noted as conflicts

#### Scenario: Extract from component source
- **WHEN** components use raw values (hex colors, px spacing) or utility classes inline
- **THEN** the system collects those occurrences with provenance
- **THEN** the frequency of each value is counted to inform clustering

### Requirement: Extracted values are clustered into proposed token roles

The system SHALL cluster the extracted raw values and propose semantic token roles (e.g.,
`bg-surface`, `text-accent`, `rounded`) and primitive candidates. Each proposal SHALL carry a
confidence score and the evidence behind it.

#### Scenario: Near-duplicate colors are merged
- **WHEN** the project uses colors whose maximum per-channel difference is `<= 4` out of 255 (e.g., `#0a0a0a`, `#0b0b0b`)
- **THEN** the system clusters them into a single proposed role
- **THEN** the proposal lists the merged source values and their occurrence counts

#### Scenario: Sufficiently distant colors are not merged
- **WHEN** two colors differ by more than the merge tolerance — maximum per-channel difference `> 4` out of 255 (e.g., `#0a0a0a`, `#1a1a1a`)
- **THEN** the system keeps them as separate proposed roles

#### Scenario: Consistent single-role value gets high confidence
- **WHEN** a value has an occurrence count `>= 3` and maps to exactly one role
- **THEN** its proposal has `confidence >= 0.8` (the high-confidence threshold)

#### Scenario: Rare or ambiguous value gets low confidence
- **WHEN** a value has an occurrence count `< 3`, or maps to more than one role
- **THEN** its proposal has `confidence < 0.8` and is flagged for review

#### Scenario: A required role has no evidence
- **WHEN** the project provides no evidence for a required semantic role
- **THEN** the system proposes a documented default for that role
- **THEN** the proposal is marked as a default (not extracted) so the report can surface it

### Requirement: Extraction is exposed as MCP tools

The system SHALL expose the project analysis and extraction capability as MCP tools so the agent
loop can invoke analysis and read proposed roles with provenance.

#### Scenario: Agent requests analysis
- **WHEN** the agent calls the project-analysis tool with a project path
- **THEN** it receives the extracted values, proposed roles, confidence scores, and provenance
- **THEN** the result is structured (machine-readable), not free text
