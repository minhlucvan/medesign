## ADDED Requirements

### Requirement: Tokens are displayed and editable inside section cards

Tokens SHALL be displayed inside their respective section cards (Colors, Typography, Spacing & Shape, Motion). Each card shows relevant tokens with inline editing and a [Customize with AI] button for agent-driven changes.

#### Scenario: Colors card shows color tokens
- **WHEN** the user is viewing the DS tab
- **THEN** the Colors card shows all color tokens (surface, text, accent, border, status) as swatches with role labels and hex values
- **THEN** clicking a swatch opens an inline color picker to edit the hex value
- **THEN** pressing Enter saves the change via POST /api/design-systems/:id/tokens
- **THEN** the card shows a [Customize with AI] button for agent-driven color changes

#### Scenario: Typography card shows font tokens with preview
- **WHEN** the user is viewing the DS tab
- **THEN** the Typography card shows font tokens (display, sans, mono) with a preview text rendered in each font
- **THEN** clicking a font name opens an inline select of available fonts
- **THEN** the preview text updates to show the selected font

#### Scenario: Spacing card uses sliders
- **WHEN** the user is viewing the DS tab
- **THEN** the Spacing & Shape card shows space-unit and radius as labeled sliders
- **THEN** moving the slider updates the value and sends the change immediately
- **THEN** a [Customize with AI] button is available for text-driven changes

#### Scenario: User enters invalid token value
- **WHEN** the user enters an invalid CSS value (e.g., "not-a-color" for a color token)
- **THEN** inline validation shows an error: "Invalid color value"
- **THEN** the value is not saved
- **THEN** the field remains editable for correction

### Requirement: Primitives card shows scaffolded components with add/remove

The Primitives card SHALL list all scaffolded components (Button, Card, Badge, etc.) with their scaffold status. An [Add primitive +] button opens a panel listing available built-in blocks (27 primitives from the block registry) grouped by category with checkboxes.

#### Scenario: User scaffolds a primitive from the Primitives card
- **WHEN** the user clicks [Add primitive +] on the Primitives card
- **THEN** a panel opens showing available primitives grouped by category (form, data, navigation, feedback, layout)
- **THEN** each primitive shows its name, description, and whether it's already scaffolded
- **WHEN** the user checks "Button", "Card", "Badge" and clicks "Scaffold"
- **THEN** the system calls POST /api/design-systems/:id/primitives { blocks: ["Button", "Card", "Badge"] }
- **THEN** the backend copies the primitive source from the atelier base
- **THEN** the card refreshes showing the new components in the list

#### Scenario: Primitive already exists
- **WHEN** the user opens the add-primitive panel
- **THEN** already-scaffolded primitives are shown with a checkmark and "Scaffolded" label
- **THEN** the count shows "3 scaffolded / 27 available"

### Requirement: Token editor supports batch operations

The token editor (accessible from any section card's overflow menu) SHALL support bulk token export and import.

#### Scenario: User exports tokens
- **WHEN** the user clicks "Export Tokens" from a section card menu
- **THEN** all tokens are formatted as CSS `:root { ... }` block
- **THEN** the CSS is copied to the clipboard
- **THEN** a confirmation appears: "Tokens copied to clipboard"

#### Scenario: User imports tokens
- **WHEN** the user clicks "Import Tokens" and pastes CSS variable declarations
- **THEN** the system parses the declarations and validates each value
- **THEN** a diff preview shows what will change
- **WHEN** the user confirms the import
- **THEN** the tokens.css is updated with the new declarations
- **THEN** unchanged token values are preserved
