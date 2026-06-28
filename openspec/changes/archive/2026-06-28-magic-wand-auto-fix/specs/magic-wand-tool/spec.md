## ADDED Requirements

### Requirement: Magic wand tool mode in the element picker

The preview iframe element picker (`preview.tsx`) SHALL add a new "wand" tool mode alongside the existing `comment`, `copy`, `text`, and `reference` modes. In wand mode:
- The cursor SHALL change to a wand icon (🪄 cursor or equivalent indicator)
- Clicking a rendered DOM element SHALL trigger the auto-fix workflow instead of selecting/referencing
- The clicked element SHALL be highlighted with a temporary overlay (same visual as reference mode, but with a wand icon badge)
- The element's context (component name, tag, CSS selector, text content, computed styles, bounding box) SHALL be collected and sent via channel event `EVT_WAND_TRIGGER`

#### Scenario: Activate wand mode from toolbar
- **WHEN** user clicks the wand icon in the preview toolbar
- **THEN** the element picker switches to wand mode
- **AND** the cursor changes to a wand indicator
- **AND** all other tool modes (comment, copy, text, reference) are deselected

#### Scenario: Click element in wand mode triggers auto-fix
- **WHEN** user clicks a DOM element in wand mode
- **THEN** the element is highlighted with a wand badge overlay
- **AND** an `EVT_WAND_TRIGGER` channel event is emitted with element context
- **AND** the manager UI shows an "Auto-fix running..." progress indicator

#### Scenario: Click while auto-fix is running
- **WHEN** user clicks an element while a previous wand auto-fix is still running
- **THEN** the new click is queued or the previous operation is cancelled (implementation choice)
- **AND** the user is informed via a toast notification

#### Scenario: Keyboard shortcut for wand mode
- **WHEN** user presses `Ctrl+Shift+W` (or `Cmd+Shift+W` on macOS) in the preview
- **THEN** the tool mode toggles to/from wand mode
- **AND** the toolbar icon updates to reflect the active state

#### Scenario: Shift+click enables vision mode
- **WHEN** user holds Shift while clicking an element in wand mode
- **THEN** the `EVT_WAND_TRIGGER` event SHALL include `vision: true`
- **AND** the auto-fix workflow SHALL include LLM vision critique in its diagnostic pipeline

### Requirement: Channel event EVT_WAND_TRIGGER

A new channel event `EVT_WAND_TRIGGER` SHALL be defined (in the same events module as `EVT_VIEW_CONTEXT`, `EVT_ELEMENT_SELECTED`, etc.). The event payload SHALL contain:

```typescript
interface WandTriggerEvent {
  componentName: string         // resolved component/story name
  tag: string                   // e.g., "button", "div"
  selector: string              // unique CSS selector
  textContent: string           // truncated to 200 chars
  computedStyles: Record<string, string>  // key visual properties
  boundingBox: { x: number, y: number, width: number, height: number }
  viewport: { width: number, height: number }
  storyId: string
  vision: boolean               // whether vision critique was requested
}
```

#### Scenario: Event carries full element context
- **WHEN** element is clicked in wand mode
- **THEN** `EVT_WAND_TRIGGER` SHALL include all required payload fields
- **AND** `textContent` SHALL be truncated to 200 characters max
- **AND** `computedStyles` SHALL include at minimum: `color`, `background-color`, `font-size`, `font-weight`, `padding`, `margin`, `border`, `border-radius`, `box-shadow`

### Requirement: Wand results panel

A new addon panel tab "Wand Results" SHALL be added to the Storybook manager UI. The panel SHALL display:

- **Detection Summary**: Number and type of issues found (contrast, spacing, alignment, token, polish)
- **Fix Summary**: Issues that were auto-fixed, with file:line links for each fix
- **Before/After**: Score comparison (composite, visual, tokens, spatial, a11y) before and after the fix
- **Needs Human**: Issues that couldn't be auto-fixed, with recommendations
- **Rollback button**: Reverts all changes from the last wand session

#### Scenario: Panel opens after auto-fix completes
- **WHEN** the auto-fix workflow completes
- **THEN** the Wand Results panel SHALL open automatically
- **AND** display the detection summary, fix summary, and before/after scores
- **AND** show a timestamp for when the fix was applied

#### Scenario: Rollback reverts all wand changes
- **WHEN** user clicks the "Rollback" button in the Wand Results panel
- **THEN** all edits from the last wand session SHALL be reverted
- **AND** the panel updates to show "Rolled back" status
- **AND** the component reverts to its pre-fix state in the Storybook canvas

#### Scenario: Panel persists across story navigation
- **WHEN** user navigates to a different story
- **THEN** the Wand Results panel SHALL retain its content for the current session
- **AND** display a note indicating the results are from a different story/component

### Requirement: Toolbar wand icon

The preview toolbar SHALL display a magic wand icon (🪄) for the wand tool mode. The icon SHALL:
- Be visually distinct from the comment (💬), copy (📋), text (✏️), and reference (🔗) icons
- Show an active/highlighted state when wand mode is selected
- Show a brief loading animation while auto-fix is running
- Display a small badge with the fix count when results are available

#### Scenario: Wand icon visual feedback during fix
- **WHEN** auto-fix workflow is in progress
- **THEN** the wand icon SHALL pulse or show a spinner overlay
- **AND** the icon SHALL show a checkmark briefly when fix succeeds
- **AND** show an X when fix fails or rolls back
