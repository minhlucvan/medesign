# Chat Sidebar

The chat sidebar replaces Storybook's default story tree with a ChatGPT-style interface for browsing Claude Code sessions and chatting directly with Claude.

## Features

### Session Browsing
- Lists all Claude Code sessions from `~/.claude/` that belong to the current project workspace
- Sessions are filtered by project path — only conversations from this repo are shown
- Click any session to view its full conversation history
- Search/filter sessions by text
- Sessions are single-line with ellipsis for long titles

### Conversation View
- Messages rendered with full Markdown support via `react-markdown` + `remark-gfm`
- User messages (right-aligned, `--primary` background) and assistant messages (left-aligned, `--muted` background)
- Tool calls grouped into a single collapsible **"▶▶ N tools"** block per turn
- Click a tool group to expand and see individual tool calls
- Click a tool call to see its result (rendered as Markdown)
- Reasoning/thinking blocks shown as expandable "Thinking" sections
- Code blocks with compact dark styling
- Auto-scroll to bottom on new messages
- Thin scrollbar styling

### Live Chat
- Type a message in the input box at the bottom of the sidebar
- Files can be attached via the paperclip button (stored in `<workspace>/uploads/`)
- Messages are sent to `POST /api/chat/stream` which spawns Claude Code via AgentRunner
- Responses stream back in real-time via Server-Sent Events (SSE)
- Typing indicator (three bouncing dots) shown while waiting for response
- Stop button appears during generation

### Toggle
- A chat bubble button in Storybook's toolbar toggles between "story tree" and "chat sidebar" mode
- When chat mode is active, CSS hides the default story tree and the chat content appears in its place
- Click the button again to restore the story tree

## Architecture

```
┌─ Storybook Manager ─────────────────────────────┐
│  Toolbar: [💬 Chat toggle]                      │
│                                                  │
│  ┌─ Sidebar ──────────────────────────┐          │
│  │  Sessions list / Conversation      │          │
│  │  ┌────────────────────────────┐    │          │
│  │  │ MessageList + TypingInd.   │    │          │
│  │  └────────────────────────────┘    │          │
│  │  ┌────────────────────────────┐    │          │
│  │  │ MessageInput (textarea)    │    │          │
│  │  │ 📎 Send                    │    │          │
│  │  └────────────────────────────┘    │          │
│  └────────────────────────────────────┘          │
└──────────────────────────────────────────────────┘
         │ POST /api/chat/stream (SSE)
         ▼
┌─ Backend (Express :4321) ───────────────────────┐
│  AgentRunner.spawn() → claude CLI                │
│  stdout stream-json → SSE data: events           │
└──────────────────────────────────────────────────┘
```

## Key Components

| Package | File | Purpose |
|---------|------|---------|
| `@emdesign/addon` | `src/sessions/ChatSidebar.tsx` | Main sidebar component |
| `@emdesign/addon` | `src/Tool.tsx` | Chat toggle button in toolbar |
| `@emdesign/addon` | `src/manager.tsx` | Portal injection + CSS toggle |
| `@emdesign/chat-ui` | `src/chat.tsx` | Chat container + form |
| `@emdesign/chat-ui` | `src/chat-message.tsx` | User/assistant message bubbles |
| `@emdesign/chat-ui` | `src/message-list.tsx` | Message list |
| `@emdesign/chat-ui` | `src/message-input.tsx` | Textarea + send/stop buttons |
| `@emdesign/chat-ui` | `src/markdown-renderer.tsx` | Markdown with GFM |
| `@emdesign/chat-ui` | `src/typing-indicator.tsx` | Animated typing dots |
| `@emdesign/chat-ui` | `src/file-preview.tsx` | File attachment previews |
| `@emdesign/chat-ui` | `src/hooks/use-auto-scroll.ts` | Smart auto-scroll |
| `@emdesign/chat-ui` | `src/theme.ts` | shadcn CSS variables |
| `@emdesign/backend` | `src/http.ts` | SSE chat endpoint |
| `@emdesign/session` | `src/AgentRunner.ts` | Claude Code process spawner |

## API

### `POST /api/chat/stream`
Spawn Claude Code with a message and stream the response.

**Request:**
```json
{ "message": "your prompt here" }
```

**Response** (SSE stream):
```
data: {"type":"text","text":"Hello! "}
data: {"type":"text","text":"How can I help?"}
data: {"type":"done","exitCode":0}
```

### `POST /api/upload`
Upload a file for agent context.

**Request:** `multipart/form-data` with `file` field

**Response:**
```json
{ "ok": true, "path": "/path/to/uploads/file.ext", "originalName": "file.ext", "size": 1234 }
```

## Styling

All chat components use shadcn CSS variables injected at the `.emdesign-chat-root` scope:
- `--background`, `--foreground` — base colors
- `--primary`, `--primary-foreground` — user messages
- `--muted`, `--muted-foreground` — assistant messages, secondary text
- `--border`, `--input` — borders and inputs
- `--radius` — border radius

## Dependencies

- `@emdesign/chat-ui` (monorepo) — `react-markdown`, `remark-gfm`, `lucide-react`
- `@emdesign/session` (monorepo) — `AgentRunner` for spawning Claude Code
- `@emdesign/backend` — provides `POST /api/chat/stream` SSE endpoint
