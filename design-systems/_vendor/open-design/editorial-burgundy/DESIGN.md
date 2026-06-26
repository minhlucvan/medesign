---
name: Editorial Burgundy
category: Editorial
surface: web
description: Wine-on-blush editorial — burgundy ink on warm blush paper, a muted-gold accent, serif italics for emphasis.
version: 1.0.0
colors:
  background: "#f8d8de"
  text: "#5a1f2e"
  accent: "#a8842f"
---

# Editorial Burgundy
> Category: Editorial
> Surface: web
> Source: open-design/editorial-burgundy-principles-template — https://github.com/nexu-io/open-design

A salon-deck editorial system: deep burgundy ink set on warm blush paper, with one muted-gold accent and serif italics reserved for emphasis. Premium, literate, and unhurried — manifesto typography over decoration, never a corporate landing page.

## 1. Visual Theme & Atmosphere

Editorial Burgundy reads like the printed program for a design salon: a warm blush canvas (`#f8d8de`), deep wine ink (`#5a1f2e`), and a single muted-gold accent (`#a8842f`) used like gilt — sparingly, on the one element that earns it. The voice is set in a high-contrast serif (Fraunces) for headlines and manifesto numerals, with serif italics (the `em`) carrying every moment of emphasis; body and UI run in Inter. Surfaces are nearly flat: depth comes from wine-tinted hairlines (`rgba(90,31,46,0.18)`) and a soft, low shadow, never heavy drop-shadows or glow. Tags read as rounded pills; principle cards as soft-cornered blocks. The feeling is intimate and confident — generous whitespace, oversized typographic statements, and restraint everywhere the narrative doesn't ask for more. The foundational palette is **wine ink on blush paper, gilded once**.

## 2. Color

Use semantic roles, never raw hex, in components.

| Role | Value | Use |
| --- | --- | --- |
| **Surface** | `#f8d8de` | page background (blush paper) |
| **Surface raised** | `#fcebee` | cards, inputs, raised blocks |
| **Text** | `#5a1f2e` | primary wine ink |
| **Text muted** | `rgba(90,31,46,0.64)` | secondary / meta |
| **Accent** | `#a8842f` | one primary CTA / gilt emphasis |
| **Accent hover** | `#8a6c24` | accent hover/active |
| **Border** | `rgba(90,31,46,0.18)` | hairlines, dividers, input borders |
| **Success** | `#15803d` | positive status |
| **Warn** | `#b45309` | caution status |
| **Danger** | `#b91c1c` | destructive / error |

Light surface only in v1. The muted gold is the accent role for UI affordances; for editorial fills the deep wine (`--color-text`) reads as the second "ink." The accent is precious: **at most two** accent elements per screen.

## 3. Typography

Display is serif (Fraunces); body and UI in Inter; mono for code/labels only. Serif italics (`em`) carry emphasis — never bold-sans for emphasis. Headlines run from large to monumental; numerals can fill a slide.

| Role | Family | Size | Weight | Line-height | Letter-spacing |
| --- | --- | --- | --- | --- | --- |
| Display Mega | display | 120px | 600 | 0.85 | -0.05em |
| Display XL | display | 88px | 600 | 0.90 | -0.04em |
| Display L | display | 62px | 500 | 0.95 | -0.03em |
| Title | display | 44px | 500 | 1.05 | -0.02em |
| Title S | display | 32px | 500 | 1.10 | -0.01em |
| Subtitle | display | 24px | 500 | 1.20 | 0 |
| Card Heading | display | 22px | 600 | 1.15 | -0.01em |
| Lead | sans | 20px | 400 | 1.55 | 0 |
| Body L | sans | 18px | 400 | 1.60 | 0 |
| Body | sans | 16px | 400 | 1.60 | 0 |
| Body S | sans | 14px | 400 | 1.55 | 0 |
| Label | sans | 13px | 600 | 1.30 | 0.02em |
| Pill / Tag | sans | 14px | 700 | 1.00 | 0.01em |
| Kicker / Eyebrow | sans | 12px | 600 | 1.20 | 0.20em (UPPERCASE) |
| Index Caption | sans | 11px | 600 | 1.20 | 0.12em (UPPERCASE) |
| Meta | sans | 11px | 500 | 1.30 | 0.16em (UPPERCASE) |
| Code | mono | 14px | 400 | 1.50 | 0 |
| Code S | mono | 12px | 400 | 1.50 | 0 |

Headlines set in Fraunces — never the sans family on h1–h3. Kickers, index captions, and meta are the only uppercase text and always carry ≥ 0.12em tracking. Emphasis is set in serif italic, never sans-bold.

## 4. Spacing

Base unit **8px** (`--space-unit`). Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Prefer the larger steps for vertical rhythm — this system breathes. Inline gaps 8–16px; stack gaps 16–32px; section padding 96px (`--section-y`). Card padding 18–24px; pill padding 12px/22px.

## 5. Layout & Composition

Container max-width **1180px**, centered, 24px gutters (16px on phone). Single-column, left-aligned reading measure capped at ~64ch for prose. Principle grids use an even 4-column (or 2×4) layout with 14–16px gaps; tag clusters are loosely scattered pills. Sections separated by whitespace (96px), not dividers — a single wine hairline (`--color-border`) is allowed between list rows or beneath a kicker. Asymmetry is welcome: an oversized numeral or title lockup beside a narrow annotation column reads as editorial.

## 6. Components

- **Button (primary):** background `--color-accent`, text `#ffffff`, radius `--radius`, padding 12px/22px, weight 600. Hover/active → `--color-accent-hover`. Focus → `--focus-ring`. Disabled → 45% opacity, no pointer.
- **Button (secondary):** transparent background, `1px solid --color-border`, text `--color-text`, radius `--radius-pill` (toolbar/tag affordance). Hover → background `#fcebee`; active → border `--color-text`. Focus → `--focus-ring`. Disabled → 45% opacity.
- **Card:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius`, padding 24px, shadow `--shadow-raised`. Hover → translateY(-2px) only (no shadow jump). Never a colored left border. Active/focus inherit `--focus-ring` when interactive.
- **Input:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius-sm`, padding 10px/12px, text `--color-text`, placeholder `--color-text-muted`. Hover → border `rgba(90,31,46,0.30)`. Focus → border `--color-accent` + `--focus-ring`. Disabled → 45% opacity. Error → border `--color-danger`.
- **Badge:** pill (`--radius-pill`), 4px/14px padding, 12px weight 700, ≥0.01em tracking. Neutral = `#fcebee` bg / `--color-text` text; accent = `--color-accent` bg / white text (use sparingly, ≤2 per screen). No hover state by default; disabled = 45% opacity.
- **Heading:** family `--font-display` (Fraunces), weight 500–600 per the type scale, color `--color-text`. Emphasis spans set in serif italic and may take `--color-accent`. Never sans, never uppercase (kickers excepted). No interactive states.
- **Stack:** layout primitive — vertical/horizontal flex with token gaps from the spacing scale (default 16px). No color, border, or shadow of its own; purely rhythm. No interactive states.

## 7. Motion & Interaction

Fast and quiet. Hover/focus transitions `--motion-fast` (120ms) on color and box-shadow only. Card lift uses a 200ms transform translateY(-2px), nothing more. Slide/section entrances `--motion-base` (220ms) with `--ease-standard`. No bounce, no parallax, no auto-playing motion, no glow. Respect `prefers-reduced-motion`.

## 8. Voice & Brand

Literate, intimate, confident — like a salon program written by an editor, not a marketer. Short declarative sentences; principles "loosely held." No hype, no growth-hacking metrics, no emoji. Title case for headings, sentence case for body; kickers and meta in uppercase. The brand is premium editorial restraint; it is *not* a SaaS landing page, *not* a pitch deck of superlatives.

## 9. Anti-patterns

**Do**
- Use Fraunces for h1–h3 and Inter for everything else. *(sans-display)*
- Keep the gold accent to ≤ 2 elements per screen. *(accent-overuse)*
- Use wine hairlines + the soft shadow for depth.
- Set emphasis in serif italic; leave generous whitespace.
- Reference token roles in components, never raw hex. *(off-token-color)*

**Don't**
- ❌ Use indigo/violet/purple or any blue→cyan "trust" gradient — wine + gold only. *(ai-default-indigo, purple-gradient, trust-gradient)*
- ❌ Put the sans family on headings or use sans-bold for emphasis. *(sans-display)*
- ❌ Overuse the gold accent or apply it to more than two elements. *(accent-overuse)*
- ❌ Use a card with a colored left border, or heavy drop-shadows/glow.
- ❌ Use emoji as icons. *(emoji-icon)*
- ❌ Invent metrics ("10× faster", "99.9% uptime") or ship filler copy ("Feature one"). *(invented-metric, filler-copy)*
- ❌ Pull in external/stock imagery as decoration. *(external-image)*
- ❌ Use raw hex in components — reference the token roles. *(off-token-color)*

## 10. Tokens

See `tokens.css` for the machine contract (`:root` custom properties for every role above).
