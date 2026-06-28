## 1. QuestionCard Component (chat-ui)

- [x] 1.1 Create `packages/chat-ui/src/question-card.tsx` with `QuestionCard` React component — renders 1–4 questions with radio buttons (single-select) or checkboxes (multi-select), option labels + descriptions, gated submit button
- [x] 1.2 Define TypeScript interfaces: `QuestionCardProps`, `Question`, `QuestionOption` in a new `packages/chat-ui/src/question-card.tsx` or separate types file
- [x] 1.3 Implement 4 visual states: `interactive` (options selectable, submit enabled), `pending` (spinner on submit, options locked), `answered` (read-only summary with checkmark), `expired` (dimmed with timeout message)
- [x] 1.4 Implement `onSubmit(answers: Record<string, string | string[]>)` callback — fires when submit is clicked, passes answers mapping question text → selected label(s)
- [x] 1.5 Implement `onCancel` callback — fires when Cancel is clicked, dismisses the question card
- [x] 1.6 Implement submit gating: submit button disabled until ALL questions have at least one selected option; show "Required" indicator on unanswered questions
- [x] 1.7 Style QuestionCard consistently with chat-ui theme (shadcn CSS variables — `--muted`, `--primary`, `--foreground`, `--radius`, etc.)
- [x] 1.8 Add `QuestionCard` to `packages/chat-ui/src/index.ts` exports
- [x] 1.9 Verify build: `cd packages/chat-ui && npx tsc --noEmit`

## 2. Backend Question Lifecycle

- [x] 2.1 Add `--permission-mode interactive` (or remove `bypassPermissions`) conditionally in `packages/backend/src/harness/claude.ts` `buildArgs()` — enable AskUserQuestion to fire
- [ ] 2.2 **MANUAL**: Verify AskUserQuestion appears in stream-json output: spawn a test Claude process with interactive mode and capture a tool_use block for AskUserQuestion
- [x] 2.3 Add AskUserQuestion detection in `packages/backend/src/http.ts` SSE handler: when parsing stream-json `type: 'assistant'` events, detect `content[].type === 'tool_use'` with `name === 'AskUserQuestion'` and extract `input.questions`
- [x] 2.4 Implement pending question state map in `http.ts`: `Map<sessionId, { toolUseId, questions, resolve, reject, timeout, createdAt }>`
- [x] 2.5 Emit `data: {"type":"question","questions":[...]}` SSE event when question is detected — suspend text forwarding until answer received
- [x] 2.6 Add `POST /api/chat/answer` endpoint: accept `{ sessionId, answers }`, look up pending promise, resolve it, return 200/404/409
- [x] 2.7 Implement tool_result injection: when answer arrives, write `{"type":"tool_result","tool_use_id":"...","content":"..."}` JSON line to Claude CLI stdin with the answer
- [x] 2.8 Implement 120-second question timeout: reject pending promise, emit `question_timeout` SSE event, send cancellation signal to agent, resume text streaming
- [x] 2.9 Clean up pending question on stream close: reject promise with "Stream closed", remove from map, terminate agent process
- [x] 2.10 Add `POST /api/chat/answer/cancel` endpoint: accept `{ sessionId }`, send cancellation signal, remove question card, resume streaming
- [x] 2.11 Ensure backward compatibility: when `--permission-mode bypassPermissions` is active, no question handling, text-only flow unchanged

## 3. ChatSidebar Question Integration

- [ ] 3.1 Extend SSE parser in `packages/addon/src/sessions/ChatSidebar.tsx` to handle `type: "question"` events — parse questions array and store as `pendingQuestions` state
- [ ] 3.2 Import and render `QuestionCard` from `@emdesign/chat-ui` in ChatSidebar — positioned inline in the message list at the point where the question was asked
- [ ] 3.3 Display "The AI is waiting for your answer..." label above QuestionCard in interactive state
- [ ] 3.4 Wire QuestionCard `onSubmit` to `POST /api/chat/answer` — transition card to `pending` state during submission, `answered` on success, back to `interactive` on error
- [ ] 3.5 Wire QuestionCard `onCancel` to `POST /api/chat/answer/cancel` — remove card from message list, show "Question skipped" info message, resume text streaming
- [ ] 3.6 Handle `type: "question_timeout"` SSE event — transition QuestionCard to `expired` state, show "⏱ Question expired" label
- [ ] 3.7 Ensure correct message ordering: [pre-question text] → [QuestionCard] → [post-question text] — question state persists across subsequent text events
- [ ] 3.8 Reset question state on new stream start (new message submission) — clear any stale pendingQuestion state
