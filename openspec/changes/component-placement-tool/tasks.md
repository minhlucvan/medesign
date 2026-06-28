## 1. Channel Events & Types

- [ ] 1.1 Add `ToolMode 'place'` to `packages/addon/src/channel.ts` alongside existing modes
- [ ] 1.2 Define `EVT_PLACE_TRIGGER` event with `PlaceTriggerPayload` (component, tag, selector, text, rect, storyId, placementMode: 'before'|'after'|'into'|'replace', selectedComponent)
- [ ] 1.3 Define `EVT_PLACE_RESULT` event with `PlaceResultPayload` (sessionId, status, componentName, file, location, gate)
- [ ] 1.4 Add `'place'` to `IntentType` in `packages/addon/src/constants.ts`
- [ ] 1.5 Add `PLACE_PANEL_ID` constant for the placement results panel

## 2. Place Tool — Preview & Toolbar

- [ ] 2.1 Add "Place" toolbar button to `packages/addon/src/Tool.tsx` — SVG icon (plus/crosshair), title, click handler, mode toggle
- [ ] 2.2 Add "place" mode handler to `packages/addon/src/preview.tsx` — cursor change, element click → emit `EVT_PLACE_TRIGGER` with element context
- [ ] 2.3 Add `EVT_PLACE_TRIGGER` handler in `Tool.tsx` — receives trigger, creates session, submits intent type `place`
- [ ] 2.4 Add hint text for "place" mode in `HINTS` record
- [ ] 2.5 Add visual overlay for "place" mode (green highlight with + badge)

## 3. Component Palette Popover

- [ ] 3.1 Create `packages/addon/src/panels/ComponentPalette.tsx` — searchable list of available components, grouped by category (primitives, generated, captured)
- [ ] 3.2 Fetch component list via API or `emdesign explore components --json`
- [ ] 3.3 Add 4 placement mode toggle buttons: Before, After, Into, Replace
- [ ] 3.4 On component selection: emit `EVT_PLACE_TRIGGER` with selected component + placement mode + target element context
- [ ] 3.5 Add keyboard navigation: type to search, Enter to select, Esc to dismiss

## 4. Placement Workflow

- [ ] 4.1 Create `apps/workspace/templates/claude/workflows/placement-workflow.js` with 5-stage pipeline: Resolve → Generate → Inject → Verify → Report
- [ ] 4.2 Implement Resolve stage: check if selected component exists in workspace (via `discover_components` or graph query)
- [ ] 4.3 Implement Generate stage: if component doesn't exist, generate it via `component-workflow` with the user's intent
- [ ] 4.4 Implement Inject stage: read the target story CSF file, find the JSX template, insert the new component JSX at the correct position (before/after/into/replace relative to target selector)
- [ ] 4.5 Implement Verify stage: run `emdesign doctor lint --gate` + `emdesign doctor visual` on the modified story; git-rollback on failure
- [ ] 4.6 Implement Report stage: return result with component name, file, insertion location, gate status

## 5. Story Source Injector

- [ ] 5.1 Create `packages/backend/src/placement/injector.ts` with `injectComponent(params): InjectionResult`
- [ ] 5.2 Implement CSFv3 args-based injection: parse the story's `args` block, find the target element by tag/selector in the JSX template, insert new component JSX at the correct position
- [ ] 5.3 Implement fallback injection for render-function stories: locate the target element in the JSX returned by the render function
- [ ] 5.4 Support 4 insertion modes: before (insert before target sibling), after (insert after target sibling), into (insert as last child of target), replace (swap target with new)
- [ ] 5.5 Format inserted JSX consistently with the surrounding code (same indentation, line breaks)
- [ ] 5.6 Return `InjectionResult` with: file, line, new code, success/error

## 6. Entry Workflow Registration

- [ ] 6.1 Register `placement-workflow` in `entry-workflow.js`: route type `place` to element-layer `placement-workflow`
- [ ] 6.2 Route combined intents "place component", "add component", "insert component" to `placement-workflow`
- [ ] 6.3 Pass `placementMode` and `targetComponent` from payload through to workflow args
