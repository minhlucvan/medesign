---
id: proposal
---

## Why

The emdesign chat sidebar (ChatSidebar) currently only supports free-text input — the user types a message, the AI responds. But the Claude Agent SDK's `AskUserQuestion` tool allows the AI to ask structured multi-choice questions mid-conversation (e.g., "Which approach should I use?", "How should I handle this edge case?"). Integrating this capability into the chat UI makes the AI-to-human feedback loop interactive and structured, replacing ambiguous free-form back-and-forth with clear, selectable choices. This dramatically improves the quality of design decisions and reduces the number of turns needed to resolve ambiguity.

## What Changes

- **New `QuestionCard` component in `@emdesign/chat-ui`**: Renders structured multiple-choice questions (single-select radio buttons or multi-select checkboxes) inline in the chat message stream. Displays question text, header, option labels + descriptions, and optional preview content. Submit button enabled only when all questions are answered.
- **New SSE event type `question`**: The backend `/api/chat/stream` emits `data: {"type":"question","questions":[...]}` when the AI calls AskUserQuestion, pausing the agent. The chat UI renders the QuestionCard. On submit, the answer is posted back via `POST /api/chat/answer`.
- **Backend question lifecycle management**: The agent process is suspended when AskUserQuestion fires, a pending promise holds the session, and the answer resolves it — agent resumes. Timeout/cancel support for abandoned questions.
- **ChatSidebar integration**: SSE parser extended to handle `type: "question"` events, render QuestionCard inline, wire submit/cancel handlers, show answer confirmation after submission.
- **Optional MCP sidecar alternative**: `ask-user-question-plus` or `ask-me-mcp` configured as an MCP server in `.claude/settings.json` for quick prototype — opens a separate browser tab for questions.

## Capabilities

### New Capabilities
- `question-card-component`: A reusable React component in `@emdesign/chat-ui` that renders structured questions (single/multi-select options) with labels, descriptions, optional previews, and a gated submit button. Supports read-only (answered) and interactive (pending) states.
- `backend-question-lifecycle`: Backend support in `/api/chat/stream` and `/api/chat/answer` for suspending the agent on AskUserQuestion, forwarding questions via SSE, collecting answers, and resuming. Includes timeout, cancellation, and per-session pending-state management.
- `chat-sidebar-question-integration`: Integration in ChatSidebar (`packages/addon/src/sessions/ChatSidebar.tsx`) to detect `question` SSE events, render QuestionCard components, handle answer submission, and display answered state.

### Modified Capabilities
- (none — no existing chat specs to modify)

## Impact

- **`packages/chat-ui/`**: New `src/question-card.tsx` component with QuestionCard, QuestionOption, and related types. New export in `package.json` and `src/index.ts`.
- **`packages/addon/`**: ChatSidebar updated to handle question events. SSE parser extended. New `POST /api/chat/answer` endpoint handling.
- **`packages/backend/`**: SSE stream updated to emit `question` events. `/api/chat/stream` updated to use Claude Agent SDK's `canUseTool` callback (or manual stream-json interception) for AskUserQuestion. Pending question state management. Timeout/cancel logic.
- **`packages/session/`**: AgentRunner/AgentManager may need updates for question lifecycle if using SDK approach.
- **`.claude/settings.json`**: Optional MCP server configuration for sidecar approach.
