## ADDED Requirements

### Requirement: User can create a design system by uploading a DESIGN.md file

The system SHALL provide a "Create from DESIGN.md" path in the Design System tab. The user uploads a DESIGN.md file (following the 9-section spec or a compatible format), and the system auto-extracts branding, generates tokens.css, scaffolds primitives, and produces a complete, validated design system.

#### Scenario: User uploads a valid DESIGN.md
- **WHEN** the user selects "DESIGN.md" and uploads a complete DESIGN.md file
- **THEN** the system parses the frontmatter (name, category, description)
- **THEN** the system extracts color values from the Color section
- **THEN** the system extracts typography values from the Typography section
- **THEN** the system generates a complete tokens.css with all semantic token roles
- **THEN** the system scaffolds primitives from the atelier base
- **THEN** the system builds the knowledge graph and validates the token contract

#### Scenario: DESIGN.md has minimal content
- **WHEN** the user uploads a DESIGN.md with only frontmatter and a Color section
- **THEN** the system uses defaults for missing sections (typography, spacing, motion)
- **THEN** the generated tokens.css declares all required roles (missing ones use sensible defaults)
- **THEN** the validation report notes which sections were inferred

#### Scenario: DESIGN.md parsing finds contradictions
- **WHEN** the DESIGN.md Color section lists `#fff` as the surface but the frontmatter says "dark mode"
- **THEN** the system prefers the inline values over frontmatter and logs a warning
- **THEN** generation continues with the inline values
- **THEN** the validation report flags the contradiction

### Requirement: Design MD content is preserved and attributed

The system SHALL preserve the user's uploaded DESIGN.md as the canonical source. Generated tokens.css SHALL be derived from it. The manifest SHALL record the source as "user-uploaded" with the original filename.

#### Scenario: Original content preserved
- **WHEN** the creation workflow completes
- **THEN** the DESIGN.md file in the new system directory is the user's original file (unchanged)
- **THEN** the manifest.json has `source.type: "design-md-upload"`
- **THEN** the tokens.css values match the DESIGN.md color and typography specifications
