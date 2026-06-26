---
name: After Hours
category: Editorial
surface: web
description: Near-black nocturnal editorial — violet-white serif type, one hot-pink accent under glow, fine 1px seams, film-grain depth.
version: 1.0.0
colors:
  surface: "#0a090f"
  text: "#f4f1f6"
  accent: "#ff4ea2"
---

# After Hours
> Category: Editorial
> Surface: web
> Source: open-design/after-hours-editorial-template — https://github.com/nexu-io/open-design

A near-black, after-midnight editorial system: violet-tinted white set in a high-contrast italic serif, one hot-pink accent used under glow, hairline frame seams, and cinematic film-grain depth. Couture title-card, not a dashboard.

## 1. Visual Theme & Atmosphere

After Hours reads like the title card of a haute-couture film: the lights are down, a single magenta sign hums in the dark. The ground is a near-black `#0a090f` lifted at center by a soft radial glow (`#1c1823` → `#0d0b12` → `#08070d`), so the page feels like a lit stage rather than a flat panel. Type is violet-white (`#f4f1f6`) and overwhelmingly serif — Cormorant Garamond, often italic, set huge and tight. The accent is one hot pink (`#ff4ea2`), and it is precious: a numeral, a rule, a single word, always carrying a faint `text-shadow` glow so it reads as neon rather than ink. Structure is drawn with 1px seams the color of charcoal (`#26232d`) — a thin inset frame, a top HUD row in wide-tracked uppercase, a folio bottom-right. Over everything sits a low film grain and a vignette that darkens the corners. The mood is slow, expensive, and nocturnal: nothing blinks, nothing is bright, one thing glows.

## 2. Color

Use semantic roles, never raw hex, in components. This is a dark system — surface is near-black, text is near-white.

| Role | Value | Use |
| --- | --- | --- |
| **Surface** | `#0a090f` | page ground (near-black, radial-lit at center) |
| **Surface raised** | `#15131c` | cards, raised blocks, HUD chrome |
| **Text** | `#f4f1f6` | primary type (violet-white) |
| **Text muted** | `#8f8698` | meta, kickers, HUD labels |
| **Accent** | `#ff4ea2` | one hot-pink emphasis per screen, under glow |
| **Accent hover** | `#e23b8c` | accent hover / active |
| **Border** | `#26232d` | hairline frame, seams, dividers, input borders |
| **Success** | `#15803d` | positive status only |
| **Warn** | `#b45309` | caution status only |
| **Danger** | `#b91c1c` | destructive / error |

The accent glows: pair it with `text-shadow: 0 0 38px #ff4ea240` on display and `0 0 20px` on rules. Status colors are functional, never decorative. A screen carries **at most two** accent elements.

## 3. Typography

Display is a high-contrast serif (Cormorant Garamond), frequently italic and set very large. UI labels, HUD, meta and the folio are Inter, uppercase, widely tracked. Mono for timestamps/data only.

| Role | Family | Size | Weight | Line-height | Tracking |
| --- | --- | --- | --- | --- | --- |
| Display Hero | display | 156px | 600 | 0.82 | 0.01em |
| Chapter Numeral | display | 120px | 500 | 0.80 | 0 |
| Display XL | display | 90px | 600 | 0.82 | 0 |
| Display L | display | 64px | 500 | 0.9 | 0 |
| Quote | display (italic) | 48px | 600 | 0.95 | 0 |
| Title | display | 36px | 600 | 1.05 | 0 |
| Subtitle | display (italic) | 26px | 500 | 1.2 | 0 |
| Lead | display (italic) | 22px | 500 | 1.25 | 0 |
| Body L | sans | 18px | 400 | 1.6 | 0 |
| Body | sans | 16px | 400 | 1.6 | 0 |
| Body S | sans | 14px | 400 | 1.55 | 0 |
| Meta | sans | 13px | 500 | 1.4 | 0.24em (UPPERCASE) |
| HUD Label | sans | 12px | 600 | 1.2 | 0.28em (UPPERCASE) |
| Kicker | sans | 12px | 600 | 1.3 | 0.36em (UPPERCASE) |
| Folio | sans | 13px | 700 | 1.2 | 0.22em |
| Code | mono | 13px | 400 | 1.5 | 0 |

Headlines, numerals, pull-quotes and leads are always serif — never set h1–h3 in Inter. Italic serif is a signature, not an accident. Uppercase is reserved for kickers, HUD, meta and folio, always with ≥ 0.24em tracking.

## 4. Spacing

Base unit **8px** (`--space-unit`). Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. The system is cinematic — prefer the large steps. Inline gaps 8–16px; stack gaps 16–32px; section padding 96px (`--section-y`). The inset frame sits ~18px from the page edge; the HUD row clears 32px from the top.

## 5. Layout & Composition

Stage-framed and centered. Content lives inside a 1px inset frame (`--color-border`) ~18px from the edge, with a fixed HUD row top and a folio bottom-right — the page is treated as one composed plate. Container max-width **1180px** for prose contexts; full-bleed for hero plates. A single visual focus per screen: one giant serif line, one numeral, or one image — never two equal blocks. Asymmetry and vertical chapter tags (writing-mode: vertical-rl, wide-tracked uppercase) are welcome. Depth comes from the center radial glow, the vignette, and grain — not from stacked shadows.

## 6. Components

Reuse the atelier primitives (Button, Card, Input, Badge, Heading, Stack). On this dark ground, focus rings and seams must read against near-black.

- **Button (primary):** background `--color-accent`, text `#0a090f`, radius `--radius`, padding 12px/22px, weight 600. Hover → `--color-accent-hover`. Active → translateY(1px). Disabled → 40% opacity, no pointer. Focus → `--focus-ring` (pink glow ring). At most one primary per screen.
- **Button (secondary):** transparent background, `1px solid --color-border`, text `--color-text`. Hover → border lightens toward `#3a3644`, background `#15131c`. Focus → `--focus-ring`.
- **Card:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius`, padding 24px, shadow `--shadow-raised`. Depth is the soft shadow on near-black, never a colored left border.
- **Input:** background `#0d0b12`, `1px solid --color-border`, radius `--radius-sm`, padding 10px/12px, text `--color-text`, placeholder `--color-text-muted`. Focus → border `--color-accent` + `--focus-ring`. Disabled → 45% opacity.
- **Badge:** pill (`--radius-pill`), 2px/10px padding, 12px weight 600, uppercase 0.12em. Neutral = `#15131c` bg / `--color-text-muted`. Accent = `--color-accent` bg / `#0a090f` text (used sparingly, under glow).
- **Heading:** display family, weights 500–600, tight line-heights per the scale. Never sans.
- **Stack:** vertical rhythm via the spacing scale; default gap 24px; section blocks 96px.

## 7. Motion & Interaction

Cinematic but restrained. Page entrances stage text in a reveal hierarchy (kicker → display → meta) over `--motion-base` (220ms) with `--ease-standard`; chapter changes use a multi-column wipe. Hover/focus transitions `--motion-fast` (120ms) on color, border and box-shadow only. A single cursor-follow glow (low opacity, `pointer-events:none`) is the only ambient interaction. No bounce, no parallax on body copy, no autoplay loops beyond the deck timeline. Honor `prefers-reduced-motion`: drop the wipe and glow, keep a simple fade.

## 8. Voice & Brand

Editorial and assured, like a fashion masthead — short, evocative, a little nocturnal. Title or display case for headlines; sentence case for body; UPPERCASE only for kickers/HUD/folio. No hype, no growth metrics, no emoji. The brand is a couture title card and a midnight magazine spread — it is *not* a SaaS landing page, a neon cyberpunk poster, or a dashboard.

## 9. Anti-patterns

**Do**
- Set h1–h3, numerals and pull-quotes in the serif display face (`sans-display`).
- Keep the accent to ≤ 2 elements per screen, under glow (`accent-overuse`).
- Reference token roles for every color; let the glow and grain carry mood (`off-token-color`).
- Build depth from the radial ground, vignette, grain and hairline seams.

**Don't**
- ❌ Indigo/violet/purple or blue→cyan gradients — the accent is one solid hot pink, never a gradient (`purple-gradient`, `trust-gradient`, `ai-default-indigo`).
- ❌ Sans-serif on headings, numerals or quotes — serif display only (`sans-display`).
- ❌ A rounded card with a colored left border (`left-accent-card`).
- ❌ Emoji as icons, invented metrics ("10× faster", "99.9% uptime"), or filler copy ("Feature one") (`emoji-icon`, `invented-metric`, `filler-copy`).
- ❌ External placeholder images — draw with CSS/inline SVG or use a neutral plate (`external-image`).
- ❌ Raw hex in components — reference the token roles (`off-token-color`).

## 10. Tokens

See `tokens.css` for the machine contract (`:root` custom properties for every role above).
