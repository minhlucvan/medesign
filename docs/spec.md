# medesign DESIGN.md specification

> The design-system contract. A `DESIGN.md` is what the agent reads as part of its system prompt; its
> richness is the single biggest lever on output quality. This schema is a **compatible superset** of
> open-design's 9-section format — keep the H2 titles and order and their tooling (and their 70+ systems)
> round-trips with ours. medesign adds a token-contract layer and a **`code/` binding** so the same
> contract yields reusable React/Tailwind components, not one-off HTML. See
> [`open-design-analysis.md`](./open-design-analysis.md) for the source analysis.

## Folder layout

```
design-systems/<id>/
  manifest.json        machine metadata (schema, id, name, category, files map)
  DESIGN.md            the contract: frontmatter + H1 + 9 sections (this spec)
  tokens.css           :root custom properties — the token contract (see §Tokens)
  code/                medesign EXTENSION — React/Tailwind primitives + CSF stories
    Button.tsx  Card.tsx  …  index.ts
  components.html       optional standalone fixture (legacy / preview)
  assets/  fonts/  preview/   optional
```

## Front matter (YAML)

Stay within a small YAML subset (scalars, block literals, flat/inline arrays, one nesting level) so a
dependency-free parser can read it.

```yaml
---
name: Atelier
category: Editorial
surface: web            # web | image | video | audio
description: Warm, serif-led editorial system. Generous whitespace, ink-on-paper calm.
version: 1.0.0
colors:                 # role → hex; populates the picker swatch row
  background: "#fbfaf7"
  text: "#1a1714"
  accent: "#b4532a"
---
```

Immediately after the front matter, repeat the identity in markdown (the no-frontmatter fallback path):

```markdown
# Atelier
> Category: Editorial
> Surface: web

A warm, serif-led editorial system — ink-on-paper calm, generous whitespace, one decisive accent.
(≤ 240 chars; this becomes the summary.)
```

## The 9 sections (verbatim H2 titles, in order)

Each section must hit the **quality bar**: exact values (hex/rem/ms), semantic role names (never
`blue-500`), and enforced anti-patterns. Vague prose produces vague UI.

1. **`## 1. Visual Theme & Atmosphere`** — the felt experience + foundational palette in one paragraph
   (e.g. "near-black canvas `#08090a`; ultra-thin translucent borders; calm, engineered").
2. **`## 2. Color`** — every role with exact values. Declare swatches in a parseable form:
   `- **Background:** \`#fbfaf7\`` or a markdown table. Cover surfaces, text tiers, border tiers, accent +
   accent-hover, status (success/warn/danger), and light/dark notes.
3. **`## 3. Typography`** — a full type-scale **table** (role · family · size · weight · line-height ·
   letter-spacing) for 15–25 roles; the display vs body vs mono families; any OpenType features.
4. **`## 4. Spacing`** — base unit (e.g. 8px), the scale, and any micro-adjustments.
5. **`## 5. Layout & Composition`** — grid, container max-width + gutters, section rhythm, whitespace
   philosophy.
6. **`## 6. Components`** — per-component specs **with states**: button (default/hover/active/disabled),
   card, input, badge, etc. Background/text/border/radius/padding for each.
7. **`## 7. Motion & Interaction`** — durations, easings, what animates and what must not.
8. **`## 8. Voice & Brand`** — tone, copy rules, do/don't phrasing, what the brand is *not*.
9. **`## 9. Anti-patterns`** — hard guardrails as a Do/Don't list (e.g. "never pure-white text; never
   weight 700; never indigo gradients"). These map directly to consistency-lint rules.

Optional additive section (ignored by the positional H2 parser, useful to authors):

10. **`## 10. Tokens`** — a human-readable mirror of `tokens.css`, grouped by role.

## Tokens (`tokens.css`)

`tokens.css` is the machine contract — a single `:root` block. medesign's runtime maps semantic Tailwind
classes (`bg-surface`, `text-accent`, `rounded`) to these custom properties, so generated components
reference roles, never raw values. Required role families (superset of open-design's `TOKEN_SCHEMA`):

```css
:root {
  /* color */
  --color-surface: #fbfaf7;  --color-surface-raised: #ffffff;
  --color-text: #1a1714;     --color-text-muted: #6b645c;
  --color-accent: #b4532a;   --color-accent-hover: #8f3f1f;
  --color-border: #e6e1d8;
  /* type */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-display: "Newsreader", Georgia, serif;
  --font-mono: "JetBrains Mono", monospace;
  /* shape / depth / motion / layout */
  --radius: 8px;  --space-unit: 8px;
  --shadow-raised: 0 1px 2px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.05);
  --motion-fast: 120ms;  --ease-standard: cubic-bezier(.2,0,0,1);
  --container-max: 1200px;
}
```

A `tokens.css` is valid when (self-check, enforced by the linter): every required role is declared, no
unknown roles are declared, and every `var(--x)` reference resolves to a declared role.

## `code/` binding (medesign extension)

This is what makes medesign code-first. `code/` holds the design system's **primitives** as React +
Tailwind components that reference only semantic token classes, plus a CSF story per primitive. Generated
and captured components compose these primitives, so they inherit the system by construction. See
[`authoring-design-systems.md`](./authoring-design-systems.md) for the authoring rubric and
[`docs/architecture.md`](./architecture.md) for how the runtime binds tokens.

## Consistency lint (summary)

Generated components are linted against the system before they can pass (full ruleset ported from
open-design's `lint-artifact.ts` + token-contract self-check; see `packages/backend/src/lint/`):

- **P0 (block):** off-token raw hex where a role exists; indigo/purple & blue→cyan gradients; solid
  AI-default-indigo outside token definitions; slop emoji in headings/buttons; rounded-card + colored
  `border-left`; sans-serif headings when a display face is bound; invented metrics; filler copy.
- **P1 (advisory):** ALL-CAPS without adequate `letter-spacing`; external placeholder images; `--accent`
  overuse; too many raw hex outside `:root`.
- **Structural:** all schema tokens present; every `var()` resolves; sections carry stable anchor ids.

A value is exempt when it is the system's declared `--accent` (intentional brand color). Which rules run
is gated per design system via `manifest.craft.applies` / `craft.exemptions`.
