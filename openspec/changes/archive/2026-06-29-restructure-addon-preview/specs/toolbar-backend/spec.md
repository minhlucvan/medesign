---
id: specs
capability: toolbar-backend
---

## ADDED Requirements

### Requirement: Backend integration for tool events
The toolbar SHALL delegate all backend API calls to a dedicated module. The module SHALL provide functions for each tool event type:

- `handleCommentSubmit(target, instruction)` — creates a session via `api.createSession` with type `change-request`, stores the comment via `api.storeComment`, submits an intent via `api.submitIntent`, and emits `EVT_CHAT_MODE` to open chat
- `handleTextSubmit(target, from, to)` — submits an `edit-text` intent via `api.submitIntent`
- `handleWandTrigger(payload)` — creates a session via `api.createSession` with type `wand`, submits an intent via `api.submitIntent` with type `wand`
- `handlePlaceTrigger(payload)` — creates a session via `api.createSession` with type `place`, submits an intent via `api.submitIntent` with type `place`

#### Scenario: Comment submit creates session + stores comment + submits intent
- **WHEN** `handleCommentSubmit` is called with a target and instruction
- **THEN** `api.createSession` is called with type `change-request`, the instruction, scope, origin `comment`, and element context
- **THEN** `api.storeComment` is called with storyId, selector, text, tag, component, and the new sessionId
- **THEN** `api.submitIntent` is called with type `change-request`, the instruction, target, and sessionId
- **THEN** `EVT_CHAT_MODE` is emitted with `{ enabled: true, sessionId }`

#### Scenario: Text submit submits intent
- **WHEN** `handleTextSubmit` is called with target, original text, and new text
- **THEN** `api.submitIntent` is called with type `edit-text`, the target, and `{ from: originalText, to: newText }`

#### Scenario: Wand trigger creates session + submits intent
- **WHEN** `handleWandTrigger` is called with a wand payload
- **THEN** `api.createSession` is called with type `wand`, the instruction, scope, and element context (including vision flag)
- **THEN** `api.submitIntent` is called with type `wand`, the instruction, target, and sessionId

#### Scenario: Place trigger creates session + submits intent
- **WHEN** `handlePlaceTrigger` is called with a place payload
- **THEN** `api.createSession` is called with type `place`, the instruction, scope, and element context (including placementMode and selectedComponent)
- **THEN** `api.submitIntent` is called with type `place`, the instruction, target, and sessionId

### Requirement: Error resilience
All backend integration functions SHALL be wrapped in try/catch. If the backend is unreachable (network error), the function SHALL fail silently — no error propagation to the UI, no thrown exceptions.

#### Scenario: Backend unreachable on comment submit
- **WHEN** the backend returns a network error during `handleCommentSubmit`
- **THEN** the error is caught and swallowed
- **THEN** no crash or error message is shown to the user

### Requirement: Toolbar UI stays decoupled
The toolbar (`Tool.tsx`) SHALL NOT import `api` directly. It SHALL import and call functions from the backend integration module. The toolbar's responsibility is limited to:
- Rendering tool buttons
- Managing active tool mode state
- Broadcasting mode changes via `EVT_TOOL_MODE`

#### Scenario: Toolbar uses backend module
- **WHEN** `Tool.tsx` receives an `EVT_COMMENT_SUBMIT` event
- **THEN** it calls `handleCommentSubmit` from the backend module
- **THEN** it does NOT call `api.createSession` or `api.submitIntent` directly

### Requirement: Unit tests for backend module
The `toolBackend` module SHALL have unit tests covering all handler functions (`handleCommentSubmit`, `handleTextSubmit`, `handleWandTrigger`, `handlePlaceTrigger`), with mocked `api` dependency, and an error-resilience test verifying silent failure on network error.

#### Scenario: All handlers have valid mocks
- **WHEN** `handleCommentSubmit` is invoked with a mocked `api` that resolves successfully
- **THEN** the test asserts `api.createSession` was called with the correct parameters
- **THEN** the test asserts `api.submitIntent` was called with the correct parameters

#### Scenario: Error resilience test
- **WHEN** a handler is invoked and `api.createSession` throws a network error
- **THEN** the function does not throw
- **THEN** no unhandled promise rejection is produced

### Requirement: Orchestrator integration testing
The orchestrator SHALL have an integration test that registers mock tools and verifies correct event delegation. The test SHALL:
- Create a mock tool with known `onClick` behavior
- Register it in the tool registry
- Simulate a click event on the canvas
- Assert that the mock tool's `onClick` was called with the correct event and context
- Verify that non-active tools did not receive the event

#### Scenario: Orchestrator delegates click to active tool only
- **WHEN** two mock tools are registered (toolA and toolB)
- **WHEN** the orchestrator activates toolA
- **WHEN** a click event is simulated on the canvas
- **THEN** toolA's `onClick` is invoked
- **THEN** toolB's `onClick` is NOT invoked
