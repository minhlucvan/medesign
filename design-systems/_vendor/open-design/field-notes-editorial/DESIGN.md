---
name: Field Notes Editorial
category: Editorial
surface: web
description: Warm-paper field-notes editorial — deep ink on cream, pillow-rounded pastel cards, serif numerals, one deepened rose accent.
version: 1.0.0
colors:
  background: "#f4f0e8"
  text: "#181715"
  accent: "#9e5572"
---

# Field Notes Editorial
> Category: Editorial
> Surface: web
> Source: open-design/field-notes-editorial-template — https://github.com/nexu-io/open-design

A premium board-memo report aesthetic: deep ink on warm cream paper, oversized serif numerals, pillow-rounded pastel insight cards (lime, pink, peach), and one deepened-rose accent. Quietly confident, magazine-literate, never a dashboard.

## 1. Visual Theme & Atmosphere

Field Notes reads like a beautifully printed quarterly memo. The page is warm cream paper (`#f4f0e8`) lit by a soft radial vignette toward `#f8f5ee` at center, so the surface feels gently spotlit rather than flat. Type is deep ink (`#181715`); the headline voice is a high-contrast serif (Fraunces, falling back to Georgia) that carries the big statistics — a 122px italic `68%` is the hero, not a chart. Body and labels are clean sans (Inter). The signature gesture is the **pillow-rounded card** (28px radius) filled with a muted pastel — lime `#c9d57a`, pink `#e4b8cc`, peach `#e9cbaf` — holding dark ink text, never light text on a busy fill. Depth is soft and large: wide, low-opacity warm shadows, no hard edges, no glow, no gradients beyond the single paper vignette. One deepened rose (`#9e5572`) is the only interactive accent and appears at most twice per screen. The mood: composed, editorial, expensive-feeling — a written field report, not a metrics console.

## 2. Color

Use semantic roles, never raw hex, in components. Pastel fills are decorative card backgrounds only — text on them is always ink.

| Role | Value | Use |
| --- | --- | --- |
| **Surface** | `#f4f0e8` | page background (warm paper) |
| **Surface raised** | `#fbf9f3` | cards, inputs, raised blocks |
| **Text** | `#181715` | primary ink |
| **Text muted** | `#5c5853` | secondary / meta / captions |
| **Accent** | `#9e5572` | one primary CTA / link / active series |
| **Accent hover** | `#854a64` | accent hover / pressed |
| **Border** | `#e6a2bc` | pink trim lines, dividers, input borders |
| **Success** | `#3f6b42` | positive status |
| **Warn** | `#9a6b1f` | caution status |
| **Danger** | `#b3473c` | destructive / error |
| _Lime (decorative)_ | `#c9d57a` | hero / insight card fill |
| _Pink (decorative)_ | `#e4b8cc` | metric / insight card fill |
| _Peach (decorative)_ | `#e9cbaf` | metric / insight card fill |
| _Line yellow (decorative)_ | `#ddd06a` | chart series |
| _Line ink (decorative)_ | `#1d1d1d` | chart series |

Light surface only in v1. The rose accent is precious: **at most two** accent elements per screen. Pastels are a rotating set used for card fills and chart series — never as text or accent color.

## 3. Typography

Display is serif (Fraunces) and carries every headline and oversized numeral; body and UI are Inter. Mono for code/data labels only. Uppercase is reserved for eyebrows/labels and always tracks wide (≥ 0.14em).

| Role | Family | Size | Weight | Line-height | Tracking |
| --- | --- | --- | --- | --- | --- |
| Hero numeral | display | 122px | 460 | 0.90 | -1px |
| Display XL | display | 78px | 480 | 1.00 | -0.5px |
| Display L | display | 64px | 480 | 1.06 | -0.4px |
| Statement (italic) | display | 32px | 480 (italic) | 1.20 | -0.2px |
| Title | display | 28px | 500 | 1.20 | -0.2px |
| Subtitle | display | 22px | 500 | 1.28 | 0 |
| Lead | sans | 19px | 400 | 1.65 | 0 |
| Body L | sans | 18px | 400 | 1.60 | 0 |
| Body | sans | 16px | 400 | 1.60 | 0 |
| Body S | sans | 14px | 400 | 1.55 | 0 |
| Caption | sans | 13px | 400 | 1.5 | 0 |
| Label | sans | 13px | 500 | 1.3 | 0.02em |
| Eyebrow | sans | 12px | 600 | 1.2 | 0.14em (UPPERCASE) |
| Topline meta | sans | 12px | 600 | 1.2 | 0.16em (UPPERCASE) |
| Button | sans | 15px | 500 | 1.2 | 0.01em |
| Code | mono | 14px | 400 | 1.5 | 0 |

Never set h1–h3 or large numerals in the sans family — the serif is the brand. The italic Statement style is for pull-quote sentences (e.g. "of new accounts open the third email"). Eyebrows and topline meta are the only uppercase text.

## 4. Spacing

Base unit **8px** (`--space-unit`). Scale: 4, 8, 12, 16, 18, 24, 28, 32, 48, 64, 88, 128. Card padding 28–30px; grid gaps 18–24px; section padding 88px (`--section-y`). Field Notes is generous but denser than a marketing page — cards sit close in an 18px-gutter grid, while sections breathe at 88px.

## 5. Layout & Composition

Container max-width **1280px** (`--container-max`), centered, 24px gutters (16px on phone). The hero metrics view is an asymmetric grid (`1.8fr 1fr`, two rows) — a tall hero card beside two stacked metric cards. Insight views are a three-column equal grid; retention/detail views split `0.9fr 1.1fr` (text beside chart). Cards never touch the page edge — the paper frame shows a margin on all sides. Footer meta (date · pager · volume) sits pinned at the bottom of each view. Asymmetry and a clear focal numeral are the composition signature; avoid uniform card grids where everything is the same weight.

## 6. Components

- **Button (primary):** background `--color-accent`, text `#fff`, radius `--radius-pill`, padding 10px/18px, weight 500. Hover → `--color-accent-hover`. Active → `--color-accent-hover` + 1px nudge down. Focus → `--focus-ring`. Disabled → 45% opacity, no pointer.
- **Button (secondary):** transparent background, `1px solid --color-border`, text `--color-text`, radius `--radius-pill`. Hover → background `#fbf9f3`. Active → background `#f1ead9`. Focus → `--focus-ring`. Disabled → 45% opacity.
- **Button (pager/ink):** background `#181715`, text `#f5f1ea`, radius `--radius-pill`, padding 8px/14px. Hover → `#2a2825`. Active → `#000`. Focus → `--focus-ring`. The signature nav control.
- **Card:** background `--color-surface-raised`, radius `--radius`, padding 28px, shadow `--shadow-raised`, no border. Pastel variant → fill `--color-lime` / `--color-pink` / `--color-peach` with ink text. Hover (interactive only) → translateY(-4px) + larger shadow. Never light text on a pastel fill; never a colored left bar.
- **Input:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius-sm`, padding 11px/14px, text `--color-text`, placeholder `--color-text-muted`. Hover → border darkens to `--color-accent`. Focus → border `--color-accent` + `--focus-ring`. Disabled → 50% opacity. Error → border `--color-danger`.
- **Badge:** pill (`--radius-pill`), 3px/12px padding, 12px weight 600, uppercase 0.14em tracking. Neutral = `#fbf9f3` bg / `--color-text-muted` text / `1px solid --color-border`; accent = `--color-accent` bg / white text (use sparingly).
- **Heading:** display family (Fraunces), weight 460–500, ink color, tracking per the type scale (negative on large sizes). h1 = Display XL/L, h2 = Title, h3 = Subtitle. Never sans, never uppercase.
- **Stack:** vertical flow primitive; default gap 16px, tight 8px, loose 24–28px. Inline gaps 8–16px; no dividers between rows unless a hairline `--color-border` rule is explicitly needed.

## 7. Motion & Interaction

Soft and presentation-safe. Hover/focus transitions `--motion-fast` (120ms) on color and box-shadow only. Card lifts and entrances `--motion-base` (250ms) with `--ease-standard`. Two signature reveals are allowed on first paint only: metric numbers count up from zero (≤ 900ms) and chart lines draw in (≤ 1s, staggered ~120ms). No bounce, no parallax, no looping motion, nothing over 1.2s. Respect `prefers-reduced-motion` — reveals snap to final state.

## 8. Voice & Brand

Literate, observed, quietly authoritative — a researcher's field memo, not a sales deck. Short declarative sentences; findings stated as facts ("The curve bends around day three."). Numbers are honest and sourced; unknown values are `—`, never invented. Title case for headings, sentence case for body, wide-tracked uppercase only for eyebrows and topline meta. Roman-numeral page marks and "Vol." framing are welcome. No hype, no growth-hacking metrics, no emoji, no exclamation marks. The brand is considered insight; it is *not* a startup landing page or a KPI dashboard.

## 9. Anti-patterns

**Do**
- Use Fraunces/Georgia for headlines and all big numerals; Inter for everything else.
- Keep the rose accent to ≤ 2 elements per screen (`accent-overuse`).
- Fill cards with the muted pastels and set dark ink text on them.
- Use soft, wide warm shadows and 28px rounding for depth.
- Keep statistics honest; use `—` for unknowns.

**Don't**
- ❌ Use indigo/violet/purple or any blue accent or focus ring — the only accent is rose (`ai-default-indigo`, `off-token-color`).
- ❌ Use purple→pink or blue→cyan gradients; the only gradient is the paper vignette (`purple-gradient`).
- ❌ Use a glossy "trust" hero gradient behind metrics (`trust-gradient`).
- ❌ Set headings or hero numerals in the sans family (`sans-display`).
- ❌ Use emoji as icons (`emoji-icon`).
- ❌ Invent metrics ("10× faster", "99.9% uptime") or fabricate chart data (`invented-metric`).
- ❌ Ship filler copy ("Insight one", "Lorem ipsum") (`filler-copy`).
- ❌ Pull in external/stock imagery; this system is type, color, and chart only (`external-image`).
- ❌ Reference raw hex in components — use token roles (`off-token-color`).

## 10. Tokens

See `tokens.css` for the machine contract (`:root` custom properties for every role above).
