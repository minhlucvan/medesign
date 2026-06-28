# Component Placement Tool — Handoff

## Context

A new "Place" tool mode in the Storybook addon that lets users click an element in the preview, pick a component from a palette, and have it inserted into the story source at that location.

## Design Decisions

- **ToolMode "place"** — 6th mode alongside comment/copy/reference/text/wand. Reuses all overlay infrastructure.
- **Component palette** — Inline popover near the clicked element (like comment popover). Searchable, categorized list of available components.
- **4 insertion modes**: before, after, into, replace
- **Workflow-driven** — placement-workflow.js orchestrates resolve → generate → inject → verify → report
- **AST-aware injection** — story source injector uses ts-morph for safe CSFv3 injection
- **Guided only** — user always picks component + placement mode

## Units

1. **01-channel-events** — Channel types + constants (no production logic)
2. **02-place-tool-ui** — Preview overlay, toolbar button, palette popover (addon)
3. **03-placement-workflow** — Backend injector + workflow + entry-workflow routing

## Dependencies

- Depends on existing `preview.tsx` overlay infrastructure
- Uses existing `component-workflow` for component generation
- Uses existing `entry-workflow.js` routing pattern
