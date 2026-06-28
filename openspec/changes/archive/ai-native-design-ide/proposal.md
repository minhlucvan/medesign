---
name: "ai-native-design-ide"
---

## Why

The emdesign addon has a working chat sidebar, but the AI operates without context about what the user is seeing. Comments, live-edit, and chat are disconnected — the AI can't reference the component on screen, the user can't point at something and ask about it. To evolve from a collection of tools into an **AI-native design engineering IDE** — like Cursor for code — the chat needs rich, automatic context and a way for users to visually reference components into the conversation.

## What Changes

- **Richer context in existing chat**: The current chat sidebar stays as the primary interface. Every message is automatically enriched with viewport, component name, story ID, file paths, design system tokens, and render state.
- **Visual selection tool**: A new tool lets users click any element in the preview to "reference" it into the chat — the AI sees the element's tag, text, computed styles, selector, and component metadata, and the user can then ask about it or request changes.
- **Two-tier conversation sidebar**: The chat splits into **Project** (global conversations) and **Story** (conversations scoped to the current story). Navigating stories swaps the Story section. Comments automatically create story-scoped conversations with full element context.
- **Component wrapper harness**: A Storybook decorator wraps each component with a context provider that exposes token bindings, prop metadata, error boundaries, and render state to the AI — making every component self-describing.
- **Design surface awareness**: Backend endpoint exposing the current composition tree, token usage, and a11y state for the AI to query.

## Capabilities

### New Capabilities
- `component-selection-tool`: A visual tool in the preview that lets users click elements to reference them into the chat. The AI receives the element's tag, text, computed styles, CSS selector, and component name. Selected elements are highlighted persistently.
- `rich-conversation-context`: Every chat message is enriched with viewport, component, story, file paths, DS tokens, and render state. Context is loaded automatically based on what the user is viewing.
- `conversation-scoping`: Conversations can be global (project-wide) or scoped to a specific story/component. Scoped conversations auto-load that target's context.
- `component-context-harness`: A Storybook decorator/provider that wraps every component with metadata: prop types, token bindings, error boundary, render snapshot, and AI-accessible DOM description.
- `design-surface-api`: A backend endpoint that exposes the current composition tree, responsive breakpoints, token usage, and accessibility state for the AI to consume.

### Modified Capabilities
- *(none — no existing specs to modify)*

## Impact

- **`packages/addon/`**: New selection tool in preview iframe. Extended channel events for selection and context. Chat sidebar enhanced with context chip and selection display.
- **`packages/chat-ui/`**: Extended to display referenced elements and context metadata alongside messages.
- **`packages/backend/`**: New endpoints for conversation persistence, context resolution, component harness metadata, and design surface queries.
- **`packages/dsr/`**: New `ComponentContext` type for the harness provider. Extensions to `RenderSnapshot` for AI-consumable descriptions.
- **`apps/workspace/templates/`**: Template updated to include the component context harness decorator in new projects.
