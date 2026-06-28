---
id: specs
capability: component-context-harness
---

## ADDED Requirements

### Requirement: Component harness decorator
The system SHALL provide a `withComponentContext` Storybook decorator that wraps each rendered component with:
- A `data-emdesign-component` attribute on the root element set to the component name
- An `ErrorBoundary` that catches render errors and exposes them via a channel event
- A hidden `<script type="application/emdesign+json">` tag containing component metadata
- A post-render hook that captures the semantic DOM tree and emits it

#### Scenario: Decorator adds metadata attribute
- **WHEN** a story renders with the `withComponentContext` decorator
- **THEN** the root element inside `#storybook-root` has `data-emdesign-component="Button"`
- **THEN** a `<script type="application/emdesign+json">` tag is present in the story root

#### Scenario: Error boundary catches render errors
- **WHEN** a component throws during render
- **THEN** the ErrorBoundary renders a fallback UI with the error message
- **THEN** an `EVT_COMPONENT_ERROR` channel event is emitted with the error details

### Requirement: Component metadata schema
The metadata script tag SHALL contain JSON with the following fields:
- `component`: Component name
- `filePath`: Source file path (relative to project root)
- `props`: Object with prop names and their TypeScript types
- `tokenBindings`: Array of CSS token roles used by the component (e.g., `["color-surface", "color-accent"]`)
- `designSystem`: Active design system ID
- `stories`: Array of story export names for this component

#### Scenario: Metadata is available for AI consumption
- **WHEN** the AI queries the DOM for `script[type="application/emdesign+json"]`
- **THEN** it receives valid JSON with component metadata
- **THEN** the AI can use `props`, `filePath`, and `tokenBindings` to understand the component structure

### Requirement: Harness is opt-in per project via preview.ts
The harness SHALL be available as a separate decorator export: `import { withComponentContext } from '@emdesign/addon/harness'`. Projects opt in by adding it to their `.storybook/preview.ts` decorators list. The workspace template SHALL include it by default.

#### Scenario: Project enables the harness
- **WHEN** the project's `.storybook/preview.ts` includes `withComponentContext` in its decorators
- **THEN** every story gets the harness wrapper
- **THEN** the story renders normally with the added metadata
