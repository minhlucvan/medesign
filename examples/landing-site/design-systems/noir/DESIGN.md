---
name: Noir
category: Editorial
surface: web
description: Dark editorial system derived from Atelier — near-black canvas, off-white ink, one electric-lime accent.
version: 0.1.0
colors:
  background: "#0f0f10"
  text: "#f4f4f5"
  accent: "#c4f042"
---

# Noir
> Category: Editorial
> Surface: web

A dark editorial system derived from Atelier — a near-black canvas, off-white ink, and one electric-lime accent used sparingly.

## 1. Visual Theme & Atmosphere

Atelier reads like a well-set print magazine: a warm paper canvas (`#fbfaf7`), deep ink text (`#1a1714`), and a single fired-terracotta accent (`#b4532a`) that appears at most twice per screen. Headlines are set in a high-contrast serif (Newsreader); body and UI in Inter. Surfaces are nearly flat — depth comes from hairline `#e6e1d8` borders and a soft, low shadow, never heavy drop-shadows. The feeling is calm, literate, and unhurried: generous whitespace, left-aligned text, no glow, no gradients.

## 2. Color

Use semantic roles, never raw hex, in components.

| Role | Value | Use |
| --- | --- | --- |
| **Surface** | `#fbfaf7` | page background (paper) |
| **Surface raised** | `#ffffff` | cards, inputs, raised blocks |
| **Text** | `#1a1714` | primary ink |
| **Text muted** | `#6b645c` | secondary / meta |
| **Accent** | `#b4532a` | one primary CTA / link emphasis |
| **Accent hover** | `#8f3f1f` | accent hover/active |
| **Border** | `#e6e1d8` | hairlines, dividers, input borders |
| **Success** | `#3f6b42` | positive status |
| **Warn** | `#9a6b1f` | caution status |
| **Danger** | `#963228` | destructive / error |

Light surface only in v1. The accent is precious: a screen has **at most two** accent elements.

## 3. Typography

Display is serif (Newsreader); everything else is Inter. Mono for code/labels only.

| Role | Family | Size | Weight | Line-height | Letter-spacing |
| --- | --- | --- | --- | --- | --- |
| Display XL | display | 60px | 500 | 1.05 | -0.5px |
| Display L | display | 44px | 500 | 1.08 | -0.4px |
| Title | display | 30px | 500 | 1.15 | -0.2px |
| Subtitle | display | 22px | 500 | 1.25 | 0 |
| Body L | sans | 18px | 400 | 1.6 | 0 |
| Body | sans | 16px | 400 | 1.6 | 0 |
| Body S | sans | 14px | 400 | 1.55 | 0 |
| Label | sans | 13px | 500 | 1.3 | 0.02em |
| Eyebrow | sans | 12px | 600 | 1.2 | 0.12em (UPPERCASE) |
| Code | mono | 14px | 400 | 1.5 | 0 |

Headlines set in Newsreader at weight 500 — never use the sans family for h1–h3. Eyebrows are the only uppercase text and always carry ≥ 0.12em tracking.

## 4. Spacing

Base unit **8px**. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Prefer the larger steps for vertical rhythm — Atelier breathes. Inline gaps 8–16px; stack gaps 16–32px; section padding 96px (`--section-y`).

## 5. Layout & Composition

Container max-width **1180px**, centered, 24px gutters (16px on phone). Single-column, left-aligned reading measure capped at ~68ch for prose. Sections separated by whitespace (96px), not dividers. A thin `--color-border` rule is allowed between list rows. Asymmetry is welcome: a wide text column beside a narrow meta column reads as editorial.

## 6. Components

- **Button (primary):** background `--color-accent`, text `#fff`, radius `--radius`, padding 12px/20px, weight 500. Hover → `--color-accent-hover`. Focus → `--focus-ring`. Disabled → 45% opacity, no pointer.
- **Button (secondary):** transparent background, `1px solid --color-border`, text `--color-text`. Hover → background `#f3efe8`.
- **Card:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius`, padding 24px, shadow `--shadow-raised`. Never a colored left border.
- **Input:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius-sm`, padding 10px/12px, text `--color-text`, placeholder `--color-text-muted`. Focus → border `--color-accent` + `--focus-ring`.
- **Badge:** pill (`--radius-pill`), 2px/10px padding, 12px weight 600. Neutral = `#f3efe8` bg / muted text; accent = `--color-accent` bg / white text (use sparingly).

## 7. Motion & Interaction

Fast and quiet. Hover/focus transitions `--motion-fast` (120ms) on color and box-shadow only. Entrances `--motion-base` (220ms) with `--ease-standard`. No bounce, no parallax, no auto-playing motion. Respect `prefers-reduced-motion`.

## 8. Voice & Brand

Literate, precise, confident — like an editor, not a marketer. Short declarative sentences. No hype, no growth-hacking metrics, no emoji. Title case for headings, sentence case for body. The brand is calm expertise; it is *not* a startup landing page.

## 9. Anti-patterns

**Do**
- Use Newsreader for h1–h3 and Inter for everything else.
- Keep accent to ≤ 2 elements per screen.
- Use hairline borders + the soft shadow for depth.
- Leave generous whitespace.

**Don't**
- ❌ Use indigo/violet/purple or blue→cyan gradients (not this system — terracotta only).
- ❌ Put the sans family on headings.
- ❌ Use rounded cards with a colored left border.
- ❌ Use emoji as icons, invented metrics ("10× faster", "99.9% uptime"), or filler copy ("Feature one").
- ❌ Use raw hex in components — reference the token roles.

## 10. Tokens

See `tokens.css` for the machine contract (`:root` custom properties for every role above).
