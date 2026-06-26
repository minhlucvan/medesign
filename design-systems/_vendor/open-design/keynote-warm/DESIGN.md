---
name: Keynote Warm
category: Deck
surface: web
description: Apple-Keynote-grade slides on warm linen — one idea per screen, huge bold sans headlines, serif-italic flourishes, rust + gold accents.
version: 1.0.0
colors:
  surface: "#f4f1ec"
  text: "#15140f"
  accent: "#c96442"
---

# Keynote Warm
> Category: Deck
> Surface: web
> Source: open-design/ppt-keynote — https://github.com/nexu-io/open-design

A warm, premium keynote system: one idea per 16:9 screen, oversized bold sans headlines (Inter Tight) with a single serif-italic flourish, set on linen paper with deep espresso ink and a precious rust-to-gold accent.

## 1. Visual Theme & Atmosphere

Keynote Warm feels like a confident on-stage talk, not a slide dump. Each screen is a single `1280×720` card carrying *one* idea — a headline, a stat, or a line that lands. The ground is warm linen (`#f4f1ec`) with espresso ink (`#15140f`); a dark slide variant (`#15140f` ground, warm-white text) inverts the rhythm for emphasis beats. Headlines are huge — `84px` and up — in **Inter Tight 800** with tight tracking, and the only ornament is a serif-italic word (Fraunces / Georgia italic) dropped into the headline like a hand-drawn underline. One accent does the talking: fired rust (`#c96442`) on light, amber gold (`#e9b94a`) for figures on dark. Depth is a single deep stage shadow under each slide, never busy panels. The mood: calm, literate, expensive — generous whitespace, restrained color, content that breathes.

## 2. Color

Use semantic roles, never raw hex, in components.

| Role | Value | Use |
| --- | --- | --- |
| **Surface** | `#f4f1ec` | linen stage / light slide ground |
| **Surface raised** | `#fafaf7` | warm-white cards, inputs, raised blocks |
| **Surface inverse** | `#15140f` | dark / emphasis slide ground |
| **Text** | `#15140f` | espresso ink (primary) |
| **Text muted** | `rgba(21,20,15,0.62)` | captions, meta, supporting lines |
| **Accent** | `#c96442` | the one CTA / emphasis on light |
| **Accent hover** | `#a94f32` | accent hover / active |
| **Accent gold** | `#e9b94a` | big figures & emphasis on dark slides only |
| **Border** | `#e7e5e0` | warm hairlines, card edges, dividers |
| **Success** | `#15803d` | positive status |
| **Warn** | `#b45309` | caution status |
| **Danger** | `#b91c1c` | destructive / error |

One warm gradient is sanctioned — `135deg, #c96442 → #e9b94a` — for cover and closing ("Thanks.") slides only. No other gradients. The accent is precious: at most **two** accent elements per slide.

## 3. Typography

Display & headlines are bold **sans** (Inter Tight); body/UI is Inter; the *only* serif is Fraunces/Georgia **italic**, reserved for a single emphasis word. Mono labels slide numbers and code.

| Role | Family | Size | Weight | Line-height | Tracking |
| --- | --- | --- | --- | --- | --- |
| Cover | display | 120px | 800 | 1.0 | -0.03em |
| Display XL | display | 96px | 800 | 1.05 | -0.025em |
| Display L | display | 84px | 800 | 1.05 | -0.025em |
| Headline | display | 64px | 700 | 1.1 | -0.02em |
| Headline S | display | 56px | 700 | 1.12 | -0.02em |
| Emphasis | serif | inherit | 600 | inherit | -0.01em (italic) |
| Stat | display | 48px | 700 | 1.1 | -0.02em |
| Title | display | 32px | 700 | 1.15 | -0.01em |
| Lead | sans | 28px | 400 | 1.45 | 0 |
| Body L | sans | 24px | 400 | 1.5 | 0 |
| Body | sans | 18px | 400 | 1.6 | 0 |
| Body S | sans | 16px | 400 | 1.6 | 0 |
| Card label | sans | 14px | 600 | 1.6 | 0 |
| Caption | sans | 14px | 400 | 1.6 | 0 |
| Eyebrow | sans | 12px | 600 | 1.2 | 0.22em (UPPERCASE) |
| Slide number | mono | 11px | 500 | 1.2 | 0.18em |
| Code | mono | 16px | 400 | 1.5 | 0 |

Headlines are always Inter Tight — never serif. Serif appears only as an italic emphasis span inside a headline (e.g. *世界级 HTML*). Eyebrows and slide numbers are the only uppercase / wide-tracked text.

## 4. Spacing

Base unit **8px** (`--space-unit`). Scale: 4, 8, 12, 16, 20, 24, 28, 32, 48, 64, 80, 96, 128. In-slide padding is `80px` horizontal / `64px` vertical (`--slide-pad`); data-card grids use `20–24px` gaps; stack gaps between headline and supporting text `24–32px`. Prefer pushing supporting content to the slide's bottom edge with `margin-top:auto` — the keynote breathes from the top.

## 5. Layout & Composition

Each slide is a `1280×720` card, `16:9`, `--radius-lg` (18px) corners, lifted by `--shadow-slide`. One idea per slide; never two competing focal points. Three layout archetypes: (1) **statement** — eyebrow + oversized headline + one supporting line, content bottom-anchored; (2) **data** — headline + a `repeat(3, 1fr)` card grid (`--container-max` wide), figures in Stat size; (3) **cover/closing** — brand gradient, centered. Top-right carries a mono page indicator (`01 / 07`). Reading is left-aligned; centering is reserved for cover and closing. Whitespace, not dividers, separates ideas.

## 6. Components

- **Button (primary):** background `--color-accent`, text `#fff`, radius `--radius`, padding 12px/22px, weight 600, `--font-sans`. Hover → `--color-accent-hover`. Active → `--color-accent-hover` + 1px nudge. Focus → `--focus-ring`. Disabled → 45% opacity, no pointer.
- **Button (secondary):** transparent background, `1px solid --color-border`, text `--color-text`. Hover → background `--color-surface-raised`. Focus → `--focus-ring`. Disabled → 45% opacity.
- **Card:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius`, padding 28px, shadow `--shadow-raised`. Data card: figure in Stat size (accent on light, `--color-accent-gold` on dark), label in Caption. No colored left border. Hover (if interactive) → border `--color-text-muted`, shadow lift; otherwise static.
- **Input:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius-sm`, padding 10px/12px, text `--color-text`, placeholder `--color-text-muted`. Hover → border `--color-text-muted`. Focus → border `--color-accent` + `--focus-ring`. Disabled → 45% opacity. Error → border `--color-danger`.
- **Badge:** pill (`--radius-pill`), 2px/10px padding, Eyebrow type. Neutral = `--color-surface` bg / `--color-text-muted` text; accent = `--color-accent` bg / `#fff` text (sparingly). No hover state.
- **Heading:** `--font-display`, weights 700–800, tracking per scale (negative). Renders h1–h3 as Display/Headline/Title. Emphasis span switches to `--font-serif` italic only. Never sans→serif on the whole heading; never serif on the whole heading.
- **Stack:** vertical flow primitive; gap from the spacing scale (24/32 between headline and support). Supports `margin-top:auto` push to bottom-anchor supporting content. No visual styling of its own.

## 7. Motion & Interaction

Quiet and deliberate. Slide-to-slide is a `--motion-slide` (420ms) cross-fade with `--ease-standard`; navigation is keyboard ←/→/space, hash-synced (`#/3`). Hover/focus on controls use `--motion-fast` (120ms) on color and box-shadow only. Element entrances `--motion-base` (220ms). No parallax, no auto-advance, no bounce, no spinning figures. Respect `prefers-reduced-motion` — fades become instant cuts.

## 8. Voice & Brand

Spoken, confident, concrete — like a founder on stage, not a brochure. One idea per slide; short declarative lines; real numbers with their unit and what they mean ("80s → 31KB article"), never round invented hype. Sentence case for body, tight Title case or sentence case for headlines, UPPERCASE only for eyebrows. No emoji as decoration, no exclamation spam, no "synergy." The brand is calm craft and earned confidence; it is *not* a sales funnel or a corporate template.

## 9. Anti-patterns

**Do**
- Use Inter Tight (display) for headlines; reserve Fraunces/Georgia italic for a single emphasis word.
- Keep one idea per slide and accent to ≤ 2 elements.
- Use rust on light, gold on dark; the single warm gradient only on cover/closing.
- Bottom-anchor supporting text; let the slide breathe.

**Don't**
- ❌ Use indigo / violet / blue accents or blue→cyan "trust" gradients — warm rust/gold only. (`ai-default-indigo`, `purple-gradient`, `trust-gradient`)
- ❌ Use raw hex in components instead of the token roles. (`off-token-color`)
- ❌ Put more than two accent elements on a slide. (`accent-overuse`)
- ❌ Set an entire heading in serif (serif is italic-emphasis only). (`sans-display` — exempt: headlines are deliberately sans)
- ❌ Use emoji as icons or bullets. (`emoji-icon`)
- ❌ Invent metrics ("10× faster", "99.9% uptime") or use filler copy ("Feature one"). (`invented-metric`, `filler-copy`)
- ❌ Pull in external stock images / remote logos. (`external-image`)

## 10. Tokens

See `tokens.css` for the machine contract (`:root` custom properties for every role above).
