## Context

The `@emdesign/addon` package is a Storybook addon that provides the live design loop — an overlay on the preview canvas, a toolbar in the Storybook UI, and a chat sidebar. It has grown organically:

- **`preview.tsx`** (447 lines) is the canvas overlay, handling mouse/keyboard events for 6 tool modes (comment, copy, reference, text-edit, wand, place) plus inline text editing, comment popup rendering, placement UI, pin rendering, placeholder overlays, toast notifications, and highlight visualization — all in one React component.
- **`Tool.tsx`** (179 lines) mixes toolbar button rendering with backend API orchestration — session creation, intent submission, and comment persistence are embedded directly in event handlers.
- **`ChatModeController.tsx`** (203 lines) bundles CSS injection (theme detection, style element management) with React portal mounting and chat toggle state.

The result: adding a new tool requires editing a switch statement, duplicating event-handler patterns, remembering to update hints, and touching multiple files. Debugging a single tool means wading through unrelated code paths. Testing is impractical because business logic is coupled to React component lifecycle and DOM event wiring.

## Goals / Non-Goals

**Goals:**
- Extract each tool into an isolated module with a shared interface — a `ToolDefinition` that declares its mode key, hint, event handlers, and overlay renderers
- Move DOM utility functions (`cssPath`, `buildTarget`, `describe`, computed-styles collection) into a shared `dom-utils` module
- Extract backend API orchestration from `Tool.tsx` into a dedicated service/hook — `useToolBackend` or `toolBackendService`
- Extract CSS injection and theme detection from `ChatModeController` into a `chatCssService`
- Make `ToolOverlay` a thin orchestrator that registers tools and delegates events
- Add unit tests for each extracted utility and tool module (pure functions first, then integration)
- Achieve < 100 lines per tool module and < 150 lines for the orchestrator

**Non-Goals:**
- No changes to the event channel contract (`channel.ts` stays untouched)
- No changes to the backend API or HTTP endpoints
- No changes to the `manager.tsx` entry point or addon registration
- No functional regressions — each tool behaves identically after restructure
- No CSS-in-JS library migrations; inline styles remain as-is (Storybook-addon convention)

## Decisions

### Decision 1: Tool module interface (ToolDefinition)

**Chosen:** A TypeScript interface with optional lifecycle hooks — `onActivate`, `onDeactivate`, `onMouseMove`, `onClick`, `onKeyDown`, `renderOverlay`.

**Alternatives considered:**
- **Base class** — adds coupling and doesn't compose well across multiple rendering surfaces
- **Higher-order component** — adds wrapper nesting and makes the overlay tree deeper
- **Plugin registry** — over-engineered for 6 tools; keep simple until a dynamic-load use case emerges

**Rationale:** An interface + registry pattern lets each tool own its event handling and rendering without dictating a class hierarchy. Tools that don't need a lifecycle hook simply omit it. The orchestrator loops over registered tools and fans out events.

### Decision 2: Backend orchestration layer

**Chosen:** A plain function module (`toolBackend.ts`) rather than a React hook.

**Alternatives considered:**
- **Custom hook (`useToolBackend`)** — hooks are tied to component lifecycle and can't be called from outside React; events arrive from DOM handlers (not React state) so the call site is already outside React's world
- **Redux-style store** — over-engineered for request-response patterns

**Rationale:** The backend API calls are fire-and-forget (create session → submit intent). They don't need React state. A plain module is testable with standard mocks and usable from any context — React component, event handler, or even from outside React.

### Decision 3: CSS injection decomposition

**Chosen:** Extract a `chatCssService` (build CSS → inject/remove style element) and keep portal mounting in the component.

**Alternatives considered:**
- **Full component extraction** — the portal mounting and DOM element discovery are inherently component logic; extracting them creates an awkward API
- **CSS as a file** — Storybook addons can't ship static CSS reliably across all frameworks

**Rationale:** CSS injection has no React dependency (plain style element in head), so it's testable as a standalone module. The portal-to-DOM logic stays in the component because it depends on `createPortal` and React lifecycle.

### Decision 4: Test strategy

**Chosen:** Unit tests for pure modules (dom-utils, toolBackendService, chatCssService) + one integration test per tool (stub the channel and simulate a click event).

**Alternatives considered:**
- **Only integration tests** — slower, more setup, and the existing DOM-heavy tests already cover flow-level behavior
- **Visual regression tests** — already handled by the design system loop; not needed here

**Rationale:** Pure utilities are cheap to test exhaustively. Tool event wiring is the risk area — each fork (6 tools × 2-3 event paths) needs one integration-style test.

## Risks / Trade-offs

- **[Risk] Tool interface too rigid** — if a future tool needs a lifecycle that the current `ToolDefinition` doesn't support, the interface needs revision. → Mitigation: design `ToolDefinition` as a union of optional handlers (not an abstract class), so adding a new optional field is non-breaking.
- **[Risk] Performance from tool orchestration loop** — fanning out every event to 6 tool objects adds overhead for one active tool. → Mitigation: the orchestrator tracks `activeTool` and only delegates to that tool; the loop is O(1), not O(n).
- **[Risk] File proliferation** — going from 1 file to ~15 files can feel noisy. → Mitigation: use a flat `src/tools/` directory; no nested folders per tool unless polyfills are needed.
- **[Trade-off] No plugin system** — tools are hard-coded in the registry, not dynamically loaded. → Acceptable: 6 tools is small, and the interface makes adding a new one a single import + registry registration. A plugin system is premature at this scale.

## Migration Plan

1. Create `src/dom-utils/` and move pure functions (`cssPath`, `buildTarget`, `describe`, `computedStyles`)
2. Create `src/tools/` and `ToolDefinition` interface
3. Extract each tool one at a time (comment → copy → reference → text → wand → place), verifying behavior after each extraction
4. Create `src/services/toolBackend.ts` and refactor `Tool.tsx` to use it
5. Create `src/services/chatCssService.ts` and simplify `ChatModeController`
6. Rewrite `ToolOverlay` as a thin orchestrator using the tool registry
7. Add unit tests for dom-utils, toolBackend, chatCssService, and one integration test per tool
8. Run existing test suite to confirm no regressions

Each step can be done incrementally — the overlay continues to work during steps 1-4 since `preview.tsx` isn't touched until step 6.

## Open Questions

- Should tool state (pins, placeholders, toast) be extracted into a context or remain as local state in the orchestrator? For now, keep as local state — context adds ceremony and the orchestrator is the only consumer.
