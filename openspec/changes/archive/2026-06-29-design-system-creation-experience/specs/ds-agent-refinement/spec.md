## MODIFIED Requirements

### Requirement: User can request changes to a design system through a conversational interface

The system SHALL provide scoped refinement entry points on each section card in the DS tab detail view. Each card (Branding, DESIGN.md, Colors, Typography, Spacing, Motion, Primitives) has a `[Customize with AI]` button that opens a scoped chat intent. The agent reads only the relevant section and applies changes to it.

#### Scenario: User requests token change from Colors card
- **WHEN** the user clicks [Customize with AI] on the Colors card
- **THEN** a chat prompt opens scoped to `colors`
- **WHEN** the user types "shift the accent color to a warmer orange" and submits
- **THEN** the agent reads the current color tokens from tokens.css
- **THEN** the agent determines the new accent color (#d97706 or similar warm orange)
- **THEN** the agent updates `--color-accent` and `--color-accent-hover` in tokens.css
- **THEN** the agent also updates the Color section in DESIGN.md to match
- **THEN** the agent rebuilds the knowledge graph and re-validates
- **THEN** only the Colors card refreshes with the updated token values
- **THEN** a summary message appears in the card: "Accent shifted to warm orange (#d97706). Hover adjusted to #b45309."

#### Scenario: User requests multi-topic change from global input
- **WHEN** the user types "make it more rounded and add a card component" in the global change input (scope: `all`)
- **THEN** the agent identifies two separate changes: roundness (Spacing card) and primitive scaffolding (Primitives card)
- **THEN** the agent updates `--radius` from 8px to 12px (or requested value)
- **THEN** the agent scaffolds Card.tsx from the block registry
- **THEN** both changes are applied and validated
- **THEN** both the Spacing card and Primitives card refresh

#### Scenario: User requests DESIGN.md change from DESIGN.md card
- **WHEN** the user clicks [Customize with AI] on the DESIGN.md card
- **THEN** a chat prompt opens scoped to `design-md`
- **WHEN** the user types "update the tone to be more playful and add a motion section"
- **THEN** the agent reads the current DESIGN.md
- **THEN** the agent rewrites the Voice & Brand section with a playful tone
- **THEN** the agent writes a complete Motion & Interaction section with durations and easings
- **THEN** the agent updates tokens.css with motion tokens if needed
- **THEN** the system re-validates and refreshes the DESIGN.md card (and Motion card if created)

## ADDED Requirements

### Requirement: Refinement scope limits agent context and write surface

When a refinement is submitted with a `scope` parameter, the agent SHALL only read and modify files relevant to that scope. Scopes map to specific files and sections:

| Scope | Reads | Writes |
|-------|-------|--------|
| `branding` | manifest.json, DESIGN.md frontmatter + §8 | manifest.json (name, description) |
| `design-md` | Full DESIGN.md | DESIGN.md |
| `colors` | tokens.css color tokens, DESIGN.md §2 | tokens.css color tokens, DESIGN.md §2 |
| `typography` | tokens.css font tokens, DESIGN.md §3 | tokens.css font tokens, DESIGN.md §3 |
| `spacing` | tokens.css radius/space tokens, DESIGN.md §4 | tokens.css radius/space tokens, DESIGN.md §4-5 |
| `motion` | tokens.css motion tokens, DESIGN.md §7 | tokens.css motion tokens, DESIGN.md §7 |
| `primitives` | Block registry, code/ directory | code/ directory (scaffold new files) |
| `all` (default) | Everything | Everything |

### Requirement: Agent records pre-modification state for revert

The agent SHALL record a snapshot of the design system state before applying changes, enabling the user to revert the last refinement.

#### Scenario: User reverts a refinement
- **WHEN** the user clicks "Revert last change" after a refinement
- **THEN** the restoration snapshot is loaded (previous DESIGN.md, tokens.css, manifest)
- **THEN** the knowledge graph is rebuilt from the restored state
- **THEN** the DS tab refreshes with the previous state
- **THEN** a confirmation message appears: "Reversion complete — system restored to state before 'shift accent to orange'"

### Requirement: Agent refinement sessions show in the activity log

Each refinement SHALL create an activity log entry with the instruction, files changed, and validation result.

#### Scenario: Refinement appears in activity
- **WHEN** an agent refinement completes
- **THEN** a new activity log entry appears in the Emdesign panel
- **THEN** the entry shows: instruction summary, files modified, and validation status
- **THEN** clicking the entry shows the before/after diff
