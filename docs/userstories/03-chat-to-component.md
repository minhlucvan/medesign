# From Chat to Component — Conversational Design

## User story

> As a **designer who doesn't write much code**,
> I want to **describe a component in plain English and have it appear in Storybook**,
> So that **I can iterate on visual design without context-switching to code.**

## Acceptance criteria

- A chat button in the Storybook toolbar opens a chat sidebar
- The chat sidebar has mode picker: Chat, Change Request, New Component, New Story, Update Story
- Typing "a hero section with headline, subtitle, CTA" generates a component
- The component lands at the path I specify (e.g. `src/sections/HeroSection/`)
- The component appears live in Storybook immediately
- Follow-up messages refine the component in place
- The Emdesign bottom panel shows critique scores after generation
- I can "Capture" to seed a visual baseline — no files are moved
- The component stays exactly where I asked for it

## Role

Designer (non-coding)

## Effort

~30 seconds from typing to seeing a component render
