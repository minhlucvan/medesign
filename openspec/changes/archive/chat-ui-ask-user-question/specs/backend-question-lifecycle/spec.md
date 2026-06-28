## ADDED Requirements

### Requirement: SSE event type "question" for forwarding AskUserQuestion

The backend `/api/chat/stream` SHALL detect AskUserQuestion `tool_use` blocks in the Claude CLI stream-json output and emit an SSE event:

```
data: {"type":"question","questions":[{"question":"...","header":"...","options":[...],"multiSelect":false}]}
```

This event SHALL be emitted BEFORE the question is presented to the user — the agent SHALL be suspended until an answer is received.

#### Scenario: Tool_use for AskUserQuestion detected in stream
- **WHEN** the stream-json parser receives a `type: 'assistant'` event with `content[].type: 'tool_use'` where `tool_use.name === 'AskUserQuestion'`
- **THEN** the backend SHALL extract `tool_use.input.questions` as the question payload
- **AND** emit a `type: "question"` SSE event with the questions array
- **AND** suspend agent output processing (stop forwarding text events)
- **AND** store a pending promise keyed by `sessionId`

#### Scenario: Normal text events continue before question
- **WHEN** a tool_use event is NOT an AskUserQuestion call
- **THEN** the backend SHALL process it as a regular tool_use (no question handling)
- **AND** continue emitting `type: "text"` events normally

#### Scenario: No question handling when permissions are bypassed
- **WHEN** `--permission-mode bypassPermissions` is set
- **THEN** AskUserQuestion tool_use blocks will never appear in the stream
- **AND** no question SSE events SHALL be emitted
- **AND** the existing text-only flow SHALL continue unchanged

### Requirement: POST /api/chat/answer endpoint

A new endpoint `POST /api/chat/answer` SHALL accept answer submissions from the browser. Request body:

```json
{
  "sessionId": "em_ses_1234567890_0",
  "answers": {
    "Which color scheme?": "Light",
    "Which sections?": ["Introduction", "Conclusion"]
  }
}
```

The endpoint SHALL:
- Look up the pending question promise for the session
- If found, resolve the promise with the answers
- If not found (no pending question), return 404 with error message
- If the question has already been answered, return 409 Conflict

#### Scenario: Answer submitted for pending question
- **WHEN** `POST /api/chat/answer` receives valid body for a session with a pending question
- **THEN** the endpoint SHALL resolve the pending promise with the answers
- **AND** return 200 with `{ ok: true }`
- **AND** the SSE stream SHALL resume with tool_result injection

#### Scenario: Answer submitted with no pending question
- **WHEN** `POST /api/chat/answer` is called for a session with no pending question
- **THEN** the endpoint SHALL return 404 with `{ ok: false, error: "No pending question for this session" }`

#### Scenario: Duplicate answer submission
- **WHEN** `POST /api/chat/answer` is called twice for the same session
- **THEN** the second call SHALL return 409 with `{ ok: false, error: "Question already answered" }`

### Requirement: Tool_result injection into Claude CLI stdin

When an answer is received, the backend SHALL inject a `tool_result` message into the Claude CLI's stdin in the stream-json format:

```json
{"type": "tool_result", "tool_use_id": "<id from original tool_use>", "content": "{\"answers\": {\"Which color scheme?\": \"Light\"}}"}
```

The `tool_use_id` SHALL be captured from the original AskUserQuestion tool_use block and stored alongside the pending question promise.

#### Scenario: Tool_result injected after answer
- **WHEN** an answer resolves the pending promise
- **THEN** the backend SHALL write a `tool_result` JSON line to the Claude process stdin
- **AND** resume forwarding SSE text events from the agent's output
- **AND** the agent continues with the answer as its input

#### Scenario: Tool_result injection failure
- **WHEN** stdin write fails (process already exited, pipe broken)
- **THEN** the backend SHALL emit a `type: "error"` SSE event
- **AND** close the SSE stream gracefully

### Requirement: Question timeout

If no answer is received within 120 seconds, the question SHALL timeout:
- The pending promise SHALL be rejected with a timeout error
- A cancellation signal SHALL be sent to the Claude CLI stdin
- A `type: "question_timeout"` SSE event SHALL be emitted
- The SSE stream SHALL continue (agent receives cancellation, not the answer)

#### Scenario: Question times out
- **WHEN** 120 seconds elapse without an answer
- **THEN** the backend SHALL reject the pending promise
- **AND** emit `data: {"type": "question_timeout", "sessionId": "<id>"}`
- **AND** send a cancellation signal to the agent process
- **AND** the SSE stream continues with subsequent agent output

### Requirement: Pending question state management

The backend SHALL maintain an in-memory map of pending questions keyed by `sessionId`:

```typescript
const pendingQuestions = new Map<string, {
  toolUseId: string
  questions: Question[]
  resolve: (answer: QuestionAnswer) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
  createdAt: number
}>()
```

The map SHALL be cleaned up when:
- The answer is submitted (resolved)
- The timeout fires (rejected)
- The SSE stream closes or errors

#### Scenario: Pending question cleaned up on stream close
- **WHEN** the SSE stream closes (client disconnects, agent exits)
- **THEN** any pending question for that session SHALL be rejected with "Stream closed"
- **AND** removed from the pending questions map
- **AND** the agent process SHALL be terminated
