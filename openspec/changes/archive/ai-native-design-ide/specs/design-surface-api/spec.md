---
id: specs
capability: design-surface-api
---

## ADDED Requirements

### Requirement: GET /api/surface endpoint
The backend SHALL expose a `GET /api/surface` endpoint that returns the current design surface state. The response SHALL include:
- `activeComponent`: The currently active component name or null
- `activeStory`: The currently active story ID or null
- `designSystem`: Active design system ID
- `viewport`: The current viewport dimensions `{ width, height }` or null
- `composition`: The render snapshot DOM tree (from the most recent charters evaluation)
- `tokenUsage`: Array of token roles used in the current component with their resolved values
- `a11yViolations`: Array of axe-core violations from the most recent a11y check, or null
- `lintFindings`: Array of unresolved lint findings for the active component

#### Scenario: AI queries the surface
- **WHEN** the AI calls `GET /api/surface`
- **THEN** it receives the full surface state for the current story
- **THEN** the AI can use the composition tree to understand the component structure

#### Scenario: No active component
- **WHEN** no component is currently active
- **THEN** the endpoint returns `{ activeComponent: null, activeStory: null, ... }` with available global state

### Requirement: Surface state is cached
The backend SHALL cache the most recent evaluation results (render snapshot, lint findings, a11y) for 5 seconds. The `/api/surface` endpoint SHALL return cached data when available, rather than re-evaluating on every request.

#### Scenario: Repeated calls use cache
- **WHEN** the AI calls `GET /api/surface` twice within 5 seconds
- **THEN** the second call returns cached data
- **THEN** no new evaluation is triggered

### Requirement: Surface state is updated on story change
When the addon's iframe emits `EVT_VIEW_CONTEXT`, the backend SHALL pre-compute the surface state for that component and cache it, so that `GET /api/surface` returns immediately on the next call.

#### Scenario: Pre-computation on navigation
- **WHEN** the user navigates to a new story
- **THEN** the `EVT_VIEW_CONTEXT` event triggers backend pre-computation
- **THEN** the first `GET /api/surface` call after navigation returns cached data
