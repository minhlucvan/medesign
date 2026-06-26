# Journey 3: From Chat to Component — Conversational Design

> **UX goal:** The user types an idea in a chat interface, the agent generates a
> component, and it appears live in Storybook. The component lands in the project's
> own structure — wherever that may be.

## User story

> As a designer who doesn't write much code,
> I want to describe a component in plain English and have it appear in Storybook,
> So that I can iterate on visual design without context-switching to code.

## Scenario: User opens the chat sidebar

```
Given the Studio is running (Storybook on :6006, backend on :4321)
When the developer opens Storybook at http://localhost:6006
Then a chat button appears in the Storybook toolbar

When the developer clicks the chat button
Then a chat sidebar slides in from the right
And the sidebar shows:
  • A "New Conversation" button
  • A list of recent sessions
  • A mode picker with options:
    • 💬 Chat — Free-form conversation
    • ✏️ Change Request — Request a design change
    • 🧩 New Component — Scaffold a new React component
    • 📖 New Story — Create a new story for a component
    • 🔄 Update Story — Request changes to an existing story
```

---

## Scenario: User requests a new component via chat

```
Given the chat sidebar is open
When the user clicks "🧩 New Component"
Then the input shows: "Describe the component you want to build..."

When the user types:
  "Create a HeroSection component. It should have a headline that says
   'Build something amazing', a subtitle about the value prop, and a
   primary CTA button using my-brand's accent color. Place it at
   src/sections/HeroSection/."

And presses Enter
Then the message appears in the chat as the user's request
And an assistant message appears with status "thinking..."
```

---

## Scenario: Agent creates the component in the requested path

```
Given the user specified "src/sections/HeroSection/"
When the agent generates the component
Then the files are created at:
  • src/sections/HeroSection/HeroSection.tsx
  • src/sections/HeroSection/HeroSection.stories.tsx
The exact path the user asked for — not a special emdesign directory

When the agent calls generate_component with the source
Then the lint report indicates PASS

When the user watches the chat
Then the assistant message updates with:
  • ✅ "Created HeroSection — lint: PASS"
  • The source code (collapsible)
  • A preview link to Storybook

When the user clicks the preview link
Then Storybook navigates to the story
And the rendered hero section is visible:
  • Headline: "Build something amazing"
  • CTA button using my-brand accent color
```

---

## Scenario: User refines via follow-up

```
Given the HeroSection is rendered in Storybook
When the user returns to the chat sidebar
And types: "Add a secondary 'Learn more' button next to the CTA"
Then the agent edits the component in place
And the file at src/sections/HeroSection/HeroSection.tsx is updated

When the user checks Storybook
Then the rendered HeroSection now shows two buttons side by side
```

---

## Scenario: User sees critique scores and captures

```
Given the HeroSection passes lint
When the user opens the "Emdesign" bottom panel
Then they see critique scores:
  • tokens, visual, vision, llm
  • composite score
  • decision: "ship" or "revise"

When the decision is "ship"
Then the user can click "Capture" in the panel
And a visual baseline is seeded for the component
And the component stays exactly where it is — no file is moved

When the user checks the filesystem
Then the component is still at src/sections/HeroSection/HeroSection.tsx
And __screenshots__/HeroSection.baseline.png now exists
```
