---
id: specs
capability: tool-behaviors
---

## ADDED Requirements

### Requirement: Tool registration
The overlay system SHALL maintain a registry of tool definitions. Each tool SHALL be defined by a `ToolDefinition` interface that declares:
- `mode`: a unique `ToolMode` identifier
- `hint`: a string shown in the overlay toast bar when the tool is active
- `onActivate` / `onDeactivate`: lifecycle hooks called when the tool becomes active/inactive
- `onMouseMove`, `onClick`, `onKeyDown`: optional event handlers receiving the raw DOM event + the orchestrator's active element context
- `renderOverlay`: optional React component rendered on top of the canvas when the tool is active

#### Scenario: Tool registers with the orchestrator
- **WHEN** a tool module is imported and added to the registry
- **THEN** the orchestrator lists it in its active tool map
- **THEN** events for that mode are delegated to the tool's handler methods

#### Scenario: Tool lifecycle — activate
- **WHEN** the orchestrator activates a tool (mode transitions from `off` to a specific mode)
- **THEN** the tool's `onActivate` is called
- **THEN** the tool's `renderOverlay` appears in the overlay DOM tree

#### Scenario: Tool lifecycle — deactivate
- **WHEN** the orchestrator deactivates a tool (mode transitions back to `off`)
- **THEN** the tool's `onDeactivate` is called
- **THEN** the tool's `renderOverlay` is removed from the overlay DOM tree

### Requirement: Comment tool — popover and event emission
When the tool mode is `comment`, clicking an element SHALL:
- Open a popover at the element's location
- The popover SHALL display the element tag + text preview
- The popover SHALL contain a textarea for the comment
- Submitting SHALL emit `EVT_COMMENT_SUBMIT` with the built `CommentTarget` and instruction

#### Scenario: Comment tool — submit comment
- **WHEN** the user clicks an element in comment mode
- **THEN** a popover appears near the element with a textarea
- **WHEN** the user types "Make this bigger" and presses ⌘↵
- **THEN** `EVT_COMMENT_SUBMIT` is emitted with the element's CommentTarget and instruction
- **THEN** the tool returns to `off` mode

### Requirement: Comment tool — visual indicators
When the tool mode is `comment`, the overlay SHALL:
- Highlight the clicked element with a blue outline (#2563eb)
- Show a pin at the element's top-left corner
- Display toast text "emdesign: type your comment"
- Set cursor to `crosshair`

#### Scenario: Comment tool — visual indicators on click
- **WHEN** the user clicks an element in comment mode
- **THEN** a blue outline (#2563eb) appears on the element
- **THEN** a pin appears at the element's top-left corner
- **THEN** the cursor is `crosshair`

### Requirement: Comment tool — cancel behavior
When the tool mode is `comment`, pressing Esc SHALL close the popover without emitting an event and return the tool to `off` mode.

#### Scenario: Comment tool — cancel with Esc
- **WHEN** the user clicks an element in comment mode
- **THEN** a popover appears
- **WHEN** the user presses Esc
- **THEN** the popover closes, no event is emitted
- **THEN** the tool returns to `off` mode

### Requirement: Copy tool — clipboard write on click
When the tool mode is `copy`, clicking an element SHALL:
- Build a rich text descriptor of the element (tag, selector, text, classes, box, storyId, component)
- Copy the descriptor to clipboard via `navigator.clipboard.writeText`
- Emit `EVT_COPIED` with `{ ok: true, selector }`

#### Scenario: Copy tool — click element
- **WHEN** the user clicks a `<button>` element in copy mode
- **THEN** the element's descriptor is copied to clipboard
- **THEN** `EVT_COPIED` is emitted with `{ ok: true, selector }`

#### Scenario: Copy tool — clipboard write failure
- **WHEN** clipboard write fails (e.g., permission denied in non-HTTPS context)
- **THEN** `EVT_COPIED` is emitted with `{ ok: false, error: string }`
- **THEN** the tool returns to `off` mode

### Requirement: Copy tool — visual feedback
When the tool mode is `copy`, clicking an element SHALL:
- Show a pin at the element's location
- Flash toast "copied <tag>"
- Set cursor to `crosshair`

#### Scenario: Copy tool — visual feedback on click
- **WHEN** the user clicks an element in copy mode
- **THEN** a pin appears at the element position
- **THEN** toast reads "copied <tag>"
- **THEN** cursor is `crosshair`

### Requirement: Copy tool — lifecycle
After clicking an element in copy mode, the tool SHALL return to `off` mode.

#### Scenario: Copy tool — returns to off after click
- **WHEN** the user clicks an element in copy mode
- **THEN** after emission and visual feedback, the tool returns to `off` mode

### Requirement: Reference tool — extracted module
The extracted reference tool SHALL implement the existing reference mode behavior as specified in `component-selection-tool/spec.md` (click element → highlight with outline + pin → emit `EVT_ELEMENT_SELECTED` → return to `off` mode).

The extracted module SHALL additionally:
- Define its tool mode using the `ToolDefinition` interface
- Accept a `ToolContext` for orchestrator communication
- Follow the extracted-module lifecycle (registered in the tool registry, activated/deactivated by the orchestrator)

#### Scenario: Reference tool — uses ToolDefinition interface
- **WHEN** the reference tool module is imported
- **THEN** it exports a `ToolDefinition` conforming to the shared interface
- **THEN** it can be registered in the tool registry

#### Scenario: Reference tool — delegates to orchestrator
- **WHEN** the orchestrator activates reference mode
- **THEN** the reference tool's `onActivate` is called
- **THEN** click events are delegated to the reference tool's `onClick` handler

### Requirement: Reference tool — computed styles collection
When the tool mode is `reference`, clicking an element SHALL collect computed style values including: color, backgroundColor, fontSize, fontWeight, margin, padding, borderRadius, boxShadow, display, position.

#### Scenario: Reference tool — collects computed styles
- **WHEN** the user clicks an element in reference mode
- **THEN** computed styles are collected via `getComputedStyle` for the specified fields
- **THEN** the collected styles are included in the `EVT_ELEMENT_SELECTED` payload

### Requirement: Text edit tool — content editing and event emission
When the tool mode is `text`, clicking an element SHALL:
- Set `contentEditable = true` on the element
- Focus the element with caret at the end
- Listen for Enter (no Shift) to commit, Esc to cancel
- On commit: emit `EVT_TEXT_SUBMIT` with `{ target, from, to }`

#### Scenario: Text edit — commit change
- **WHEN** the user clicks a text element in text-edit mode
- **THEN** the element becomes editable with a blue outline
- **WHEN** the user types new text and presses Enter
- **THEN** `EVT_TEXT_SUBMIT` is emitted with the original and new text
- **THEN** the tool returns to `off` mode

### Requirement: Text edit tool — visual indicators
When the tool mode is `text`, the overlay SHALL:
- Show a blue outline on the active element
- Flash toast "text edit queued" on commit
- Set cursor to `crosshair`

#### Scenario: Text edit — visual feedback on commit
- **WHEN** the user clicks an element in text-edit mode
- **THEN** a blue outline appears on the element
- **WHEN** the user commits with Enter
- **THEN** toast reads "text edit queued"

### Requirement: Text edit tool — cancel behavior
When the tool mode is `text`, pressing Esc SHALL restore the original text content and return the tool to `off` mode without emitting an event.

#### Scenario: Text edit — cancel with Esc
- **WHEN** the user clicks a text element in text-edit mode
- **WHEN** the user presses Esc
- **THEN** the original text is restored
- **THEN** the tool returns to `off` mode

### Requirement: Wand tool — data construction and event emission
When the tool mode is `wand`, clicking an element SHALL:
- Build a `WandTriggerPayload` with the element's metadata, computed styles, and `emdesignComponent`
- Include `vision: true` if Shift key was held during click
- Emit `EVT_WAND_TRIGGER` with the payload

#### Scenario: Wand tool — click element
- **WHEN** the user clicks an element in wand mode
- **THEN** `EVT_WAND_TRIGGER` is emitted with the element's tag, text, selector, component, rect, computedStyles, and storyId
- **THEN** the tool returns to `off` mode

#### Scenario: Wand tool — Shift+click for vision
- **WHEN** the user Shift+clicks an element in wand mode
- **THEN** `EVT_WAND_TRIGGER` is emitted with `vision: true`
- **THEN** the tool returns to `off` mode

### Requirement: Wand tool — visual indicators
When the tool mode is `wand`, the overlay SHALL:
- Show a purple hover outline (#a855f7) on hovered elements
- Show a wand emoji indicator "🪄" at the element's top-right on hover
- Show a pin at the element's location with text "auto-fix <tag>" on click
- Flash toast "auto-fix triggered for <tag>" on click
- Set cursor to `copy`

#### Scenario: Wand tool — hover visual indicators
- **WHEN** the user hovers an element in wand mode
- **THEN** a purple (#a855f7) outline appears on the element
- **THEN** a wand emoji "🪄" appears at the element's top-right

#### Scenario: Wand tool — click visual feedback
- **WHEN** the user clicks an element in wand mode
- **THEN** a pin appears with text "auto-fix <tag>"
- **THEN** toast reads "auto-fix triggered for <tag>"
- **THEN** cursor is `copy`

### Requirement: Place tool — zone detection
When the tool mode is `place`, the overlay SHALL:
- Show a green (#22c55e) element highlight on hover
- Determine insertion zone based on cursor Y position within the element:
  - Top 25% → `before`
  - Bottom 25% → `after`
  - Middle 50% → `into`
  - Shift held → `replace`
- Show a zone guide line (for `before`/`after`) and a zone badge ("+ before", "+ after", "↳ into", "× replace")

#### Scenario: Place tool — before zone
- **WHEN** the user hovers an element in place mode with cursor in the top 25%
- **THEN** the zone is `before`
- **THEN** a green guide line appears at the element's top edge
- **THEN** a "+ before" badge appears

#### Scenario: Place tool — replace zone with Shift
- **WHEN** the user holds Shift while hovering an element in place mode
- **THEN** the zone switches to `replace`
- **THEN** the highlight turns red (#ef4444)
- **THEN** an "× replace" badge appears

### Requirement: Place tool — event emission and placeholder
When the tool mode is `place`, clicking an element SHALL:
- Open a placement popover with a textarea to describe the component
- On submit: build a `PlaceTriggerPayload`, emit `EVT_PLACE_TRIGGER`
- Show a green dashed placeholder overlay at the element's location
- Flash toast "placing <zone> <tag>"
- Set cursor to `copy`
- Return to `off` mode after submit

#### Scenario: Place tool — submit placement
- **WHEN** the user clicks an element in place mode with zone `after`
- **THEN** a popover appears with a textarea
- **WHEN** the user types "a stats card" and presses ⌘↵
- **THEN** `EVT_PLACE_TRIGGER` is emitted with `placementMode: "after"` and `selectedComponent: "a stats card"`
- **THEN** a green dashed placeholder overlay appears at the element's location
- **THEN** toast reads "placing after <tag>"

#### Scenario: Place tool — placeholder auto-clear
- **WHEN** a placeholder overlay appears (after place submit)
- **WHEN** 15 seconds elapse
- **THEN** the placeholder overlay is removed from the DOM
