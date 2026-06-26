# Journey 5: Compose & Deliver — Building a Production Page

> **UX goal:** The user composes components from across the project tree into a
> full page. Every team has their own folder convention — emdesign respects it.

## User story

> As a product team shipping a marketing site,
> I want to compose my design system primitives and captured components into
> complete pages, verify them end-to-end, and commit them with confidence,
> So that my team can iterate independently without breaking each other's work.

## Scenario: Every team has their own folder convention — all work

```
Given the project has components organized in different conventions:

  Atomic design convention:
  • src/atoms/Button/Button.tsx
  • src/atoms/Badge/Badge.tsx
  • src/molecules/Card/Card.tsx

  Feature-based convention:
  • src/features/navbar/Navbar.tsx
  • src/features/hero/HeroSection.tsx
  • src/features/pricing/PricingTable.tsx

  Page-based convention:
  • src/pages/Landing/LandingPage.tsx

  Flat convention (also valid):
  • src/ui/Footer.tsx
  • src/ui/TestimonialCard.tsx

When each component was created via the agent or MCP
Then the agent wrote to the path the developer specified
And the lint passed for each one
And each component has its own story co-located with it
```

---

## Scenario: Developer composes components from mixed conventions into a page

```
Given the developer has components scattered across conventions:
  • src/atoms/Button/
  • src/molecules/Card/
  • src/features/hero/
  • src/features/pricing/
  • src/ui/Footer.tsx

When the developer creates src/pages/Landing/LandingPage.tsx that
imports from all these paths like any normal React project:

  import { Navbar } from '../../features/navbar/Navbar';
  import { HeroSection } from '../../features/hero/HeroSection';
  import { PricingTable } from '../../features/pricing/PricingTable';
  import { TestimonialCard } from '../../ui/TestimonialCard';
  import { Footer } from '../../ui/Footer';

Then the component is just a normal React file — no emdesign wrappers
And the lint reports PASS (it checks token usage, not folder structure)

When the developer opens Storybook to "Pages/Landing"
Then the full page renders in order:
  Navbar → HeroSection → PricingTable → TestimonialCard → Footer
And the page scrolls naturally

The folder structure is whatever the team decided — emdesign never
dictates where components should live.
```

---

## Scenario: Charter validates the page structure

```
Given LandingPage is rendered in Storybook
When the developer adds story-level charters:
  • has-all-sections — expects 5+ section-level elements
  • pricing-visible — expects 3 pricing cards
And re-renders

Then the Charters tab shows both charters passing
```

---

## Scenario: Full-page visual regression

```
Given LandingPage renders correctly
When the developer runs visual-test
Then a visual baseline is established

When a team member later changes the pricing component
at src/features/pricing/PricingTable.tsx
And visual-test is run on LandingPage
Then the result is "changed" — the page-level baseline catches
the change cascading from the sub-component

No manual dependency tracking needed — the screenshot diff
automatically detects the cascade.
```

---

## Scenario: Full critique gate on the composed page

```
Given LandingPage passes lint, visual, and charters
When the developer runs evaluate_component
Then the decision is "ship"
And the per-source baseline is stored
```

---

## Scenario: Capture the page

```
Given the gate says "ship"
When the developer captures LandingPage
Then a visual baseline is seeded at __screenshots__/LandingPage.baseline.png
And the component stays at src/pages/Landing/LandingPage.tsx
No files are moved, no generated/ directory is involved.
```
