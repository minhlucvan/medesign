---
name: Deck — Guizang Editorial
category: Deck
surface: web
description: Dark e-ink editorial deck — ink-black ground, warm-paper serif type, one muted-gold accent, square corners, hairline rules, zero gloss.
version: 1.0.0
colors:
  surface: "#0a0a0b"
  text: "#f1efea"
  accent: "#c9b27a"
---

# Deck — Guizang Editorial
> Category: Deck
> Surface: web
> Source: open-design/deck-guizang-editorial — https://github.com/nexu-io/open-design

An inverted e-ink magazine: ink-black ground, warm-paper serif type, and a single muted-gold accent. Printed-matter calm, not tech gloss — square corners, hairline rules, folios, and absolutely no gradients, shadows, or rounded chrome.

## 1. Visual Theme & Atmosphere

Guizang Editorial is a printed magazine pressed onto e-ink and then turned to night: an ink-black canvas (`#0a0a0b`) carrying warm-paper text (`#f1efea`) and one muted antique-gold accent (`#c9b27a`). It is the dark side of a literary spread — the same chapter dividers, big-number grids and pull-quotes you'd find in a well-set journal, but reversed so the paper is the ink. Everything is matte: no gradients, no drop-shadows, no blur, no glow, no rounded "app" chrome. Structure is drawn with single hairline rules in warm charcoal (`#3a382f`) — a thin top rule with the journal logo and topic, a folio (`01 / 12`) bottom-right, a kicker in 11px tracked uppercase above each headline. Display is a high-contrast serif (Fraunces, in the Playfair lineage) set very large; numerals occasionally go italic serif for an editorial wink. The mood is unhurried, literate and tactile — paper-and-press gravity, never a dashboard.

## 2. Color

Use semantic roles, never raw hex. This is a **dark e-ink** system — surface is ink-black, text is warm paper, the accent is a single muted gold.

| Role | Value | Use |
| --- | --- | --- |
| **Surface** | `#0a0a0b` | page ground (ink-black) |
| **Surface raised** | `#17160f` | act-divider reverse blocks, raised panels (warm near-black) |
| **Text** | `#f1efea` | primary type (warm paper) |
| **Text muted** | `#6b665b` | kickers, captions, folio, annotations |
| **Accent** | `#c9b27a` | one muted-gold emphasis — a numeral, a rule, a callout |
| **Accent hover** | `#b59c63` | accent hover / active |
| **Border** | `#3a382f` | hairline rules, dividers, grid seams, input borders |
| **Success** | `#15803d` | functional status only |
| **Warn** | `#b45309` | functional status only |
| **Danger** | `#b91c1c` | destructive / error |

The accent is matte gold, never metallic or glowing. Reverse blocks (Act Divider) swap ground and text — paper field with ink type — using `--color-surface-raised`/`--color-text`. A screen carries **at most two** accent elements.

## 3. Typography

Display is a high-contrast serif (Fraunces / Playfair Display; Noto Serif SC for CJK). Body is a clean sans (Inter / Noto Sans SC). Never mix a third family. Numerals may go italic serif. Mono for data/timestamps only.

| Role | Family | Size | Weight | Line-height | Tracking |
| --- | --- | --- | --- | --- | --- |
| Act Headline | display | 9vw (~150px) | 600 | 0.95 | -0.01em |
| Hero | display | 88px | 600 | 1.0 | -0.01em |
| Big Quote | display (italic) | 64px | 600 | 1.05 | 0 |
| Display L | display | 56px | 500 | 1.05 | 0 |
| Big Number | display (italic) | 80px | 500 | 0.95 | 0 |
| Title | display | 40px | 600 | 1.1 | 0 |
| Subtitle | display | 28px | 500 | 1.2 | 0 |
| Lead | display | 22px | 500 | 1.3 | 0 |
| Body L | sans | 18px | 400 | 1.6 | 0 |
| Body | sans | 16px | 400 | 1.6 | 0 |
| Body S | sans | 14px | 400 | 1.55 | 0 |
| Callout | sans | 15px | 500 | 1.5 | 0 |
| Label | sans | 13px | 500 | 1.3 | 0.02em |
| Kicker | sans | 11px | 600 | 1.2 | 0.12em (UPPERCASE) |
| Folio | sans | 12px | 500 | 1.2 | 0.1em |
| Code / Data | mono | 13px | 400 | 1.5 | 0 |

Headlines, pull-quotes and big numbers are always serif — never set h1–h3 in the sans body face. Kickers are 11px uppercase at 0.12em and label every major headline. Italic serif is reserved for numerals and quotes.

## 4. Spacing

Base unit **8px** (`--space-unit`). Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Print rhythm — vertical generosity between blocks, tight measure within. Slide padding lands on a print margin of 64–96px; grid gutters 24–34px; the top rule clears ~32px; the folio sits ~38px from the bottom-right. Section padding `--section-y` = 96px.

## 5. Layout & Composition

16:9 horizontal deck built from a reusable pool of editorial layouts (Hero Cover, Act Divider, Big Numbers Grid, Quote + Image, Image Grid, Pipeline/Flow, Hero Question, Big Quote, Before/After, Mixed Media). Every page is framed by a thin top hairline rule (logo · topic) and a bottom-right folio. One visual focus per slide — a single giant line, one numeral, one image — never two equal text blocks; parallel content goes into an equal-weight grid. Image grids hold a strict uniform height. Quote-plus-image aligns to the baseline, not the top. Act dividers may reverse ink↔paper. Imagery is drawn in pure CSS / inline SVG (color blocks + simple line work) — never an external photo URL.

## 6. Components

Reuse the atelier primitives (Button, Card, Input, Badge, Heading, Stack). Corners are near-square (`--radius` = 4px) and depth is drawn with hairlines, never shadow — on dark grounds the focus ring is gold.

- **Button (primary):** background `--color-accent` (gold), text `#0a0a0b`, radius `--radius` (square-ish), padding 10px/20px, weight 600. Hover → `--color-accent-hover`. Active → translateY(1px). Disabled → 40% opacity. Focus → `--focus-ring` (gold ring). Decks rarely need buttons — prefer keyboard nav.
- **Button (secondary):** transparent, `1px solid --color-border`, text `--color-text`. Hover → border toward `#4a473c`. Focus → `--focus-ring`.
- **Card:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius`. **No shadow, no rounded glow** — depth is the hairline. Never a colored left border.
- **Input:** background `--color-surface`, `1px solid --color-border`, radius `--radius-sm`, padding 10px/12px, text `--color-text`, placeholder `--color-text-muted`. Focus → border `--color-accent` + `--focus-ring`.
- **Badge:** near-square (`--radius-sm`, not pill in deck context), 2px/10px padding, 11px weight 600, uppercase 0.12em. Neutral = transparent / `--color-text-muted` with hairline border; accent = `--color-accent` text on transparent.
- **Heading:** serif display, weights 500–600, tight line-heights per the scale. Never the sans body face.
- **Stack:** vertical rhythm on the spacing scale; default gap 24px; section blocks 96px.

## 7. Motion & Interaction

Page-turn, not animation reel. Keyboard ← / → advance slides with hash sync; Pipeline/Flow steps reveal one numbered step at a time. Transitions are quiet cross-fades or hard cuts over `--motion-base` (220ms) with `--ease-standard`; hover/focus on `--motion-fast` (120ms), color and border only. No parallax, no gradients-in-motion, no autoplay. Honor `prefers-reduced-motion` — fall back to instant cuts.

## 8. Voice & Brand

Literate, opinionated, personal — a writer's voice, not a vendor's. Narrative and viewpoint over feature lists. Sentence case for body; display case for headlines; UPPERCASE only for kickers and folios. Real content and real data only. No hype, no emoji, no fabricated numbers. The brand is print-and-ink editorial gravity — it is *not* a tech-gloss SaaS deck, a neon poster, or a gradient-heavy pitch.

## 9. Anti-patterns

**Do**
- Set h1–h3, quotes and big numbers in the serif display face (`sans-display`).
- Keep the accent to ≤ 2 muted-gold elements per slide (`accent-overuse`).
- Reference token roles for every color; draw depth with hairline rules (`off-token-color`).
- Use real content and real numbers; render imagery as CSS / inline SVG.

**Don't**
- ❌ Gradients of any kind, including indigo/violet/purple or blue→cyan (`purple-gradient`, `trust-gradient`, `ai-default-indigo`) — this system is matte, flat ink.
- ❌ Drop-shadows, blur, glow, or rounded "app" chrome — corners are near-square, depth is a hairline.
- ❌ Sans-serif on headings, quotes or big numbers (`sans-display`).
- ❌ A rounded card with a colored left border (`left-accent-card`).
- ❌ Emoji as icons or decoration, invented metrics, or lorem/filler copy (`emoji-icon`, `invented-metric`, `filler-copy`).
- ❌ External placeholder image URLs — draw with CSS / inline SVG (`external-image`).
- ❌ Raw hex in components — reference the token roles (`off-token-color`).

## 10. Tokens

See `tokens.css` for the machine contract (`:root` custom properties for every role above).
