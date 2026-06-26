---
name: Digits Fintech Swiss
category: Fintech
surface: web
description: Swiss fintech — bone paper, ink-black type, electric-lime fills, hairline grid, monumental numerals.
version: 1.0.0
colors:
  surface: "#f2f2ed"
  text: "#0a0a0a"
  accent: "#0a0a0a"
  highlight: "#e2ff41"
---

# Digits Fintech Swiss
> Category: Fintech
> Surface: web
> Source: open-design/digits-fintech-swiss-template — https://github.com/nexu-io/open-design

Swiss-grid data storytelling: bone paper, ink-black type, and electric-lime fields. Numbers are the hero — set monumental, weight 900, tracked tight. Hairline borders, zero radius, no shadows, no decoration.

## 1. Visual Theme & Atmosphere

Digits is a fintech operating language built on the Swiss International grid: a calm **bone-paper** stage (`#f2f2ed`), **ink** type (`#0a0a0a`), and one charged signal — **electric lime** (`#e2ff41`) deployed as full-bleed color *fields*, never as ink. The mood is cold, exact, and numeric. Metrics dominate: figures are set at 42–122px, weight 900, with negative tracking, so a single panel reads like a ticker. Structure comes from **1px hairline rules** and flat color planes — there are no drop shadows, no gradients (a single radial vignette on portrait panels is the only exception), no rounded corners. Black portrait/diagram panels (ink fill, paper text) and lime fields alternate against the paper to build a hard, editorial rhythm. The feeling: a Bloomberg terminal redrawn by Müller-Brockmann.

Foundational palette: paper `#f2f2ed`, ink `#0a0a0a`, lime `#e2ff41`, white card `#ffffff`, hairline `rgba(10,10,10,.12)`.

## 2. Color

Use semantic roles, never raw hex, in components.

| Role | Value | Use |
| --- | --- | --- |
| **Surface** | `#f2f2ed` | page / stage (bone paper) |
| **Surface raised** | `#ffffff` | metric cards, inputs, raised blocks |
| **Text** | `#0a0a0a` | primary ink (type, figures, hairlines on white) |
| **Text muted** | `rgba(10,10,10,0.60)` | kickers, tags, meta, units |
| **Accent** | `#0a0a0a` | the one decisive action — solid-ink CTA, white text on it |
| **Accent hover** | `#2a2a2a` | accent hover / press (ink lifts to charcoal) |
| **Border** | `rgba(10,10,10,0.12)` | hairline rules, dividers, input borders |
| **Highlight** | `#e2ff41` | electric-lime *fill* — hero panels, big-number fields |
| **Highlight ink** | `#0a0a0a` | type / figures painted on a lime field |
| **Success** | `#15803d` | positive status |
| **Warn** | `#b45309` | caution status |
| **Danger** | `#b91c1c` | destructive / error |

**Lime strategy (read this).** The brand's identity color is electric lime `#e2ff41`, but it is low-contrast on light paper (~1.1:1 as text — unreadable) and unusable under white text. So Digits **does not bind lime to `--color-accent`.** The action color is **ink** (`#0a0a0a`): white text on ink is ~19:1, the most decisive button possible and the most Swiss. Lime lives in a dedicated **`--color-highlight`** role and is **fill-only** — a plane behind ink type (ink-on-lime ≈ 17:1). Lime is never type, never an icon stroke, never a foreground on paper, never paired with white text. Dark panels are the ink role used as a background with paper-colored text. Light surface only in v1.

## 3. Typography

A single grotesk does everything; the *only* axis is size and weight. Display is **Geist** (a precise neo-grotesk); body and UI are **Inter**; **Geist Mono** for tabular figures, codes, and units. Headings and big numbers are display; never a serif. Numerals are the system's voice — set them huge, weight 900, tracked tight.

| Role | Family | Size | Weight | Line-height | Tracking | Case |
| --- | --- | --- | --- | --- | --- | --- |
| Mega numeral | display | 122px | 900 | 0.90 | -0.04em | — |
| Headline | display | 86px | 900 | 0.92 | -0.04em | UPPERCASE |
| Hero figure | display | 72px | 900 | 1.0 | -0.03em | — |
| Display | display | 56px | 900 | 1.02 | -0.03em | UPPERCASE |
| Figure XL | mono | 42px | 900 | 1.0 | -0.03em | tabular |
| Title | display | 30px | 800 | 1.05 | -0.02em | UPPERCASE |
| Subtitle | display | 26px | 700 | 1.05 | -0.01em | UPPERCASE |
| Figure | mono | 24px | 700 | 1.1 | -0.01em | tabular |
| Lead | sans | 20px | 400 | 1.42 | 0 | — |
| Body | sans | 16px | 400 | 1.45 | 0 | — |
| Body S | sans | 14px | 400 | 1.45 | 0 | — |
| Kicker | sans | 11px | 600 | 1.2 | 0.22em | UPPERCASE |
| Tag | sans | 10px | 600 | 1.4 | 0.14em | UPPERCASE |
| Meta | mono | 10px | 500 | 1.5 | 0.18em | UPPERCASE |

Kickers, tags, and meta are the only uppercase text and always carry ≥ 0.14em tracking. Figures and units use the mono face for tabular alignment in cards and rails.

## 4. Spacing

Base unit **8px**. Scale: 4, 8, 12, 14, 16, 24, 32, 48, 64, 96. The grid favours **tight, even gutters** (12–14px between cards, the source's signature) and generous panel padding (24–36px). Inline label gaps 8–12px; stack gaps 12–16px; panel padding 24–36px; section rhythm `--section-y` 64px. Digits is dense, not airy — whitespace is structured by the grid, not by breathing room.

## 5. Layout & Composition

A **12-column modular grid** with **zero gutter collapse** — panels butt against each other and are separated by 1px hairlines or 12–14px gaps, never by shadow. Stage (`--container-max`) is **1400px**, capped at 96vw, framed by a single hairline border. Compositions are **asymmetric column splits**: e.g. `120px · 1fr · 320px` (portrait / headline / copyright), `160px · 1fr · 1fr` (KPI rail / readout / cards), `1fr · 320px` (statement / dot-matrix art). Reading order is left→right, top→bottom; a lime or ink field anchors the eye. Every region is a rectangle of flat color or white, bordered by a hairline. No region floats. Decorative geometry (the 5×5 dot-matrix art) is pure CSS, ink-and-lime, never an image.

## 6. Components

Atelier primitives, re-skinned by the token contract (zero radius via `--radius`, flat via `--shadow-raised: none`).

- **Button (primary):** background `--color-accent` (ink), text `#fff`, radius `--radius` (0 — sharp), padding 12px/20px, weight 600, font `--font-sans`. Hover → `--color-accent-hover` (charcoal). Focus → `--focus-ring` (lime halo). Active → translateY(0), no lift. Disabled → 45% opacity, no pointer.
- **Button (secondary):** transparent background, `1px solid --color-border`, text `--color-text`, sharp. Hover → background `#fafaf7`. Reserve the lime field for a *highlighted* CTA: `--color-highlight` bg + `--color-highlight-ink` text (never white text).
- **Card (metric):** background `--color-surface-raised` (white), `1px solid --color-border`, radius 0, padding 16–18px, **no shadow** (`--shadow-raised: none`). A hero card swaps background to `--color-highlight` with ink figures. Never a colored left-border; never rounded.
- **Input:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius-sm` (0), padding 10px/12px, text `--color-text`, placeholder `--color-text-muted`. Focus → border `--color-accent` + `--focus-ring`. Disabled → 45% opacity.
- **Badge / Tag:** squared (not pill), `--color-surface` or `#fafaf7` bg, `--color-text-muted` text, 10px weight 600, 0.14em tracking, UPPERCASE, padding 2px/8px. Numbered tags (`01 ·`, `02 ·`) lead step cards.
- **Heading:** `--font-display`, weight 800–900, UPPERCASE, tracking -0.02 to -0.04em, color `--color-text`. h1 86px / h2 56px / h3 30px.
- **Stack:** flex layout on the 8px unit (`gap = n × --space-unit`); the only spacing primitive — keeps card rows and rails on-grid.

Nav chrome (prev/next, dots) is the **one** place `--radius-pill` appears: 30px pill buttons with hairline border; the active dot fills ink and scales 1.25.

## 7. Motion & Interaction

Restrained and mechanical. Slide changes: opacity + 20px translateX, `--motion-base` (220ms / 0.35s) with ease. Hover lift on cards: translateY(-2px) only, `--motion-fast` (120ms) — no shadow grows, no scale. Keyboard `ArrowLeft` / `ArrowRight` and dot nav drive slides. No parallax, no auto-play, no looping animation, no number count-ups that fabricate motion. Respect `prefers-reduced-motion`.

## 8. Voice & Brand

Operator-grade and terse. Copy reads like a readout: declarative, numeric, present-tense ("Pilot one workflow", "Scale the wedge", "Make it the default"). Headlines UPPERCASE; body sentence case; units and codes in mono. Numbers carry the argument — but every figure must be real and sourced from the user's data; the chart bar height equals the real value. The brand is a precision instrument, *not* a hype deck: no exclamation, no emoji, no "🚀 game-changing", no growth-hacking superlatives.

## 9. Anti-patterns

**Do**
- Use ink as the action color and white text on it; reserve lime for fields behind ink type.
- Keep every corner sharp (`--radius: 0`) and every edge a 1px hairline; stay flat (no shadows).
- Set numerals huge, weight 900, mono/display, tracked tight.
- Use real, user-supplied figures; size chart bars to true data.

**Don't**
- ❌ Use lime as text, icon, or foreground on paper, or lime with white text (off-token-color, contrast fail) — lime is `--color-highlight`, fill-only.
- ❌ Use indigo/violet/purple or blue→cyan "trust" gradients (ai-default-indigo, purple-gradient, trust-gradient) — this system is ink + lime only.
- ❌ Round corners or add drop-shadows (the Swiss-flat law).
- ❌ Use a serif on headings (sans-display) — Geist/Inter grotesk only.
- ❌ Use emoji as icons (emoji-icon), invented metrics ("10× faster", "99.9% uptime") (invented-metric), or filler copy ("Feature one") (filler-copy).
- ❌ Use external placeholder images (external-image) — geometry is pure CSS.
- ❌ Use raw hex in components (off-token-color) — reference token roles.

## 10. Tokens

See `tokens.css` for the machine contract (`:root` custom properties for every role above, including `--color-highlight` / `--color-highlight-ink`).
