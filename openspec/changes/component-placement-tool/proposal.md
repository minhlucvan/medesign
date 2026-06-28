## Why

The current Storybook addon has a comment tool that lets users point at an element and write a change request. But there's no tool for the opposite flow: **adding a new component into the story at a specific location**. Users who want to compose a page or add a section must describe it in chat, wait for the AI, then iterate.

A **component placement tool** closes this gap: the user clicks/taps a location in the preview, picks a component type from a palette, and the system generates + places the component at that spot — all without leaving the Storybook canvas.

## What Changes

- **New "Place" tool mode** in the preview toolbar (alongside comment/copy/reference/text/wand). When active, clicking an element shows a component palette popover instead of a comment popover.
- **Component palette popover** — a searchable list of available components (DS primitives, generated components, captured components) grouped by category. User picks one, specifies optional variants/props.
- **Placement intent + workflow** — the tool emits a new `EVT_PLACE_TRIGGER` channel event with the target location (selector, tag, position: before/after/inside). The agent receives it, generates the component, integrates it into the story source, and re-verifies.
- **Integration modes**: "before" (insert above the target), "after" (insert below), "inside" (insert as child), "replace" (swap the target).
- **Auto-inject** — the generated component code is injected into the story's source file, positioned at the correct location relative to the target element. The story auto-refreshes via HMR.

## Capabilities

### New Capabilities
- `component-placement-tool`: A new preview iframe tool mode ("place") that, on element click, opens a component palette popover and emits a placement intent on selection.
- `component-palette`: A searchable, categorized list of available components fetched from the workspace (DS primitives + generated + captured).
- `placement-workflow`: A workflow that receives the placement intent, generates the component if needed, injects it into the story source at the target location, and re-verifies the story renders correctly.
- `story-source-injector`: A utility that reads the story CSF file, finds the JSX template, and inserts the new component at the correct position relative to a CSS selector/tag.

### Modified Capabilities
- `entry-workflow.js` — new routing for `place` intent type → `placement-workflow`
- `preview.tsx` — new "place" tool mode alongside existing tools
- `channel.ts` — new `EVT_PLACE_TRIGGER` event + `EVT_PLACE_RESULT` event
- `Tool.tsx` — new "Place" toolbar button

## Impact

- **`packages/addon/src/channel.ts`**: New `ToolMode 'place'`, `EVT_PLACE_TRIGGER`, `EVT_PLACE_RESULT` with placement payloads
- **`packages/addon/src/preview.tsx`**: New "place" mode handler — click → palette popover → emit trigger
- **`packages/addon/src/Tool.tsx`**: New "Place" toolbar button with placement icon
- **`packages/addon/src/panels/`**: New `ComponentPalette.tsx` — the component picker popover/panel
- **`packages/backend/src/`**: New story source injector module
- **`apps/workspace/templates/claude/workflows/`**: New `placement-workflow.js`
- **`apps/workspace/templates/claude/commands/mds/`**: Optional `/mds:place` CLI command
