---
id: specs
capability: conversation-scoping
---

## ADDED Requirements

### Requirement: Chat sidebar split into Project and Story sections
The chat sidebar SHALL display two distinct conversation sections:
- **Project**: Global conversations about the entire project, not tied to any specific story
- **Story**: Conversations scoped to the currently open story. When the user navigates to a different story, this section switches to show that story's conversations.

Each section SHALL have a header label and its own list of conversation threads.

#### Scenario: User sees two sections
- **WHEN** the user opens the chat sidebar while viewing `Components/Button`
- **THEN** the sidebar shows a "Project" section with global conversations
- **THEN** the sidebar shows a "Story: Button" section with conversations scoped to that story

#### Scenario: Navigating switches the Story section
- **WHEN** the user navigates from `Components/Button` to `Components/Dashboard`
- **THEN** the Story section header updates to "Story: Dashboard"
- **THEN** the Button conversations are preserved but not shown until the user returns to Button

### Requirement: Comments create story-scoped conversations
When the user submits a comment via the comment tool (click element → write feedback → submit), the system SHALL automatically create a new story-scoped conversation with the comment as the first message. The target element's metadata (selector, tag, text, bounding box) SHALL be included as context.

#### Scenario: Comment creates a conversation
- **WHEN** the user submits a comment saying "this button should be blue" on a Button element
- **THEN** a new conversation is created in the "Story: Button" section
- **THEN** the conversation's first message includes the comment text and the element context (selector, tag, text)
- **THEN** the chat sidebar switches to show this new conversation

#### Scenario: Comment context is preserved
- **WHEN** the AI responds to a comment-originated conversation
- **THEN** the AI receives the element context (tag, selector, text) as part of the conversation history
- **THEN** the AI can reference the exact element in its response

### Requirement: Conversations display origin badge
Each conversation thread SHALL display a small badge indicating how it was created:
- 💬 for manual chat messages
- 💭 for comments
- 🤖 for AI-generated follow-ups

#### Scenario: Origin badge is visible
- **WHEN** the user views the conversation list
- **THEN** each conversation shows a badge indicating its origin type
