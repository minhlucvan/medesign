# Journey 6: Evolve the System — Rebrand Without Rewriting

> **UX goal:** The user updates their design system's token values and all components
> re-skin automatically. They can experiment with a new brand direction, preview it,
> and commit it — without touching a single component's source code.

## User story

> As a design system operator,
> I want to change the accent color, fonts, or spacing of my design system
> and see every component update automatically,
> So that I can rebrand or iterate on the system without rewriting UI code.

## Scenario: Developer changes a token and sees components re-skin

```
Given the team has 5 captured components that all use my-brand tokens
  • Navbar uses --color-surface and --color-accent
  • HeroSection uses --color-accent for the CTA button
  • PricingTable uses --color-accent for the "Most popular" badge
  • TestimonialCard uses --color-text-muted for the quote
  • LandingPage composes all of them

When the developer opens design-systems/my-brand/tokens.css
And changes:
  --color-accent: #e63946 → #1a6dd4  (terracotta to blue)
  --font-display: "Inter" → "Playfair Display"
  --radius: 12px → 4px
And saves the file

Then the Storybook dev server hot-reloads the CSS
And every component re-renders with the new values:
  • All CTA buttons change from terracotta to blue
  • All headings change from Inter to Playfair Display
  • All border radii change from 12px to 4px

When the developer opens the LandingPage story
Then the full page reflects the new brand:
  • Navbar links: blue accent
  • HeroSection CTA: blue button
  • PricingTable badge: blue background
  • All cards: 4px radius
```

---

## Scenario: Visual regression catches the systemic change

```
Given all components have baselines with the old accent color
When the developer runs visual tests across all components:
  emdesign visual-test Navbar
  emdesign visual-test HeroSection
  emdesign visual-test PricingTable
  emdesign visual-test TestimonialCard
  emdesign visual-test LandingPage

Then ALL components report "changed" because the accent color shift
affects every component's rendered pixels

The developer acknowledges the intentional rebrand:
When they run test_component for each component
Then the new screenshots become the updated baselines (next run: "pass")
```

---

## Scenario: Doctor validates the updated system

```
Given my-brand's tokens.css now uses blue accents and Playfair Display
When the developer runs: emdesign ds doctor my-brand
Then the doctor report's findings all pass
And matchesGrade is true
And the token contract is valid (all required roles present)
```

---

## Scenario: Developer can experiment with tokens via the System tab

```
Given my-brand is the active system
When the developer opens the "System" tab
And selects "my-brand"
And clicks "DESIGN.md" or "tokens.css"

Then they can edit the raw token values directly in the source viewer
And submit a change request via the text input:
  "Shift the accent color warmer — try #d65a31 instead of #1a6dd4"

When the agent processes the change request
And updates tokens.css
Then the components re-skin in Storybook
And the developer can visually compare before and after
```
