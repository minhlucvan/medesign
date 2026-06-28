## ADDED Requirements

### Requirement: User can create a design system from a natural language prompt

The system SHALL provide a "Create from Prompt" path in the Design System tab. The user enters a natural language description (e.g., "dark editorial system with lime accent, serif headlines") and the system generates a complete design system with DESIGN.md, tokens.css, manifest.json, and scaffolded primitives.

#### Scenario: User creates DS from simple prompt
- **WHEN** the user selects "Create from Prompt" and enters "dark editorial system with lime accent"
- **THEN** the system analyzes the prompt for mood, category, accent color, and typography cues
- **THEN** the system generates a complete 9-section DESIGN.md
- **THEN** the system generates a tokens.css with valid semantic tokens
- **THEN** the system scaffolds primitives (Button, Card, Heading, Text, Input, Badge, Stack)
- **THEN** the system builds the knowledge graph and validates the token contract
- **THEN** the new system appears in "My Systems" and is selectable

#### Scenario: User sees real-time progress during generation
- **WHEN** the user submits a prompt
- **THEN** a progress view appears showing each stage (Analyzing → Generating DESIGN.md → Generating Tokens → Scaffolding Primitives → Validating)
- **THEN** each stage updates with status (pending → running → done/error)
- **THEN** the total estimated time is shown
- **THEN** the user can cancel generation at any time

#### Scenario: Prompt generation fails mid-workflow
- **WHEN** a stage fails (e.g., token generation produces invalid CSS)
- **THEN** the system retries the failed stage once automatically
- **THEN** if retry also fails, the system returns partial results with an error message
- **THEN** the user can view the partial system or retry with a modified prompt

### Requirement: Prompt analysis extracts design intent

The system SHALL analyze the prompt to extract structured design intent: mood/atmosphere, category, accent color hints, typography preferences, and any specific component requests.

#### Scenario: Prompt with specific color and font
- **WHEN** the user enters "warm fintech system with blue #2563eb accent, Inter font"
- **THEN** the analysis extracts: mood=warm, category=fintech, accentColor=#2563eb, bodyFont=Inter
- **THEN** the generated DESIGN.md references these exact values

#### Scenario: Vague prompt uses defaults
- **WHEN** the user enters "modern minimal system"
- **THEN** the analysis extracts mood=modern, category=minimal
- **THEN** the system generates a neutral accent color and sensible font defaults
- **THEN** the generated system is valid but generic

### Requirement: Generated DESIGN.md follows the 9-section spec

The agent-generated DESIGN.md SHALL follow the 9-section contract from `docs/spec.md`: Visual Theme, Color (exact hex values), Typography (complete scale table), Spacing, Layout, Components (per-component specs), Motion, Voice, Anti-patterns.

#### Scenario: All 9 sections are present
- **WHEN** the generation workflow completes
- **THEN** the DESIGN.md file contains all 9 required sections
- **THEN** the Color section has exact hex values for every role (surface, text, accent, border, status)
- **THEN** the Typography section has a complete type-scale table
- **THEN** the Anti-patterns section has at least 3 do/don't guardrails
