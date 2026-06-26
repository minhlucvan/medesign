---
name: Deck — Open Slide Canvas
category: Deck
surface: web
description: Locked 1920×1080 deep-space canvas — midnight ground, crisp light type, one sky-blue accent, free per-slide composition with a single visual focus.
version: 1.0.0
colors:
  surface: "#0a0e1a"
  text: "#f5f5f7"
  accent: "#5ac8fa"
---

# Deck — Open Slide Canvas
> Category: Deck
> Surface: web
> Source: open-design/deck-open-slide-canvas — https://github.com/nexu-io/open-design

A locked 1920×1080 deck on a deep midnight ground (Sea Indigo), with crisp near-white type and one sky-blue accent. No fixed template — each slide is composed freely like a React component, but always around a single visual focus.

## 1. Visual Theme & Atmosphere

Open Slide Canvas is a fixed 1920×1080 stage scaled to fit the viewport — a deep-space deck where each page is composed from scratch rather than poured into a template. The ground is midnight (`#0a0e1a`), the type is crisp near-white (`#f5f5f7`), and a single sky-blue accent (`#5ac8fa`) marks the one thing that matters on a slide. The constraint is the design: a strict type scale, three padding stops, one accent, and an absolute ban on overflow — every page must *fit*, no scrollbars, ever. Freedom lives inside that frame — cover, question, quote, image-text, three- or five-column, data cards, full-bleed image — but each slide obeys one rule: a single visual hierarchy. One sentence, one number, or one image is the hero; nothing competes. Fixed corner marks (`№N/M` bottom-right, deck title bottom-left) and inline-drawn SVG art keep it self-contained and precise. Calm, spacious, modern — a designer's canvas, not a slide template.

## 2. Color

Use semantic roles, never raw hex. This is a **dark** system — surface is midnight, text is near-white, the accent is a single sky-blue.

| Role | Value | Use |
| --- | --- | --- |
| **Surface** | `#0a0e1a` | page ground (deep midnight) |
| **Surface raised** | `#11172a` | data cards, raised panels |
| **Text** | `#f5f5f7` | primary type (near-white) |
| **Text muted** | `rgba(245,245,247,0.62)` | captions, labels, corner marks |
| **Accent** | `#5ac8fa` | the one sky-blue focus per slide |
| **Accent hover** | `#3bb6ef` | accent hover / active |
| **Border** | `rgba(245,245,247,0.14)` | hairline seams, card borders, dividers |
| **Success** | `#15803d` | functional status only |
| **Warn** | `#b45309` | functional status only |
| **Danger** | `#b91c1c` | destructive / error |

One accent only — no rainbow, no second hue. The accent marks the single hierarchy element; everything else is the near-white/midnight monochrome. A slide carries **at most two** accent elements.

## 3. Typography

Display is Inter Tight (or Source Serif Pro in editorial mode); body is Inter; CJK uses Noto Sans/Serif SC — never mix sans + serif within a deck. The locked canvas uses a fixed px type scale. Mono (JetBrains Mono) for data, timestamps, corner marks.

| Role | Family | Size | Weight | Line-height | Tracking |
| --- | --- | --- | --- | --- | --- |
| Display 5xl | display | 220px | 700 | 0.95 | -0.02em |
| Display 4xl | display | 160px | 700 | 0.98 | -0.02em |
| Display 3xl | display | 120px | 600 | 1.0 | -0.015em |
| Display 2xl | display | 88px | 600 | 1.02 | -0.01em |
| Display xl | display | 64px | 600 | 1.05 | -0.01em |
| Heading lg | display | 48px | 600 | 1.1 | 0 |
| Heading md | display | 36px | 500 | 1.2 | 0 |
| Subhead sm | sans | 28px | 500 | 1.3 | 0 |
| Body L | sans | 22px | 400 | 1.5 | 0 |
| Body | sans | 18px | 400 | 1.55 | 0 |
| Label | sans | 18px | 500 | 1.3 | 0.04em |
| Kicker | sans | 18px | 600 | 1.2 | 0.16em (UPPERCASE) |
| Corner Mark | mono | 18px | 500 | 1.2 | 0.08em |
| Data Big | mono | 64px | 600 | 1.0 | 0 |
| Data | mono | 22px | 500 | 1.4 | 0 |

The canvas scale (px): `2xs 18 · xs 22 · sm 28 · md 36 · lg 48 · xl 64 · 2xl 88 · 3xl 120 · 4xl 160 · 5xl 220`. Display sets large and tight; headlines use Inter Tight (the deliberate sans display means `sans-display` is exempt for this system). Uppercase only for kickers, at ≥ 0.16em.

## 4. Spacing

Base unit **8px** (`--space-unit`). Slide padding lands on exactly one of three stops: **96 / 128 / 160px**. Inner scale: 8, 16, 24, 32, 48, 64, 96, 128, 160. Column gaps 32–64px. Generosity is mandatory — the single hierarchy element needs air. `--section-y` = 96px.

## 5. Layout & Composition

Each slide is `<section class="slide" data-slide-id="N">`, strictly `1920×1080`, scaled to the viewport via `transform: scale(...)` (default ~0.7, centered) — **never** any overflow or scrollbar. Layout is free per slide (cover / question / quote / image-text / 3-col / 5-col / list / data cards / full-bleed) chosen by content, but governed by one rule: exactly one visual focus. Never two equal paragraphs side by side — parallel content goes into a 3-column equal-weight grid. Fixed corner marks: `№N/M` bottom-right, deck title bottom-left. Imagery is inline SVG / CSS, never an external URL. Single-file HTML, Tailwind CDN.

## 6. Components

Reuse the atelier primitives (Button, Card, Input, Badge, Heading, Stack). On midnight, borders are white-alpha and the focus ring is sky-blue.

- **Button (primary):** background `--color-accent` (sky-blue), text `#0a0e1a`, radius `--radius`, padding 12px/24px, weight 600. Hover → `--color-accent-hover`. Active → translateY(1px). Disabled → 40% opacity. Focus → `--focus-ring` (sky-blue ring). Decks lean on keyboard nav over buttons.
- **Button (secondary):** transparent, `1px solid --color-border`, text `--color-text`. Hover → background `rgba(245,245,247,0.06)`. Focus → `--focus-ring`.
- **Card:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius`, shadow `--shadow-raised` (reads as a soft lift on midnight). Used for data cards; never a colored left border.
- **Input:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius-sm`, padding 12px/16px, text `--color-text`, placeholder `--color-text-muted`. Focus → border `--color-accent` + `--focus-ring`.
- **Badge:** pill (`--radius-pill`), 4px/12px padding, 14px weight 600, uppercase 0.12em, `1px solid --color-border`. Neutral = muted text; accent = `--color-accent` text on transparent.
- **Heading:** Inter Tight display, weights 500–700, tight tracking per the scale.
- **Stack:** vertical rhythm on the spacing scale; default gap 32px on-canvas.

## 7. Motion & Interaction

Slide-deck motion, kept minimal. Keyboard ← / → advance with hash sync; transitions are quick cross-fades over `--motion-base` (220ms) with `--ease-standard`. Hover/focus on `--motion-fast` (120ms), color and border only. No parallax, no autoplay, no decorative loops — the constraint is stillness so the single focus lands. Honor `prefers-reduced-motion` — instant cuts.

## 8. Voice & Brand

Spare, precise, modern — a designer presenting, not a marketer pitching. One idea per slide, stated cleanly. Sentence case for body; tight display headlines; uppercase only for kickers. Real content and real data only — no lorem, no invented numbers, no emoji decoration. The brand is a disciplined free canvas — it is *not* a busy corporate template, a rainbow gradient deck, or an overflowing wall of bullets.

## 9. Anti-patterns

**Do**
- Give every slide exactly one visual focus; route parallel content into an equal-weight grid.
- Keep to one sky-blue accent, ≤ 2 elements per slide (`accent-overuse`).
- Reference token roles for every color; draw imagery as inline SVG / CSS (`off-token-color`).
- Respect the locked 1920×1080 canvas and the 96/128/160 padding stops — never overflow.

**Don't**
- ❌ Indigo/violet/purple or blue→cyan gradients, or any rainbow of hues — one solid sky-blue accent (`purple-gradient`, `trust-gradient`, `ai-default-indigo`).
- ❌ Generic icon libraries (Lucide/Feather) — write inline SVG.
- ❌ A rounded card with a colored left border (`left-accent-card`).
- ❌ Emoji as decoration, invented metrics, or lorem/filler copy (`emoji-icon`, `invented-metric`, `filler-copy`).
- ❌ External placeholder image URLs (`external-image`).
- ❌ Raw hex in components — reference the token roles (`off-token-color`).

## 10. Tokens

See `tokens.css` for the machine contract (`:root` custom properties for every role above).
