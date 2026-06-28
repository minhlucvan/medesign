## Context

The emdesign chat system currently works as a simple request-response text stream. The user types a message → `POST /api/chat/stream` → backend spawns a raw `claude` CLI process with `--permission-mode bypassPermissions` → stdout stream-json is parsed for `assistant` message text → SSE events stream `type: "text"` to the browser → ChatSidebar renders text via `MessageList` / `ChatMessage`.

There is no support for bidirectional interactive patterns. When the AI needs to ask a clarifying question (e.g., "Which approach should I use?"), it can't — it just guesses and continues. The Claude Agent SDK's `AskUserQuestion` tool provides this capability, but it's not used because:

1. The backend spawns a raw `claude` CLI process, not the SDK
2. `--permission-mode bypassPermissions` suppresses all interactive prompts
3. The SSE parser only handles `type: "text"` events
4. The chat UI has no component for rendering structured questions
5. There is no endpoint for submitting answers back to a running agent

The `@emdesign/chat-ui` package provides the right foundation (MessageList, ChatMessage, tool invocation rendering) but lacks a `QuestionCard` component.

## Goals / Non-Goals

**Goals:**
- Add `QuestionCard` component to `@emdesign/chat-ui` that renders single/multi-select questions with labels, descriptions, optional previews, and a gated submit button
- Support interactive (pending) and read-only (answered) states
- Add `question` SSE event type to `/api/chat/stream` — backend emits when AI calls AskUserQuestion
- Add `POST /api/chat/answer` endpoint — backend forwards answer to the suspended agent
- Implement agent suspension/resume lifecycle for unanswered questions (with timeout)
- Wire ChatSidebar to detect question events, render QuestionCard, handle submit/cancel
- Keep the existing text-only flow fully backward compatible

**Non-Goals:**
- Not replacing the existing chat text flow — questions are an additive capability
- Not implementing multi-turn question flows (nested/conditional questions) in this phase — each question is independent
- Not changing the per-session management or session persistence — questions are ephemeral within a stream
- Not supporting AskUserQuestion in subagents (the Agent SDK limitation) — only root agent questions
- Not switching to the Claude Agent SDK as a dependency — using manual stream-json interception (Approach C from research) to minimize dependency changes

## Decisions

### 1. Manual stream-json interception over Claude Agent SDK dependency

The backend will intercept `tool_use` events from the raw `claude` CLI's stream-json output rather than integrating the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`).

**Why:** The SDK would require replacing the existing AgentRunner process spawn with a programmatic SDK call — a significant refactor touching `packages/session/`, `packages/backend/`, and the HTTP bridge. Manual stream-json parsing is simpler: we already parse stream-json for `type: 'assistant'` events; we just need to also detect `type: 'assistant'` messages containing `tool_use` blocks for `AskUserQuestion`, pause the agent, and inject `tool_result` when the answer arrives.

**Alternatives considered:** Claude Agent SDK (Approach A) — cleaner long-term but a heavier dependency change. Community MCP sidecar (Approach B) — works immediately but opens a separate browser tab, not embedded. Manual interception (Approach C) — best fit for incremental, non-breaking implementation.

### 2. AskUserQuestion detected at the stream-json level, not the SSE level

The stream-json parser in the backend (`http.ts` SSE handler) will detect `AskUserQuestion` tool_use blocks and convert them to `question` SSE events. The raw stream-json event is the most reliable interception point — it's where tool_use blocks are already serialized.

**Why:** The current SSE handler at `http.ts` line ~598 is the right place to intercept because it already reads from the Claude CLI's stdout and has the full event context. Adding detection here means no changes to `AgentRunner.ts`.

### 3. Question state managed as an in-memory pending promise per session

When a question fires, the backend stores a resolver function keyed by session ID in a `Map<string, (answer: QuestionAnswer) => void>`. The stream handler `await`s this promise, which holds the SSE connection open. When the answer arrives via `POST /api/chat/answer`, the resolver fires, and the handler injects the tool_result into the agent's stdin and continues streaming.

**Why:** Simple, no persistence needed (questions are ephemeral within a single stream), no new database or state store. The `Map` is naturally cleaned up when the stream ends or the session is cancelled.

**Timeouts:** A 120-second timeout fires if no answer arrives. On timeout, the question is "cancelled" — the agent receives a cancellation signal and continues without the answer.

### 4. QuestionCard as a controlled component in @emdesign/chat-ui

The `QuestionCard` component receives questions as props and calls an `onSubmit(answers)` callback. It does NOT manage network state — the parent (ChatSidebar) handles submission. This keeps it as a reusable, testable UI primitive consistent with the rest of `@emdesign/chat-ui` (which follows the same controlled pattern).

**Why:** All chat-ui components are stateless/controlled (MessageList, ChatMessage, MessageInput). QuestionCard follows the same pattern, making it consistent and testable.

### 5. Answer submission via POST, not a second SSE connection

Answers are submitted via a simple `POST /api/chat/answer` with `{ sessionId, answers }`. The endpoint looks up the pending promise for that session and resolves it.

**Why:** No need for bidirectional SSE. The stream already has the SSE connection; answer submission is a one-shot POST. A second SSE connection just for answers would add complexity.

### 6. Backward compatibility: questions are optional additions

All changes are additive. The existing text-only flow continues working identically. If the backend cannot detect AskUserQuestion (e.g., older Claude CLI version), it gracefully skips and continues. The SSE parser falls through to existing text handling for non-question events.

**Why:** Zero regression risk. The chat sidebar continues working for all existing scenarios.

## Risks / Trade-offs

- **[Stream-json format] The tool_use/tool_result format in stream-json is not publicly documented**: Mitigation: we already parse stream-json for `type: 'assistant'` → `content[].type: 'text'`. The same event structure has `content[].type: 'tool_use'` blocks. We'll test with the actual Claude CLI output to confirm the framing. If the format changes, questions silently fall back to text-only flow.
- **[Agent_pause] Holding the agent process in a suspended state may cause timeout**: Mitigation: 120-second question timeout. If the user doesn't answer, the agent resumes without the answer (or the session is cancelled). The UI shows a "Question expired" state.
- **[User_experience] Questions appear inline mid-stream, which may be confusing**: Mitigation: The QuestionCard is visually distinct (bordered card with shaded background). A "The AI is waiting for your answer..." label appears above it. After answering, a confirmation summary replaces the interactive form.
- **[Concurrent_sessions] Multiple SSE streams per session could conflict**: Mitigation: the backend currently maintains one SSE stream per session. The pending question Map is keyed by session ID. If a second stream starts for the same session, the previous pending promise is rejected.
- **[Dependency] Depends on the Claude CLI stream-json format for tool_use injection**: Mitigation: if the format changes or tool_result injection isn't supported, the fallback is to send the answer as a follow-up text message in the chat, preserving functionality without the structured question UX.

## Migration Plan

1. **Phase 1 — QuestionCard component**: Add the React component to `@emdesign/chat-ui`. No backend changes. Component is exported but unused until Phase 2. (Safe to ship independently.)
2. **Phase 2 — Backend question lifecycle**: Add question detection to the SSE handler, pending promise Map, answer endpoint, and tool_result injection. Keep the `--permission-mode bypassPermissions` flag initially — test with a custom flag that enables interactive mode.
3. **Phase 3 — ChatSidebar integration**: Wire QuestionCard into ChatSidebar SSE event handling. Handle question submit/cancel/timeout. Display answered state.

## Open Questions

- **Claude CLI version**: Does the current `claude` CLI version support `--permission-mode interactive` (the flag needed for AskUserQuestion to fire)? What is the minimum version?
- **Stdout format for tool_result injection**: Can we inject a tool_result message via stdin in the stream-json protocol, or does it require a full user-turn message? This needs validation with the actual CLI.
- **`--output-format stream-json`** : Are tool_use events emitted in stream-json mode, or only in the default JSON mode? Need to verify.
