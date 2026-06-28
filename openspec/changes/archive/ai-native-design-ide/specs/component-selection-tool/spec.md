---
id: specs
capability: component-selection-tool
---

## ADDED Requirements

### Requirement: Reference mode in element picker
The existing element picker overlay SHALL support a "reference" mode. When active, clicking an element in the preview SHALL:
- Highlight the element with a persistent colored outline and pin indicator
- Emit an `EVT_ELEMENT_SELECTED` channel event carrying the element's metadata
- The element SHALL remain highlighted until the user clears the selection or navigates away

#### Scenario: User references an element
- **WHEN** the user activates reference mode and clicks a button element
- **THEN** the button is highlighted with a colored outline
- **THEN** an `EVT_ELEMENT_SELECTED` event is emitted with tag, text, selector, and component name
- **THEN** a chat message appears: "Referenced: `<button>Get Started` — what would you like to do?"

#### Scenario: User clears selection
- **WHEN** the user clicks the same element again or presses Escape
- **THEN** the highlight is removed
- **THEN** a chat message appears: "Selection cleared"

### Requirement: Element metadata in selection event
The `EVT_ELEMENT_SELECTED` event payload SHALL contain:
- `tag`: HTML tag name (e.g., "button", "div", "h2")
- `text`: Truncated text content (max 200 chars)
- `selector`: Unique CSS selector path from the story root
- `component`: Component name (PascalCase)
- `rect`: Bounding rect `{ x, y, width, height }`
- `computedStyles`: Key computed style values (color, fontSize, fontWeight, fontFamily, backgroundColor, borderRadius, display, position)
- `emdesignComponent`: The component name from the `data-emdesign-component` attribute, if available
- `tokenBindings`: Array of CSS token roles detected in computed styles, if available

#### Scenario: All metadata is sent
- **WHEN** the user clicks an element
- **THEN** the event payload includes all required fields
- **THEN** the AI can use the selector and component to identify the exact element

### Requirement: Selected element appears in chat
When an element is selected, the chat SHALL display a compact card showing the element's tag, text preview, and component name. This card SHALL be part of the conversation history so the AI can reference it.

#### Scenario: Element card in chat
- **WHEN** the user selects an element
- **THEN** a card appears in the chat: "`<button>` `'Get Started'` — `NavigationBar`"
- **THEN** subsequent user messages include the element context automatically
