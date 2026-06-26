# Journey 1: First Contact — From Zero to Running Studio

> **UX goal:** The user discovers emdesign, runs one command, and immediately sees a
> running Studio with Storybook, the addon panel, and a starter design system.
> The project is a normal Storybook repo — no special folder conventions imposed.

## User story

> As a developer evaluating emdesign,
> I want to go from zero to a running design studio in under 2 minutes,
> So that I can decide if this tool fits my workflow.

## Scenario: User inits a project and sees the workspace

```
Given the developer has Node 20+ and a terminal
When they run:
  npx emdesign init react-tailwind my-project
  cd my-project
  npm install
Then the terminal output shows:
  • "framework: react-tailwind"
  • "filesWritten: 55"
  • "Next: `npm i`, run Storybook + `emdesign serve`"

When the developer runs:
  npx storybook dev -p 6006 &
  npx emdesign serve &
And opens http://localhost:6006 in their browser
Then they see the Storybook UI with:
  • A sidebar titled "Design System/Atelier" with Showcase story
  • An "Emdesign" bottom panel labeled "Emdesign"
  • A "System" tab in the top toolbar
  • A "Charters" tab in the top toolbar
  • A "+ Create" tab in the top toolbar

When the developer clicks the "Emdesign" bottom panel
Then they see:
  • A "Status" section with "backend up" (green pill)
  • The active design system shown as "atelier"
  • A "lint" indicator showing "passing"
  • An activity feed showing recent events

When the developer opens the "System" tab
Then they see:
  • A "My Systems" / "Catalog" toggle
  • A chip for the "atelier" design system
  • Token browser showing colors, typography, spacing
  • DESIGN.md source viewer

When the developer checks the filesystem
Then it's a normal Storybook repo:
  • .storybook/main.ts
  • .storybook/preview.tsx
  • .claude/agents/, .claude/commands/mds/
  • design-systems/atelier/ (DESIGN.md, tokens.css, code/)
  • emdesign.config.json
  • CLAUDE.md, package.json, tailwind.config.js
No special emdesign folders — no forced src/generated or src/components
```

---

## Scenario: Developer explores the starter design system

```
Given the developer is on the "System" tab with "atelier" selected
When they scroll to the "Tokens" section
Then they see token cards organized by kind:
  • Color tokens: surface, surface-raised, text, text-muted, accent, border
  • Typography tokens: display, sans, mono
  • Each color token shows a swatch with the hex value

When the developer clicks "DESIGN.md"
Then they see the full 10-section Atelier contract

When the developer checks the filesystem
Then design-systems/atelier/ contains:
  • DESIGN.md       — the design contract
  • tokens.css      — the machine token contract
  • manifest.json   — metadata
  • code/           — React primitives (Button, Card, Input, Badge, Heading, Stack)
  • graph.json      — the knowledge graph
```

---

## Scenario: Developer understands the CLI tooling

```
Given the developer has emdesign installed
When they run: emdesign --help
Then the output shows available commands:
  • serve          — Start the HTTP + MCP server
  • mcp            — Start MCP over stdio
  • init           — Scaffold a new project
  • attach         — Add emdesign to an existing project
  • ds create|list|use|validate|doctor — Design system management
  • lint           — Run consistency lint
  • visual-test    — Run visual regression test

When they run: emdesign ds list
Then the output lists:
  • atelier — "Atelier" (the starter system)

When they run: emdesign ds doctor atelier
Then the doctor report shows:
  • passed / total counts
  • letter grade (A-F)
  • per-category breakdowns: contract, depth, theming, integrity, code
  • matchesGrade: true/false
```
