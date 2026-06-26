---
name: Stitch
category: Product
surface: web
description: Balanced premium product system — zinc neutrals, one calibrated blue accent, Geist type, weight-driven hierarchy, spring motion.
version: 1.0.0
colors:
  surface: "#ffffff"
  text: "#18181b"
  accent: "#3b82f6"
---

# Stitch
> Category: Product
> Surface: web
> Source: open-design/stitch-skill — https://github.com/Leonxlnx/taste-skill

Balanced, premium product system — absolute zinc neutrals, one calibrated blue accent (saturation < 80%), Geist sans + mono, weight-driven hierarchy, and asymmetric layouts with spring-physics micro-motion. Anti-generic by construction.

## 1. Visual Theme & Atmosphere

Stitch is a daily-app product system tuned to a balanced taste profile — **density 4 (balanced), variance 8 (confidently asymmetric), motion 6 (fluid CSS spring)**. The atmosphere is clinical yet warm: a clean zinc neutral base (`#ffffff` canvas, `#f9fafb` surfaces, `#18181b` charcoal ink) with exactly one calibrated accent, a controlled blue (`#3b82f6`) used only for the single most important action and active states. Never pure black, never the "AI purple/blue neon" aesthetic — no purple button glows, no neon gradients, no oversaturated accents. Hierarchy is driven by **weight and color**, not by screaming type size. Layouts are asymmetric by default (split-screen and left-aligned heroes, zig-zag feature rows — never centered, never three equal cards). Elevation is used sparingly and only when it communicates hierarchy; shadows are diffuse and tinted to the background hue, with no outer glow. Motion is everywhere but quiet — spring physics for interactions, staggered cascade reveals, and restrained perpetual micro-loops.

Foundational palette: canvas white `#ffffff`, surface `#f9fafb`, charcoal `#18181b`, muted steel `#71717a`, whisper border `#e5e7eb`, accent blue `#3b82f6`.

## 2. Color

Components reference semantic roles only. Maximum one accent; saturation < 80%; never pure black; never purple/neon.

| Role | Value | Use |
| --- | --- | --- |
| **Surface** | `#ffffff` | page canvas |
| **Surface raised** | `#f9fafb` | cards, containers, raised fills |
| **Text** | `#18181b` | charcoal ink (zinc-950) — primary text, headings |
| **Text muted** | `#71717a` | muted steel — secondary text, metadata, captions |
| **Accent** | `#3b82f6` | the single accent — primary CTA, active state, focus ring |
| **Accent hover** | `#2563eb` | depressed/active accent |
| **Border** | `#e5e7eb` | whisper hairlines, 1px structural lines, card edges |
| **Success** | `#10b981` | positive status (emerald) |
| **Warn** | `#f59e0b` | caution status (amber) |
| **Danger** | `#e11d48` | error/destructive status (rose) |

Charcoal `#18181b` on white clears WCAG AAA; muted steel on white clears AA for secondary text. Accent blue is used as a solid fill, never inside a blue→cyan gradient. One palette throughout — no warm/cool gray fluctuation.

## 3. Typography

Geist for display and body, Geist Mono for code, metadata, timestamps, and high-density numbers. **Inter is banned** for premium contexts; generic serifs are banned in product/dashboard UIs entirely. Display is track-tight and weight-driven, not oversized; body runs at relaxed leading capped near 65ch.

| Role | Family | Size | Weight | Line-height | Tracking | Case |
| --- | --- | --- | --- | --- | --- | --- |
| Display XL | display | 60px | 600 | 1.05 | -0.03em | sentence |
| Display L | display | 48px | 600 | 1.08 | -0.025em | sentence |
| Title | display | 36px | 600 | 1.12 | -0.02em | sentence |
| Heading | display | 28px | 600 | 1.2 | -0.015em | sentence |
| Subhead | display | 22px | 500 | 1.3 | -0.01em | sentence |
| Section label | sans | 18px | 600 | 1.35 | 0 | sentence |
| Body L | sans | 18px | 400 | 1.6 | 0 | sentence |
| Body | sans | 16px | 400 | 1.6 | 0 | sentence |
| Body S | sans | 14px | 400 | 1.55 | 0 | sentence |
| Label | sans | 13px | 500 | 1.3 | 0.01em | sentence |
| Button | sans | 15px | 500 | 1.2 | 0 | sentence |
| Eyebrow | sans | 12px | 600 | 1.2 | 0.08em | UPPER |
| Caption | sans | 12px | 400 | 1.45 | 0 | sentence |
| Data / metric | mono | 15px | 500 | 1.3 | 0 | tabular |
| Code | mono | 14px | 400 | 1.55 | 0 | as-is |
| Timestamp | mono | 12px | 400 | 1.4 | 0.02em | as-is |

Headlines scale via `clamp()` and lean on weight + color for hierarchy. When density rises above 7, all numbers use the mono family for tabular alignment. Body minimum is `16px` (never below `14px`).

## 4. Spacing

Base unit **8px**. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Generous internal padding; vertical section gaps scale responsively (`clamp(3rem, 8vw, 6rem)`), anchored at `--section-y` (96px). Standard input gap spacing (label above, helper/error below). Touch targets minimum 44px.

## 5. Layout & Composition

CSS Grid first — never `calc()` percentage math, never overlapping elements (every element owns a clean spatial zone). Container max-width `--container-max` (1180px, up to 1400px for wide product shells), centered. Heroes are asymmetric: split-screen, left-aligned, or asymmetric-whitespace — centered heroes are banned at this variance. The generic "three equal cards in a row" feature block is banned — use a 2-column zig-zag, an asymmetric grid, or horizontal scroll. Full-height sections use `min-h-[100dvh]`, never `h-screen`. Below 768px every multi-column layout collapses to a single column with zero horizontal overflow.

## 6. Components

Reuses the shared atelier primitives (`code/`); the balanced product character comes from the token values. All states below.

- **Button (primary):** background `--color-accent`, text `#fff`, radius `--radius` (8px), padding 12px/20px, weight 500, flat (no outer glow). Hover → `--color-accent-hover`. Active → tactile `translateY(1px)` push. Focus → `--focus-ring`. Disabled → 45% opacity, `pointer-events:none`. Max one primary CTA per view.
- **Button (secondary / ghost):** transparent background, `1px solid --color-border`, text `--color-text`. Hover → background `--color-surface-raised`. Active → `translateY(1px)`. Focus → `--focus-ring`.
- **Card:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius` (8px), padding 24px, shadow `--shadow-raised` (diffuse, tinted to bg, no glow). Use only when elevation communicates hierarchy; in dense layouts replace cards with border-top dividers or negative space. Never a colored left-only border.
- **Input:** background `#fff`, `1px solid --color-border`, radius `--radius-sm` (5px), padding 10px/12px, text `--color-text`, placeholder `--color-text-muted`. Label above, helper/error below — no floating labels. Focus → border `--color-accent` + `--focus-ring`. Error → `--color-danger` border + inline error text. Disabled → 45% opacity.
- **Badge:** pill (`--radius-pill`), 2px/10px padding, 12px weight 600. Neutral = `--color-surface-raised` bg / `--color-text-muted`; accent = `--color-accent` bg / white text (counts toward the ≤2 accent budget); status badges use `--color-success` / `--color-warn` / `--color-danger`.
- **Heading:** display family (`--font-display`, Geist), weight 600, track-tight. Levels 1–3 step 36 → 28 → 22px. Hierarchy through weight/color, not just size.
- **Stack:** layout primitive on the 8px unit; `gap` in unit multiples.
- **Loading:** skeletal shimmer matching exact layout dimensions — never a generic circular spinner. **Empty states:** composed compositions showing how to populate data, not bare "No data".

## 7. Motion & Interaction

Spring physics by default (`stiffness: 100, damping: 20`) for a premium, weighty feel — no linear easing. Hover/color transitions over `--motion-fast` (120ms); entrances over `--motion-base` (220ms) with `--ease-standard`. Lists and grids never mount instantly — stagger with cascade delays. Restrained perpetual micro-loops (subtle pulse/shimmer) on actively-loading components only. Animate exclusively `transform` and `opacity` — never `top`/`left`/`width`/`height`. Grain/noise on fixed pseudo-elements only. No neon outer glows, no custom mouse cursors. Respect `prefers-reduced-motion`.

## 8. Voice & Brand

Clear, specific, product-grade. Sentence case; plain language that states what a thing does. No emoji. No AI copywriting clichés ("Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer"). No fake round metrics (`99.99%`, `50% faster`). No generic placeholder names ("John Doe", "Acme", "Nexus"). No filler UI text ("Scroll to explore", "Swipe down", bouncing chevrons). The brand is a calibrated, confident product surface — it is **not** a generic SaaS template and **not** an AI-slop landing page.

## 9. Anti-patterns

**Do**
- Keep one calibrated accent (blue, saturation < 80%); spend it on the single most important action.
- Drive hierarchy with weight and color; keep display track-tight.
- Use asymmetric heroes and zig-zag feature rows on CSS Grid.
- Tint shadows to the background; use elevation only when it serves hierarchy.
- Write real, specific product copy.

**Don't**
- Use indigo/violet/purple, neon, or any off-token color → lint `ai-default-indigo`, `off-token-color`.
- Use purple gradients or blue→cyan "trust" gradients → lint `purple-gradient`, `trust-gradient`.
- Use pure black `#000000`, outer-glow shadows, or oversaturated accents.
- Put the body sans on a display heading where the display face is bound → lint `sans-display`.
- Use the accent more than ~twice per screen → lint `accent-overuse` (enforced; no exemption).
- Use emoji as icons → lint `emoji-icon`.
- Invent metrics or write filler / placeholder names → lint `invented-metric`, `filler-copy`.
- Use broken external/Unsplash images → lint `external-image`; prefer local assets or neutral blocks.
- Build centered heroes or three-equal-card rows (banned at this variance).

## 10. Tokens

See `tokens.css` for the machine contract (`:root` custom properties for every role above).
