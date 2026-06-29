---
id: specs
capability: chat-controller
---

## ADDED Requirements

### Requirement: Chat mode CSS injection
The chat mode SHALL inject CSS into the document `<head>` when enabled, and remove it when disabled. The injected CSS SHALL:
- Hide the story tree, search field, sidebar items, and sidebar menu when `.emdesign-chat-active` class is on `<body>`
- Apply theme-aware CSS custom properties (dark or light mode detected from the sidebar's computed background luminance)
- Keep the sidebar header visible
- Set scroll area content to fill height as a flex column

#### Scenario: Chat mode enabled — CSS injected
- **WHEN** chat mode is enabled
- **THEN** a `<style id="emdesign-chat-css">` element is added to `<head>`
- **THEN** `<body>` receives class `emdesign-chat-active`
- **THEN** the injected CSS contains `--emdesign-bg` with an HSL value consistent with the detected luminance (for dark theme: `hsl(0 0% 10%)`; for light theme: `hsl(0 0% 98%`) and `--emdesign-text` with a contrasting value (for dark theme: `hsl(0 0% 90%)`; for light theme: `hsl(0 0% 10%)`)

#### Scenario: Chat mode disabled — CSS removed
- **WHEN** chat mode is disabled
- **THEN** the `emdesign-chat-css` style element is removed from `<head>`
- **THEN** `emdesign-chat-active` class is removed from `<body>`

### Requirement: Chat mode toggle
The chat mode controller SHALL render a toggle button portaled into the Storybook sidebar header. Clicking the toggle SHALL:
- Emit `EVT_CHAT_MODE` with `{ enabled: !currentVisible }`
- Change the button icon between a chat bubble SVG (closed) and "✕" (open)

#### Scenario: Toggle chat on
- **WHEN** the user clicks the chat toggle button while chat is closed
- **THEN** `EVT_CHAT_MODE` is emitted with `{ enabled: true }`

### Requirement: Chat sidebar mounting
When chat mode is active, the `ChatSidebar` component SHALL be rendered inside the sidebar's scroll-area content div via `createPortal`, positioned below the header with `flex: 1`.

The controller SHALL pass a `defaultSessionId` if one was provided in the `EVT_CHAT_MODE` event.

#### Scenario: Chat opens with session
- **WHEN** `EVT_CHAT_MODE` is received with `{ enabled: true, sessionId: "abc" }`
- **THEN** chat mode enables
- **THEN** `ChatSidebar` is rendered with `defaultSessionId` set to `"abc"`

### Requirement: CSS service extraction
The CSS injection logic (theme detection, style element creation/removal, CSS string building) SHALL be extracted into a pure service module independent of React. The component SHALL call `injectChatCSS(enabled)` and `buildChatCSS(isDark)` from this module.

#### Scenario: CSS service builds dark theme CSS
- **WHEN** `buildChatCSS(true)` is called
- **THEN** the CSS string contains `--emdesign-bg: hsl(0 0% 10%)` and `--emdesign-text: hsl(0 0% 90%)`
- **THEN** the CSS string contains `.sidebar-item { display: none }` to hide story tree items

#### Scenario: CSS service injects and removes
- **WHEN** `injectChatCSS(true)` is called
- **THEN** the `emdesign-chat-css` style element exists in `<head>` and body has `emdesign-chat-active` class
- **WHEN** `injectChatCSS(false)` is called
- **THEN** the style element is removed and the class is removed
