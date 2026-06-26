---
name: Swiss Creative
category: Swiss
surface: web
description: Playful Swiss grid — oat paper, solid-ink frames, four-color pop, hard offset shadows, paper/dark themes.
version: 1.0.0
colors:
  surface: "#f3efe4"
  text: "#0b0b0b"
  accent: "#188f5a"
  pop: "#f28cc2"
---

# Swiss Creative
> Category: Swiss
> Surface: web
> Source: open-design/swiss-creative-mode-template — https://github.com/nexu-io/open-design

Brutalist-Swiss editorial: oat paper, thick ink frames, a four-color pop palette, and hard 8px offset shadows. Bold grotesk display, zero radius, deliberate scene rhythm — paper and dark themes.

## 1. Visual Theme & Atmosphere

Swiss Creative is the Swiss grid with the volume up: a warm **oat-paper** stage (`#f3efe4`), **thick solid-ink borders** (`#0b0b0b`, 2–3px) around everything, and a **four-color pop palette** (pink `#f28cc2`, yellow `#f1cb3c`, green `#188f5a`, orange `#ff7f2a`) used as flat fills. Depth is the one indulgence — **hard, blur-free offset shadows** (`8px 8px 0 ink`) that make every card and board sit like a printed sticker. It is structured but playful: layered geometric boards, rotated panels, dashed dividers, big weight-900 display type in `Space Grotesk`. Corners are always square. A built-in **paper/dark theme** toggle and a **palette cycle** keep the system kinetic without ever softening the edges. The feeling: a risograph poster that learned a grid.

Foundational palette: paper `#f3efe4`, ink `#0b0b0b`, pop {pink `#f28cc2`, yellow `#f1cb3c`, green `#188f5a`, orange `#ff7f2a`}, white card `#ffffff`.

## 2. Color

Use semantic roles, never raw hex, in components.

| Role | Value | Use |
| --- | --- | --- |
| **Surface** | `#f3efe4` | page / app frame (oat paper) |
| **Surface raised** | `#ffffff` | default card / chip face |
| **Text** | `#0b0b0b` | ink type, numerals |
| **Text muted** | `rgba(11,11,11,0.62)` | meta, captions, footer labels |
| **Accent** | `#188f5a` | signal green — primary action (white text on it) |
| **Accent hover** | `#127349` | accent hover / press |
| **Border** | `#0b0b0b` | **solid** ink frame, 2–3px — the structural element |
| **Pop pink** | `#f28cc2` | flat card / block fill |
| **Pop yellow** | `#f1cb3c` | flat card / block fill |
| **Pop green** | `#188f5a` | flat card / block fill (= accent) |
| **Pop orange** | `#ff7f2a` | emphasis word, hotspot dot, focus halo |
| **Success** | `#15803d` | positive status |
| **Warn** | `#b45309` | caution status |
| **Danger** | `#b91c1c` | destructive / error |

The pop palette is **fill-only** and always wears an ink border + ink (or paper) text — never colored type on paper. Unlike a one-accent system, color blocks are meant to be used *liberally and rhythmically* across cards. The **dark theme** (`html[data-theme="dark"]`) remaps paper→`#111216`, ink→`#f3efe4`, and brightens the pop set; both themes hold ink-on-fill contrast.

## 3. Typography

One expressive grotesk for everything; weight and size carry the drama. Display is **Space Grotesk** at weight 900; body and UI are **Inter** at a heavy 600–700 (this system rarely uses 400); **JetBrains Mono** for codes/labels. No serif, ever.

| Role | Family | Size | Weight | Line-height | Tracking | Case |
| --- | --- | --- | --- | --- | --- | --- |
| Display XL | display | 98px | 900 | 0.95 | -0.03em | UPPERCASE |
| Display | display | clamp 40–88px | 900 | 0.94 | -0.03em | UPPERCASE |
| Steps title | display | 88px | 900 | 0.94 | -0.02em | UPPERCASE |
| Big number | display | 56px | 900 | 1.0 | -0.01em | — |
| Card title | display | 30px | 900 | 1.05 | 0.06em | UPPERCASE |
| Stack label | display | 18px | 900 | 1.2 | 0.12em | UPPERCASE |
| Lead | sans | 18px | 600 | 1.45 | 0 | — |
| Body | sans | 16px | 600 | 1.4 | 0 | — |
| Legend row | sans | 15px | 700 | 1.3 | 0 | — |
| Hotspot | sans | 14px | 700 | 1.35 | 0 | — |
| Kicker | sans | 12px | 800 | 1.2 | 0.18em | UPPERCASE |
| Meta | sans | 12px | 800 | 1.4 | 0.14em | UPPERCASE |
| Button chip | sans | 12px | 700 | 1.0 | 0.08em | UPPERCASE |
| Code | mono | 13px | 500 | 1.4 | 0 | — |

Kickers, meta, card titles, and chips are uppercase with positive tracking; body copy stays sentence case but bold (≥600). Display lines clamp with viewport (`clamp(40px, 7vw, 98px)`).

## 4. Spacing

Base unit **8px**. Scale: 4, 8, 10, 12, 14, 16, 18, 24, 28, 34. The grid is medium-tight: card gaps 12px, board gaps 28px, app padding 18px. The hard shadow needs room — always leave ≥ shadow offset (8px) of clear space below/right of any raised block. Inline gaps 8–12px; stack gaps 10–16px; scene padding 28px; section rhythm `--section-y` 56px.

## 5. Layout & Composition

A 12-column working grid expressed as explicit splits: hero and diagram scenes are **two equal columns** (`1fr 1fr`, 28px gap, vertically centered); the process scene is a **four-up card row** (`repeat(4, 1fr)`, 12px gap), collapsing to 2-up < 980px and 1-up < 640px. The whole deck lives in an `--container-max` **1320px** app frame: a 3px ink border + hard shadow, with a dashed-ink topbar (controls) and a footer (dot nav + scene counter). Compose with **layered geometry** — offset/rotated bordered panels stacked inside an "art board," ascending-indent "stack" rows — built from pure CSS, never images. Scenes cross-fade and slide; one scene visible at a time.

## 6. Components

Atelier primitives, re-skinned by the token contract (zero radius, solid ink border, hard offset shadow).

- **Button (primary):** background `--color-accent`, text `#fff`, radius `--radius` (0), 2px `--color-border`, padding 12px/20px, weight 700, UPPERCASE, 0.08em tracking. Hover → `--color-accent-hover`. Active → shadow `--shadow-pressed` + translate(2px,2px). Focus → `--focus-ring` (orange). Disabled → 45% opacity.
- **Button (chip / secondary):** the signature control — `#fff` (or surface-raised) bg, 2px ink border, ink text, `--radius-pill` (the one rounded element), 7px/12px padding, UPPERCASE 12px. Hover → invert to ink bg / paper text.
- **Card:** flat **pop fill** (`--pop-*`) or white, 3px `--color-border`, radius 0, padding 14px, **hard shadow** `--shadow-raised`. Hover → translate(-2px,-2px) (shadow appears to deepen). Never rounded, never a soft/blur shadow, never a colored left-border only.
- **Input:** background `--color-surface-raised`, 2px `--color-border`, radius `--radius-sm` (0), padding 10px/12px, text `--color-text`, placeholder `--color-text-muted`. Focus → `--focus-ring` (orange) + ink border. Disabled → 45% opacity.
- **Badge:** squared tag, 2px ink border, pop-fill or white, ink text, 11px weight 800, 0.12em tracking, UPPERCASE. (Pill reserved for control chips.)
- **Heading:** `--font-display` (Space Grotesk) weight 900, UPPERCASE, tracking -0.02 to -0.03em, `--color-text`. h1 88–98px / h2 56px / h3 30px.
- **Stack:** flex layout on the 8px unit (`gap = n × --space-unit`); composes card rows, legends, and the ascending stack diagram.

## 7. Motion & Interaction

Deliberate, editorial, never frantic. Scene transitions: opacity + 40px translateX, `--motion-base` (≈400ms) ease — no jump cuts. Card hover: translate(-2px,-2px), `--motion-fast` (120ms); active press shifts the block into its shadow (`--shadow-pressed`). Interactions are first-class: **theme toggle** (paper/dark, no reload), **palette cycle** (swaps the pop set across all blocks), **hotspot** (toggles an annotation), prev/next + dot + arrow-key nav — all keyboard-operable with visible focus. No parallax, no autoplay loops. Respect `prefers-reduced-motion`.

## 8. Voice & Brand

Confident, design-literate, a little theatrical — gallery wall-text, not ad copy. Short imperative labels ("Discover", "Define", "Develop", "Deliver"), real system nouns, present tense. Uppercase for titles/labels; bold sentence case for body. Numbers and claims must be real — no fabricated metrics, no lorem ipsum. The brand is a maker's studio with strong opinions; it is *not* a corporate SaaS landing page and never reaches for emoji or hype.

## 9. Anti-patterns

**Do**
- Frame everything in a solid 2–3px ink border and lift it with the hard offset shadow.
- Use the pop palette liberally as flat ink-bordered fills with ink/paper text.
- Keep corners square (`--radius: 0`); reserve the pill only for control chips.
- Set display type in Space Grotesk at weight 900, uppercase.

**Don't**
- ❌ Use a soft/blurred drop-shadow (the shadow is hard, `Npx Npx 0`, ink only).
- ❌ Round card/input corners (zero-radius law) or use pop color as type on paper (off-token-color).
- ❌ Use indigo/violet/purple or blue→cyan "trust" gradients (ai-default-indigo, purple-gradient, trust-gradient) — pop palette only, never a gradient.
- ❌ Put a serif on headings (sans-display) — Space Grotesk / Inter only.
- ❌ Use emoji as icons (emoji-icon), invented metrics ("10× faster") (invented-metric), or filler copy ("Feature one" / lorem ipsum) (filler-copy).
- ❌ Use external placeholder images (external-image) — geometry is pure CSS.
- ❌ Use raw hex in components (off-token-color) — reference token roles.

*Exemption: `accent-overuse` is intentionally not enforced — this is a deliberately multi-color system; the discipline is "every fill is ink-bordered + on-grid," not "≤2 accents per screen."*

## 10. Tokens

See `tokens.css` for the machine contract (`:root` roles + the `--pop-*` set + the `html[data-theme="dark"]` override).
