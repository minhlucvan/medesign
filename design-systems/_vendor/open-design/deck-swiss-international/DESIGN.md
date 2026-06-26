---
name: Deck — Swiss International
category: Deck
surface: web
description: International Typographic deck — paper white, ink black, one saturated accent, 16-col grid, hairlines only.
version: 1.0.0
colors:
  surface: "#fafaf8"
  text: "#0a0a0a"
  accent: "#002fa7"
---

# Deck — Swiss International
> Category: Deck
> Surface: web
> Source: open-design/deck-swiss-international — https://github.com/nexu-io/open-design

International Typographic Style for slides: near-white paper, ink-black type, a single saturated accent (Klein Blue by default), a strict 16-column grid, 1px hairlines, zero radius, no shadows. Facts only, set cold and rational.

## 1. Visual Theme & Atmosphere

A reverent rebuild of Müller-Brockmann's International Typographic Style as a deck. The stage is **near-white paper** (`#fafaf8`), type is **ink** (`#0a0a0a`), structure is **1px ink hairlines**, and there is exactly **one saturated accent** — **International Klein Blue** `#002fa7` by default. The mood is academic, cold, and rational: no hand-drawing, no noise, no decoration, no shadow, no gradient, no blur, no rounded corner. Drama comes only from **extreme type-scale contrast** (a 9.6vw cover display against 11px labels) sitting on a precise **16-column grid**. Accent appears decisively — as a full-bleed cover field, a single highlighted card, a hairline — but never as a second hue. Decorative geometry (ASCII breathing dot-matrices, concentric SVG rings) is pure CSS/inline-SVG, ink-and-accent only. The feeling: a Helvetica wall chart, 22 locked layouts deep.

Foundational palette: paper `#fafaf8`, ink `#0a0a0a`, accent IKB `#002fa7`. Three locked alternates: Lemon `#ffd500`, Neon Green `#c5e803`, Safety Orange `#ff6b35` (each on `#f7f5ee` paper).

## 2. Color

Use semantic roles, never raw hex, in components. Pick **one** theme and never mix.

| Role | Value | Use |
| --- | --- | --- |
| **Surface** | `#fafaf8` | slide paper (IKB theme; `#f7f5ee` for alternates) |
| **Surface raised** | `#ffffff` | card / cell face |
| **Text** | `#0a0a0a` | ink type, numerals, hairlines |
| **Text muted** | `rgba(10,10,10,0.58)` | labels, captions, axis text, footnotes |
| **Accent** | `#002fa7` | the single saturated accent — cover field, one highlight card, accent hairline |
| **Accent hover** | `#002485` | accent hover / press (deeper IKB) |
| **Border** | `#0a0a0a` | 1px ink hairline — grid rules, dividers, cell borders |
| **Success** | `#15803d` | positive status |
| **Warn** | `#b45309` | caution status |
| **Danger** | `#b91c1c` | destructive / error |

**Locked themes (do not edit the hex).** 🔵 Klein Blue `#002fa7` — business / AI / design; white text on accent. 🟡 Lemon `#ffd500` — youth / retail / sport; **black** text on accent. 🟢 Neon Green `#c5e803` — sustainability / tech / Gen-Z; **black** text on accent. 🟠 Safety Orange `#ff6b35` — industrial / automotive / urgent; **white** text on accent, weight ≥ 600. Hairlines may be ink **or** accent; everything else is ink on paper.

## 3. Typography

A single neo-grotesk, pushed to extreme scale contrast. Display is **Inter Tight** (Latin display); body and UI are **Inter** (with **Noto Sans SC** for CJK); data, KPIs, and `№`/date chrome are **JetBrains Mono**. No serif, no decorative face — ever. Labels are 11px uppercase at 0.08em; the cover display is ~9.6vw.

| Role | Family | Size | Weight | Line-height | Tracking | Case |
| --- | --- | --- | --- | --- | --- | --- |
| Cover display | display | 9.6vw (≈140px) | 800 | 0.92 | -0.03em | mixed |
| Statement | display | 9.6vw | 700 | 0.95 | -0.02em | mixed |
| Display | display | 72px | 800 | 0.95 | -0.02em | mixed |
| H1 | display | 56px | 700 | 1.0 | -0.02em | mixed |
| H2 | display | 40px | 700 | 1.05 | -0.01em | mixed |
| H3 | display | 28px | 600 | 1.1 | -0.01em | mixed |
| KPI numeral | mono | 64px | 700 | 1.0 | -0.01em | tabular |
| KPI numeral S | mono | 40px | 600 | 1.05 | 0 | tabular |
| Lead | sans | 18px | 400 | 1.5 | 0 | — |
| Body | sans | 16px | 400 | 1.5 | 0 | — |
| Body S | sans | 14px | 400 | 1.5 | 0 | — |
| Caption | sans | 13px | 400 | 1.45 | 0 | — |
| Label | mono | 11px | 500 | 1.3 | 0.08em | UPPERCASE |
| Chrome (№ / date) | mono | 11px | 500 | 1.4 | 0.08em | UPPERCASE |

Labels and chrome are the only uppercase text, always 0.08em tracked, always mono. Body sits at 14–16px — the contrast against the cover display is the whole point.

## 4. Spacing

Base unit **8px**, but spacing is governed first by the **16-column grid**, not by a free scale. Scale: 4, 8, 12, 16, 24, 32, 48, 64. Slides have a consistent outer margin (≈48–64px) and **zero gutter** between grid columns (`gap: 0`) — separation is the 1px hairline, not whitespace. Vertical rhythm aligns to grid rows; KPI towers and timelines snap to column boundaries. Generous negative space is structural (Statement layouts), never accidental.

## 5. Layout & Composition

The spine is a **16-column grid**: `grid-template-columns: repeat(16, 1fr); gap: 0`. Slides are **16:9** within an `--container-max` 1280px stage. There are **22 locked layouts** — reused, never invented or restyled; slide count is driven by content (6–10 for short decks, far more for long ones, repeating layouts across sections). Signature layouts: **S01 Cover** (full-bleed accent + ASCII dot-matrix + reversed title + date/№/topic chrome), **S06 KPI Tower** (4 variable-height accent columns), **S03 Statement** (9.6vw centered giant + bottom hairline), **S07 H-Bar Chart** (bar width = real data), **S11 Horizontal Timeline** (hairline axis + equidistant nodes), **S17 System Diagram** (concentric SVG rings). Fixed chrome: `№N/N` bottom-right, topic label bottom-left. Keyboard `←`/`→` paging + hash sync. Bars and rings encode **real values**, proportionally — never decorative.

## 6. Components

Atelier primitives, re-skinned by the token contract (zero radius via `--radius`/`--radius-pill: 0`, flat via `--shadow-raised: none`, ink hairline border).

- **Button (primary):** background `--color-accent` (IKB), text `#fff`, radius 0, `1px solid --color-border`, padding 10px/18px, weight 600, `--font-sans`. Hover → `--color-accent-hover`. Focus → `--focus-ring` (IKB). Active → no lift (flat). Disabled → 45% opacity. *On Lemon/Green themes use ink text; on Orange use white ≥600.*
- **Button (secondary):** transparent bg, `1px solid --color-border` (ink hairline), ink text, radius 0. Hover → `--color-surface-raised`.
- **Card / Cell:** background `--color-surface-raised`, `1px solid --color-border`, radius 0, **no shadow**, padding 16–24px. A single highlighted cell may take `--color-accent` (with theme-correct text). Grid cells share hairlines (no double borders); never rounded, never a colored left-border only.
- **Input:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius-sm` (0), padding 10px/12px, text `--color-text`, placeholder `--color-text-muted`. Focus → border `--color-accent` + `--focus-ring`. Disabled → 45% opacity.
- **Badge / Label:** squared (`--radius-pill: 0`), 1px ink (or accent) hairline, mono 11px weight 500, 0.08em tracking, UPPERCASE; used for category labels and `№`/date chrome.
- **Heading:** `--font-display` (Inter Tight), weight 600–800, tracking -0.01 to -0.03em, `--color-text` (reversed to paper on an accent field). Cover display ≈ 9.6vw.
- **Stack:** flex layout on the 8px unit (`gap = n × --space-unit`); composes timelines, KPI ledgers, and cell groups on-grid.

## 7. Motion & Interaction

Minimal and exact — motion serves navigation, not spectacle. Slide paging via `←`/`→` keys (with `#hash` sync) and prev/next; transitions are a quick opacity/translate, `--motion-base` (220ms), `--ease-standard`. The cover dot-matrix may "breathe" subtly via CSS. No parallax, no autoplay, no count-ups, no scroll-jacking, no blur transitions. Fully keyboard-operable with visible IKB focus. Respect `prefers-reduced-motion`.

## 8. Voice & Brand

Academic, factual, restrained — a lecture, not a pitch. Declarative statements, real nouns, present tense; CJK or Latin, never both casually mixed in one line. Sentence/headline case for prose; UPPERCASE only for mono labels. **Every number is the user's** — chart bar heights and ring segments are proportional to real data; nothing is invented. No exclamation, no emoji, no hype, no marketing superlatives. The brand is rigor and clarity; it is *not* a startup landing page.

## 9. Anti-patterns

**Do**
- Lay everything on the 16-column grid with `gap: 0`; separate with 1px ink/accent hairlines.
- Keep one saturated accent per deck; pick a single locked theme.
- Push extreme type contrast (9.6vw display vs 11px mono labels).
- Encode real data into bar heights / ring segments.

**Don't**
- ❌ Round any corner (`--radius`/`--radius-pill: 0` — rounding is an instant violation).
- ❌ Add a shadow, gradient, or blur (strictly forbidden).
- ❌ Introduce a second accent hue, or mix two themes (off-token-color).
- ❌ Use indigo/violet/purple or blue→cyan "trust" gradients (ai-default-indigo, purple-gradient, trust-gradient) — the only blue is IKB, flat.
- ❌ Put a serif/decorative face on headings (sans-display) — Inter Tight / Inter / JetBrains Mono only.
- ❌ Use emoji as icons (emoji-icon), invented metrics (invented-metric), or filler copy / lorem ipsum (filler-copy).
- ❌ Use external image URLs (external-image) — geometry is pure CSS / inline SVG.
- ❌ Use raw hex in components (off-token-color) — reference token roles.

*Exemption: `accent-overuse` is not enforced — the deck's signature is one accent used boldly and repeatedly (cover field + hairlines + highlight cell). The real rule is "one hue, never two," covered by off-token-color.*

## 10. Tokens

See `tokens.css` for the machine contract (`:root` IKB defaults + the locked `[data-theme="lemon|green|orange"]` overrides).
