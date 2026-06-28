## ADDED Requirements

### Requirement: ChatSidebar SSE parser handles question events

The `ChatSidebar.tsx` SSE event parser SHALL be extended to handle `type: "question"` events. On receiving a question event:

1. Parse the `questions` array from the event payload
2. Store the questions in a `pendingQuestions` state variable
3. Render a `QuestionCard` component inline in the message list (between the last text message and the typing indicator)
4. Display "The AI is waiting for your answer..." label above the question card
5. Show the question card in `interactive` state

#### Scenario: Question event received during streaming
- **WHEN** the SSE parser receives `data: {"type":"question","questions":[...]}`
- **THEN** ChatSidebar SHALL append a question block to the message stream
- **AND** render a QuestionCard with `state: "interactive"`
- **AND** show "The AI is waiting for your answer..." above the card
- **AND** NOT append any text to the assistant message (the agent is suspended)

#### Scenario: Text events resume after question answered
- **WHEN** the user submits an answer and the agent resumes
- **THEN** subsequent `type: "text"` events SHALL be appended to the message list normally
- **AND** the QuestionCard SHALL transition to `answered` state
- **AND** the "waiting" label SHALL be replaced with "Answered"

### Requirement: QuestionCard submit handler

When the user clicks Submit on a QuestionCard:

1. QuestionCard `onSubmit` fires with the answers object
2. QuestionCard transitions to `pending` state (spinner on submit, options locked)
3. ChatSidebar sends `POST /api/chat/answer` with `sessionId` and `answers`
4. On success (200), QuestionCard transitions to `answered` state
5. On error (non-200), QuestionCard returns to `interactive` state with error toast

#### Scenario: Successful answer submission
- **WHEN** user clicks Submit
- **THEN** QuestionCard SHALL transition to `pending` state
- **AND** `POST /api/chat/answer` SHALL be called
- **AND** on 200 response, QuestionCard SHALL transition to `answered` state
- **AND** display the selected answers as a read-only summary

#### Scenario: Failed answer submission
- **WHEN** `POST /api/chat/answer` returns a non-200 response
- **THEN** QuestionCard SHALL return to `interactive` state
- **AND** a toast notification SHALL display "Failed to submit answer. Please try again."

### Requirement: Question timeout handling in ChatSidebar

When a `question_timeout` SSE event is received:

1. The QuestionCard SHALL transition to `expired` state
2. The "The AI is waiting..." label SHALL be replaced with "⏱ Question expired"
3. Subsequent text events resume normally

#### Scenario: Question times out in the UI
- **WHEN** `data: {"type":"question_timeout","sessionId":"..."}` is received
- **THEN** ChatSidebar SHALL set the question state to `expired`
- **AND** the QuestionCard SHALL transition to `expired` state
- **AND** text events resume normally from the agent

### Requirement: Question cancellation (Cancel button)

When the user clicks Cancel on a QuestionCard:

1. `POST /api/chat/answer/cancel` is called with `sessionId`
2. The backend sends a cancellation signal to the agent
3. The QuestionCard is removed from the message list
4. The agent continues (without the answer)
5. Text events resume normally

#### Scenario: User cancels a question
- **WHEN** user clicks Cancel on a QuestionCard
- **THEN** `POST /api/chat/answer/cancel` SHALL be called
- **AND** the QuestionCard SHALL be removed from the message list
- **AND** streamed text events SHALL resume
- **AND** an info message "Question skipped" SHALL appear in the message list

### Requirement: Question inline in message list ordering

The QuestionCard SHALL be positioned in the message list at the point where the question was asked — after all preceding assistant text but before subsequent assistant text. The ordering is:

1. Assistant message text (pre-question)
2. QuestionCard (interactive / answered / expired)
3. Assistant message text (post-question, after agent resumes)

This ensures the conversation timeline is preserved.

#### Scenario: Question appears between text chunks
- **WHEN** the assistant has output before asking a question, then outputs more after receiving the answer
- **THEN** the message list SHALL show: [assistant text] → [QuestionCard] → [assistant text]
- **AND** the timeline SHALL accurately reflect the conversation order

### Requirement: ChatSidebar question state persistence across re-renders

The `pendingQuestions` state SHALL be stored at the ChatSidebar level (not in a child component) so it persists across re-renders during streaming.

#### Scenario: Question state survives stream updates
- **WHEN** new text events arrive while a question card is displayed
- **THEN** the question state SHALL NOT be lost
- **AND** the QuestionCard SHALL remain in its current state
- **AND** new text events SHALL be appended after the question card
