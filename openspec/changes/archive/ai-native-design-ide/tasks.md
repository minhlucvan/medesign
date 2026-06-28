---
id: tasks
---

## 1. Component Context Harness

- [ ] 1.1 Create `withComponentContext` decorator in `packages/addon/src/harness/` with ErrorBoundary, metadata script tag, and `data-emdesign-component` attribute
- [ ] 1.2 Define `ComponentContext` type and metadata JSON schema in `packages/dsr/`
- [ ] 1.3 Add `EVT_VIEW_CONTEXT` and `EVT_COMPONENT_ERROR` channel event types in `packages/addon/src/harness/channel.ts`
- [ ] 1.4 Export `withComponentContext` from addon package.json exports as `"./harness": "./src/harness/index.tsx"`
- [ ] 1.5 Add `withComponentContext` decorator to workspace template `.storybook/preview.tsx`
- [ ] 1.6 Add `withComponentContext` to blank example's `.storybook/preview.tsx`

## 2. Selection Tool

- [ ] 2.1 Add "reference" mode to the existing element picker overlay in `packages/addon/src/preview.tsx` (toggle alongside comment/copy/text modes)
- [ ] 2.2 Define `EVT_ELEMENT_SELECTED` channel event with payload: tag, text, selector, component, rect, computedStyles
- [ ] 2.3 On element click in reference mode, emit event + render persistent highlight pin
- [ ] 2.4 Listen for `EVT_ELEMENT_SELECTED` in ChatSidebar and display selection card in message list
- [ ] 2.5 Clear selection on Escape click, story navigation, or clicking the same element again

## 3. Rich Conversation Context

- [ ] 3.1 Emit `EVT_VIEW_CONTEXT` from the preview iframe on story change + debounced viewport resize
- [ ] 3.2 Listen for `EVT_VIEW_CONTEXT` in ChatSidebar — store as current context state
- [ ] 3.3 Display context chip above chat input: "Viewing: Button @ 1280×720"
- [ ] 3.4 Append context (component, story, viewport, tokens) as system message metadata when sending chat requests

## 4. Conversation Scoping (Project + Story)

- [ ] 4.1 Add `scope` parameter (`{ type: "story"|"global", key?: string, origin?: "chat"|"comment" }`) to `POST /api/sessions`
- [ ] 4.2 Split chat sidebar into "Project" and "Story: {component}" sections with clear headers
- [ ] 4.3 Auto-switch Story section content on story navigation (from EVT_VIEW_CONTEXT)
- [ ] 4.4 Wire comment tool submission to create a new story-scoped conversation with element metadata as context
- [ ] 4.5 Display origin badge (💬 chat, 💭 comment) on each conversation thread
- [ ] 4.6 Persist and restore scope across page reloads

## 5. Design Surface API

- [ ] 5.1 Create `GET /api/surface` endpoint returning active component, story, design system, viewport, composition tree, token usage, lint findings
- [ ] 5.2 Add 5-second in-memory cache to `/api/surface`
- [ ] 5.3 Trigger pre-computation on EVT_VIEW_CONTEXT (piggyback on charters eval)
