# Journey 2: Pick Your Foundation — Browsing, Previewing, Customizing

> **UX goal:** The user finds a design system that matches their brand personality,
> previews it visually, customizes the colors and fonts, and creates their own system.
> This is the "choose your adventure" moment — the foundation for everything they build.

## User story

> As a product designer,
> I want to browse a gallery of design system bases, see what each looks like,
> tweak the colors and fonts to match my brand, and create my own system,
> So that every component I build later automatically uses my brand identity.

## Scenario: User browses the catalog as a visual gallery

```
Given the developer has a running Studio
When they open the "System" tab and click "Catalog"
Then they see a responsive grid of base design system cards
Each card shows:
  • A preview area (gradient or iframe preview)
  • The base name (e.g. "After Hours", "Industrial Brutalist")
  • A category pill (e.g. "Editorial", "Brutalist", "Fintech")

When the developer types "editorial" in the search bar
Then only editorial-category bases are shown:
  • After Hours — Editorial
  • Editorial Burgundy — Editorial
  • Field Notes Editorial — Editorial

When the developer clears the search and clicks the "Deck" filter pill
Then only deck-category bases are filtered:
  • Deck — Guizang Editorial
  • Deck — Open Slide Canvas
  • Deck — Swiss International
  • Keynote Warm

When the developer clicks "All" to clear filters
Then all 13 base cards are visible again
```

---

## Scenario: User previews a base before choosing

```
Given the catalog is showing all bases
When the developer clicks on the "Editorial Burgundy" card
Then the card expands to show:
  • A token palette sidebar with:
    • Color swatches: surface, text, accent, border
    • Typography samples: display font, body font
    • Shape tokens: radius, spacing
  • A rendered preview iframe showing the base's reference example
  • A "Use as template →" button

When the developer clicks the "Preview" button
Then the expanded view shows a larger iframe (320px height)
And the reference HTML renders with the base's actual design

When the developer hovers over a color swatch
Then they see the CSS variable name and hex value:
  • e.g. "--color-accent: #7a2e1a"
```

---

## Scenario: User customizes colors and fonts

```
Given the developer has expanded "Editorial Burgundy" and clicked "Use as template →"
Then they enter a guided 5-step flow starting at Identity

Step 1 — Identity:
When the developer enters:
  • ID: "my-brand"
  • Name: "My Brand"
And clicks "Next"
Then the preview iframe updates to show "My Brand"

Step 2 — Colors:
When the developer picks accent color "#e63946" using the color picker
And selects "tonal-spot" as the color variant
Then the preview iframe updates:
  • The accent color changes from #7a2e1a to #e63946
  • The surface and text colors adjust tonally

Step 3 — Typography:
When the developer changes:
  • Headline font from "DM Serif Display" to "Inter"
  • Body font from "Inter" to "Inter"
Then the preview iframe updates the font rendering in real time

Step 4 — Shape:
When the developer adjusts the roundness slider from 4px to 12px
Then the preview iframe shows rounder corners on card and button elements

Step 5 — Review:
When the developer sees the summary:
  • Name: My Brand
  • Based on: Editorial Burgundy
  • Accent: #e63946
  • Headline: Inter
  • Body: Inter
  • Roundness: 12px

And clicks "Create Design System"
Then the system is created and immediately applied as active
```

---

## Scenario: User verifies the customized system

```
Given the developer created "my-brand"
When they check the filesystem at design-systems/my-brand/
Then they find:
  • tokens.css with --color-accent: #e63946
  • tokens.css with --font-display: "Inter"
  • tokens.css with --radius: 12px
  • DESIGN.md with the 10-section contract populated from the base

When the developer opens the "System" tab
Then "my-brand" appears in the chip list
And "atelier" still shows as previously active

When the developer clicks "Use this system" on "my-brand"
Then the system switches immediately
And src/active-design-system.css now imports my-brand/tokens.css
And the Storybook Storybook preview re-renders with the new colors

When the developer opens "Showcase" story in Storybook
Then all rendered components use the e63946 accent color
And the Inter font family
And 12px border radius
```

---

## Scenario: User can switch between systems at any time

```
Given the developer has "my-brand" active
When they go to the "System" tab and click the "atelier" chip
Then the atelier detail view loads

When they click "Use this system"
Then the active system switches back to atelier
And src/active-design-system.css now imports atelier/tokens.css
And the Storybook preview re-renders with atelier's b4532a accent

When they switch back to "my-brand"
Then the system returns to my-brand's tokens
```
