# Journey 4: The Quality Gate — Iterate, Critique, Ship

> **UX goal:** The user experiences the 4-source feedback loop. Components are
> critiqued in place — wherever they live in the project.

## User story

> As a frontend developer building UI components,
> I want an automated quality gate that checks my work from 4 independent angles,
> So that I never ship a component with broken tokens, visual regressions,
> or accessibility issues.

## Scenario: Developer generates a component and sees the lint results

```
Given the "my-brand" design system is active
When the developer crafts a TestimonialCard at src/widgets/TestimonialCard/
And generates it via the agent or MCP

Then the lint result shows:
  • "Consistency lint: PASS — no findings."
  • tokenScore: 1.0
  • A green "lint" pill in the Status section
```

---

## Scenario: Developer introduces a lint violation and sees it caught

```
Given the component is clean
When the developer adds a raw hex color to the source
And re-generates

Then the lint result shows:
  • "off-token-color" — P0
  • mustFix: 1
  • tokenScore drops to 0.66
  • The "lint" pill turns red and shows "P0s"
```

---

## Scenario: Developer fixes the violation

```
Given the lint shows 1 P0
When the developer replaces the raw hex with a token reference
And re-generates

Then the lint shows "PASS"
And tokenScore returns to 1.0
And the lint pill returns to green
```

---

## Scenario: Visual regression catches a layout shift

```
Given the component has a visual baseline
When the developer adds extra padding
And runs visual-test

Then the result is "changed"
And changedPixels > 0
And a diff image is generated
```

---

## Scenario: The 4-source critique produces a composite score

```
Given the component passes lint and visual test
When the developer runs evaluate_component with:
  scores: { tokens: 1.0, visual: 1.0, vision: 0.85, llm: 0.90 }
  mustFix: 0

Then the gate returns:
  • composite: >= 0.8
  • decision: "ship"
  • unsatisfiedConditions: empty
```

---

## Scenario: Dual gate — high scores cannot override mustFix

```
Given the component has high scores
  tokens: 0.95, visual: 1.0, vision: 0.90, llm: 0.92
But there is 1 P0 issue (mustFix: 1)

When the developer runs evaluate_component
Then the decision is "revise"
Despite the composite being well above 0.8
```

---

## Scenario: Developer ships the component

```
Given the gate returned "ship"
When the developer captures the component
Then a visual baseline is seeded
And the component stays in its original location — no file is moved

When the developer opens Storybook
Then the story appears in the sidebar at its registered path
And the component renders correctly with the active design system's tokens
```
