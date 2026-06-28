---
id: design
---

## Context

The addon has a working chat sidebar (`ChatSidebar.tsx`), comment tool, and live-edit-text tool in the preview iframe. The chat sidebar is mounted as a portal overlay and streams AI responses via SSE from `/api/chat/stream`. What's missing is context: the AI receives no information about what the user is viewing, and there's no way for the user to visually reference an element into the conversation.

The backend has session management (`/api/sessions`, `/api/sessions/:id/conversation`) but conversations are disconnected from the design surface.

## Goals / Non-Goals

**Goals:**
- Enrich every chat message with automatic context: viewport, component, story ID, file paths, DS tokens, render snapshot
- Build a visual selection tool in the preview: click element → it's highlighted and referenced in chat with its tag, text, styles, and component metadata
- Support per-story conversations (auto-scoped to current story) and global conversations
- Build a Storybook decorator/harness that wraps components with AI-accessible metadata (props, tokens, error boundary, render state)
- Add a design-surface API endpoint for the AI to query composition tree, token usage, a11y state
- Keep the current chat sidebar layout — enhance it with richer features

**Non-Goals:**
- Not replacing the existing CLI/MCP tools
- Not rebuilding the addon panel layout — the current chat sidebar stays
- Not implementing real-time multi-user collaboration
- Not building a full design tool (no canvas editing, layer management)

## Decisions

### 1. Selection tool: Extend the existing element picker
The existing element picker (comment/copy/text tools in `preview.tsx`) already handles click detection, element highlighting, and channel communication. We add a new "reference" mode: clicking an element sends its tag, text, computed styles, CSS selector, and component name to the chat as a "referenced element" message. The element stays highlighted with a persistent pin.

**Why:** Reuses existing infrastructure (channel events, overlay rendering, element path resolution). No new DOM traversal code needed.

**Alternatives considered:** A separate selection overlay library. Rejected — the existing tool overlay already handles this.

### 2. Context enrichment: Preview iframe → channel → chat
The story context (component, story, viewport, file paths) is already available in the preview iframe decorator. We extend the channel protocol with `EVT_VIEW_CONTEXT` that fires on story change and viewport resize, carrying the full context object to the manager. The chat then includes this context when sending messages to the backend.

**Why:** The preview iframe has direct DOM access. The channel bridges iframe → manager efficiently.

### 3. Component harness: Storybook decorator
A new `withComponentContext` decorator wraps each story's rendered component with:
- A `data-emdesign-component` attribute on the root element
- An `ErrorBoundary` that catches render errors
- A hidden `<script type="application/emdesign+json">` with metadata (props, tokens, file path)
- A post-render hook that captures the semantic DOM tree

**Why:** Makes every component self-describing without manual annotation. Zero migration cost.

### 4. Conversation scoping: Two-tier sidebar with Project + Story sections
The chat sidebar SHALL display two sections:
- **Project** — global conversations. Always visible. Not tied to any story.
- **Story** — conversations scoped to the currently open story. When the user navigates to a different story, the entire section swaps to show that story's conversations. The section header reads "Story: {component name}".

Comments submitted via the comment tool automatically create a new story-scoped conversation with the comment as the first message and the element metadata (selector, tag, text, bounding box) as context. This makes every piece of feedback immediately actionable by the AI — it knows exactly which element the user is talking about.

Conversations display an origin badge: 💬 for manual chat, 💭 for comments.

**Why:** This mirrors how project-based AI IDEs work (e.g., Cursor has project-level chat + file-scoped conversations). Comments become the starting point of an AI edit flow rather than isolated feedback items.

**Alternatives considered:** Flat conversation list with tags. Rejected because sections provide clearer organization and automatic scoping reduces cognitive load.

### 5. Design-surface API: Cached endpoint
`GET /api/surface` returns the current design surface state (component, story, viewport, composition tree, token usage, a11y violations) with a 5-second cache. The AI calls this to understand the current view without relying on potentially stale chat context.

**Why:** Gives the AI a programmatic snapshot of the design surface.

## Risks / Trade-offs

- **[Performance] Context enrichment adds channel traffic**: Mitigation: debounce viewport resize to 200ms, batch context into a single event on story change.
- **[Complexity] Component harness adds render overhead**: Mitigation: lightweight decorator — no extra re-renders, no network calls. Metadata is a static JSON script tag.
- **[UX] Selection tool conflicts with comment tool**: Mitigation: separate mode. User toggles between "reference" and "comment" modes in the toolbar.
