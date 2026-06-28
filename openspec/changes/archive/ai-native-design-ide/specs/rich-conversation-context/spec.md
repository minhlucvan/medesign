---
id: specs
capability: rich-conversation-context
---

## ADDED Requirements

### Requirement: Automatic context enrichment on story change
The addon preview iframe SHALL emit an `EVT_VIEW_CONTEXT` channel event whenever the active story changes. The event payload SHALL contain:
- `component`: The current component name (PascalCase)
- `storyId`: The full Storybook story ID
- `storyName`: The export name of the current story
- `viewport`: `{ width, height }` of the iframe viewport
- `componentFile`: The file path of the component source
- `storyFile`: The file path of the story file
- `designSystem`: The active design system ID
- `tokens`: Array of token roles and values used by the component (from the component harness)
- `source`: The component source code (truncated to 2000 chars)

#### Scenario: Context is emitted on story navigation
- **WHEN** the user navigates to a new story
- **THEN** the `EVT_VIEW_CONTEXT` event is emitted with the new story's component, storyId, and viewport
- **THEN** the chat manager receives the event and stores it as the current context

#### Scenario: Viewport changes are propagated
- **WHEN** the viewport resizes beyond 100px change in either dimension
- **THEN** an updated `EVT_VIEW_CONTEXT` event is emitted with the new viewport dimensions

### Requirement: Context is included in chat messages
When the user sends a chat message, the system SHALL automatically append the current view context as a system message or metadata block. The AI SHALL receive the context as part of the conversation history.

#### Scenario: Chat message carries context
- **WHEN** the user types "fix this button" in the chat
- **THEN** the backend receives the message with context: `{ component: "Button", storyId: "generated-button--default", viewport: { width: 1280, height: 720 } }`
- **THEN** the AI responds with context-aware instructions

### Requirement: Context is displayed in the chat UI
The chat SHALL show the current context as a subtle badge or chip above the input area, indicating what the AI is currently "looking at."

#### Scenario: Context chip is visible
- **WHEN** a story is loaded
- **THEN** a chip reading "Viewing: Button @ 1280×720" is shown above the chat input
