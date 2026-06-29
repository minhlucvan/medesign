---
id: specs
capability: dom-utils
---

## ADDED Requirements

### Requirement: DOM utility module
The system SHALL provide a `dom-utils` module exporting `cssPath`, `buildTarget`, `describe`, and `collectComputedStyles` as standalone, testable pure functions. Each function SHALL accept DOM `Element` and `HTMLElement` inputs and return structured data without side effects.

#### Scenario: cssPath returns nth-of-type selector
- **WHEN** `cssPath(el, root)` is called with a `<button>` nested inside a `<div>` inside root
- **THEN** the returned selector is `div > button:nth-of-type(2)` based on the element's position among siblings within root

#### Scenario: buildTarget returns CommentTarget with box, selector, text
- **WHEN** `buildTarget(el, root, storyId, component)` is called with a `<h2>Welcome</h2>` element
- **THEN** the returned `CommentTarget` contains:
  - `selector`: a unique CSS selector path from root to the element
  - `text`: the text content "Welcome"
  - `box`: the element's bounding rect `{ x, y, width, height }`
  - `storyId` and `component` matching the provided arguments

#### Scenario: describe returns element descriptor
- **WHEN** `describe(target)` is called with a CommentTarget containing tag "button", text "Submit", and a selector
- **THEN** the returned descriptor string includes the tag, text, and selector in a human-readable format

#### Scenario: collectComputedStyles returns requested style values
- **WHEN** `collectComputedStyles(el)` is called with a styled `<button>` element
- **THEN** the returned object contains keys: `color`, `backgroundColor`, `fontSize`, `fontWeight`, `margin`, `padding`, `borderRadius`, `boxShadow`, `display`, `position`
- **THEN** each value is a CSS string matching the element's computed style
