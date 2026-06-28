## ADDED Requirements

### Requirement: User can customize a vendor base through a multi-step visual flow

When the user clicks "Use as Template" on a vendor base in the Catalog, the system SHALL present a 5-step guided customization flow with live preview: Identity, Colors, Typography, Shape & Feel, Review & Create.

#### Scenario: User customizes a base and creates a system
- **WHEN** the user clicks "Use as Template" on the "After Hours" base card
- **THEN** the customization flow opens at Step 1 (Identity)
- **WHEN** the user enters name "My Brand" and proceeds through all 5 steps
- **THEN** each step shows a live preview updated with current customizations
- **THEN** Step 5 shows a summary of all customizations with final preview
- **WHEN** the user clicks "Create Design System"
- **THEN** the system clones the base, applies all customizations, validates, and returns the new system

### Requirement: Step 1 — Identity

The first step SHALL collect the new design system's ID and name, with the live preview showing the base unchanged.

#### Scenario: Identity step validates input
- **WHEN** the user enters an ID with spaces or special characters
- **THEN** the system shows an inline error: "ID must be kebab-case (letters, numbers, hyphens)"
- **THEN** the "Next" button is disabled until the ID is valid
- **WHEN** the user enters an ID that conflicts with an existing system
- **THEN** the system shows an inline error: "A system with this ID already exists"

### Requirement: Step 2 — Colors

The second step SHALL let the user pick a seed/accent color, color variant, and color mode. The live preview updates the accent color, surfaces, and overall palette.

#### Scenario: Color picker updates preview
- **WHEN** the user picks a new accent color via the color input
- **THEN** the preview iframe reloads with the new accent color applied
- **THEN** the token card shows the new accent color value
- **WHEN** the user changes color variant from "tonal-spot" to "monochrome"
- **THEN** the preview iframe reloads with the monochrome palette
- **WHEN** the user toggles from "light" to "dark" mode
- **THEN** the preview iframe reloads with dark surfaces

### Requirement: Step 3 — Typography

The third step SHALL let the user select headline, body, and label fonts from a curated list. The live preview updates the iframe's font-family.

#### Scenario: Font selection updates preview
- **WHEN** the user selects "Newsreader" as the headline font
- **THEN** the preview iframe's headline text uses Newsreader
- **THEN** the token card shows `--font-display: "Newsreader"`
- **WHEN** the user selects "Inter" as the body font
- **THEN** the preview iframe's body text uses Inter
- **WHEN** the user returns to defaults
- **THEN** the preview iframe reverts to the base's original fonts

### Requirement: Step 4 — Shape & Feel

The fourth step SHALL provide controls for roundness (slider: 4/8/12/full), spacing unit (slider: 4/8/12/16px), and DESIGN.md tone (editable textarea).

#### Scenario: Roundness slider updates preview
- **WHEN** the user moves the roundness slider from 8 to 12
- **THEN** the preview iframe shows more rounded corners
- **THEN** the token card shows `--radius: 12px`
- **WHEN** the user selects "full" roundness
- **THEN** the preview shows pill-shaped elements

### Requirement: Step 5 — Review & Create

The final step SHALL show a summary of all customizations with a final preview, and a "Create Design System" button.

#### Scenario: User creates the system
- **WHEN** the user clicks "Create Design System"
- **THEN** the system calls POST /api/design-systems/customize with all parameters
- **THEN** the backend clones the base and applies customizations
- **THEN** the backend validates the token contract
- **THEN** the backend builds the knowledge graph
- **THEN** on success, the system appears in "My Systems" and is selected
- **THEN** on failure, an error message is shown with details

### Requirement: Customization preview supports bases without reference-example.html

For vendor bases that lack a `reference-example.html`, the preview SHALL display a color-swatch-and-token-card layout instead of an iframe, so the user still sees their customization impact.

#### Scenario: Base has no preview file
- **WHEN** the user customizes a base without reference-example.html
- **THEN** the preview area shows a gradient derived from the accent color
- **THEN** the token palette is shown below the gradient
- **THEN** customization changes update the gradient and token values
