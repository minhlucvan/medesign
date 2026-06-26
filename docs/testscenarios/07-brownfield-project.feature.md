# Journey 7: Brownfield Project — Wire Into Existing UI

> **UX goal:** The team has an existing React app with its own component tree, folder
> conventions, and Storybook. They run one command, and emdesign wires into their
> existing structure — no files move, no folders are renamed.

## User story

> As a team with an existing React project,
> I want to wire emdesign into my running codebase without restructuring it,
> So that I can start using the design loop on components that already exist,
> in the folders where they already live.

## Scenario: Attach detects existing project structure

```
Given a brownfield project with:
  • src/components/Button/Button.tsx + Button.stories.tsx
  • src/components/Card/Card.tsx + Card.stories.tsx
  • src/components/Header/Header.tsx + Header.stories.tsx
  • src/pages/Landing/Landing.tsx + Landing.stories.tsx
  • .storybook/main.ts — already configured with React+Vite
  • package.json — with storybook, react, tailwind deps

When the team runs: emdesign attach /path/to/project
Then the CLI detects the framework as "react-tailwind"
And @emdesign/addon is added to .storybook/main.ts
And .claude/agents/, .claude/commands/mds/, .claude/workflows/ are created
And emdesign.config.json is written

When the team checks emdesign.config.json
Then generatedDir is NOT set to "src/generated" — it uses the project's existing structure
And no files were moved from their original locations
```

---

## Scenario: Scan discovers existing components and stories

```
Given the project has stories spread across the tree:
  • src/components/Button/Button.stories.tsx
  • src/components/Card/Card.stories.tsx
  • src/components/Header/Header.stories.tsx
  • src/pages/Landing/Landing.stories.tsx

When the team runs: emdesign discover
Or calls the MCP tool discover_components with source: "all"
Then the response lists all 4 existing stories with their real paths
And each entry has the correct story ID as Storybook knows it
And the preview URLs are functional (point at Storybook's iframe)

When the team opens Storybook
Then all 4 existing stories appear in the sidebar as they always did
And the Emdesign addon panels are available alongside them
```

---

## Scenario: Agent creates a new component in the project's own structure

```
Given the project uses atomic design: src/components/atoms/, src/components/molecules/
When the team requests via chat: "create a Badge component in atoms"

Then the agent writes to: src/components/atoms/Badge/Badge.tsx
And src/components/atoms/Badge/Badge.stories.tsx
NOT to src/generated/Badge.tsx

When the agent calls generate_component
Then the lint runs against the project's active design system
And the component passes or fails based on token compliance

When the team opens Storybook
Then the Badge story appears under "Atoms/Badge" (following the project's naming)
```

---

## Scenario: Existing components get visual baselines

```
Given the project has an existing Button component with a story
When the team runs visual-test on Button
Then a baseline PNG is created for Button
And subsequent visual diffs work on the existing component

When the team modifies Button's padding
And runs visual-test again
Then the visual status is "changed"
And the diff highlights the padding change
```

---

## Scenario: Critique gate works on existing components

```
Given the project has an existing Card component
When the team runs evaluate_component on Card
With scores: { tokens: 1.0, visual: 1.0 }
And mustFix: 0
Then the gate returns a decision (ship or revise)
And the result is stored in .emdesign/baselines.json
```

---

## Scenario: Design system is extracted from existing patterns

```
Given the project's existing components use:
  • accent color #2563eb in buttons and links
  • font-family: Inter across all components
  • border-radius: 8px on cards and inputs
  • spacing: 8px base unit

When the team runs: emdesign ds extract
Or uses the "extract" creation mode in the UI
Then a new design system is created at design-systems/extracted/
And tokens.css contains:
  • --color-accent: #2563eb
  • --font-sans: "Inter", system-ui, sans-serif
  • --radius: 8px
  • --space-unit: 8px

When the team applies this extracted system
Then existing components continue to render identically
And the design loop now has a token contract to enforce going forward
```
