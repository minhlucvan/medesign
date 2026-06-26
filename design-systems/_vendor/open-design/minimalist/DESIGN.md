---
name: Quiet Minimalist
category: Minimalist
surface: web
description: Warm-monochrome editorial minimalism — paper white, charcoal serif headlines, one monochrome accent, flat structure.
version: 1.0.0
colors:
  surface: "#ffffff"
  text: "#111111"
  accent: "#111111"
---

# Quiet Minimalist
> Category: Minimalist
> Surface: web
> Source: open-design/minimalist-skill — https://github.com/Leonxlnx/taste-skill

Warm-monochrome editorial minimalism — pure-white canvas, warm-bone cards, charcoal serif headlines on a premium geometric sans, one monochrome accent. Flat, hairline-bordered, near-shadowless. Color is a scarce resource spent only on meaning.

## 1. Visual Theme & Atmosphere

Quiet Minimalist is a "document-style" interface in the lineage of top-tier workspace tools: ultra-flat, editorial, and unhurried. The canvas is pure white (`#ffffff`) or warm bone (`#f7f6f3`); text is off-black charcoal (`#111111`), never pure black. The signature is **extreme typographic contrast** — a high-contrast editorial serif (Lyon Text) for hero headlines and quotes, paired with a clean geometric sans (SF Pro / Geist) for everything functional. Structure comes from macro-whitespace and a single hairline (`1px solid #eaeaea`), not from boxes, fills, or shadows. Shadows are practically non-existent (opacity < 0.05); gradients, neon, glassmorphism, and pill-shaped containers are banned. The accent is monochrome — it *is* the charcoal ink (`#111111`) — so emphasis is created by weight, scale, and whitespace rather than hue. Color appears only as scarce, desaturated pastel spots for tags and inline code. The mood is quiet sophistication: bento-grid calm, generous air, and crisp editorial restraint.

Foundational palette: white `#ffffff`, warm bone `#f7f6f3`, charcoal `#111111`, muted gray `#787774`, hairline `#eaeaea`.

## 2. Color

Components reference semantic roles only. The accent is intentionally **monochrome** — identical to the text ink — so this system has no chromatic CTA color; emphasis is typographic.

| Role | Value | Use |
| --- | --- | --- |
| **Surface** | `#ffffff` | pure-white canvas / page background |
| **Surface raised** | `#f7f6f3` | warm-bone cards, panels, `<kbd>` keys |
| **Text** | `#111111` | charcoal ink — headings, body (never `#000000`) |
| **Text muted** | `#787774` | secondary text, metadata, captions |
| **Accent** | `#111111` | monochrome accent — primary CTA fill, active state (= the ink) |
| **Accent hover** | `#333333` | subtle hover shift on the charcoal CTA |
| **Border** | `#eaeaea` | every hairline, divider, card edge, input border |
| **Success** | `#346538` | positive status (pale-green family text) |
| **Warn** | `#956400` | caution status (pale-yellow family text) |
| **Danger** | `#9f2f2d` | error/destructive status (pale-red family text) |

Spot pastels back the status text colors when tinted chips are needed: pale red `#fdebec`, pale blue `#e1f3fe`, pale green `#edf3ec`, pale yellow `#fbf3db`. Charcoal on white clears WCAG AAA; muted gray on white clears AA for secondary text. Light surface only.

## 3. Typography

Editorial serif for hero/display, premium geometric sans for body & UI, Geist Mono for code and keystrokes. Inter, Roboto, and Open Sans are banned. Body never sits on pure black and runs at 1.6 line-height.

| Role | Family | Size | Weight | Line-height | Tracking | Case |
| --- | --- | --- | --- | --- | --- | --- |
| Hero | display | 72px | 500 | 1.05 | -0.03em | sentence |
| Display XL | display | 56px | 500 | 1.08 | -0.03em | sentence |
| Display L | display | 44px | 500 | 1.1 | -0.02em | sentence |
| Title | display | 32px | 500 | 1.15 | -0.02em | sentence |
| Subtitle | display | 24px | 500 | 1.25 | -0.01em | sentence |
| Section head | sans | 20px | 600 | 1.3 | -0.01em | sentence |
| Body L | sans | 18px | 400 | 1.6 | 0 | sentence |
| Body | sans | 16px | 400 | 1.6 | 0 | sentence |
| Body S | sans | 14px | 400 | 1.55 | 0 | sentence |
| Lead quote | display | 22px | 400 | 1.4 | -0.01em | sentence (italic) |
| Label | sans | 13px | 500 | 1.3 | 0.01em | sentence |
| Tag | sans | 11px | 600 | 1.2 | 0.05em | UPPER |
| Caption | sans | 12px | 400 | 1.45 | 0 | sentence |
| Keystroke | mono | 12px | 500 | 1.2 | 0 | as-is |
| Code | mono | 13px | 400 | 1.55 | 0 | as-is |
| Meta | mono | 12px | 400 | 1.4 | 0.02em | as-is |

Hero and display headlines use the serif at tight tracking (`-0.02em` to `-0.04em`) and tight leading (1.05–1.15). Body, buttons, and UI use the geometric sans. Hierarchy is built from weight, scale, and color — not screaming size. Tags are the only uppercase text.

## 4. Spacing

Base unit **8px**. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Internal padding is generous (cards 24–40px). Macro-whitespace first: establish large vertical section padding (`--section-y`, 96px; up to 128px on hero) before placing content. Inline gaps 8–16px; stack gaps 16–32px. The system breathes — never crowd.

## 5. Layout & Composition

Asymmetrical **bento-grid** built on CSS Grid (never flexbox percentage math). Main reading column constrained to ~65ch (`max-w-4xl`/`max-w-5xl`); container max `--container-max` (1180px), centered. Every card, divider, and edge is exactly `1px solid --color-border` — structure through hairlines, not fills. Accordions strip their boxes and separate items with a single `border-bottom`. Faux-OS chrome (three small gray circles on a white bar) wraps product mockups. Sections must have quiet depth (a low-opacity warm texture or soft radial light at `opacity ≤ 0.04`) rather than empty flat backgrounds, but never a gradient that reads as color.

## 6. Components

Reuses the shared atelier primitives (`code/`); restraint comes from the token values (monochrome accent, hairline border, near-zero shadow). All states below.

- **Button (primary):** background `--color-accent` (`#111111`), text `#fff`, radius `--radius` (6px — crisp, never `rounded-full`), padding 10px/18px, weight 500, no box-shadow. Hover → `--color-accent-hover` (`#333333`). Active → `transform: scale(0.98)` tactile press. Focus → `--focus-ring` (quiet charcoal). Disabled → 45% opacity, `pointer-events:none`.
- **Button (secondary):** transparent background, `1px solid --color-border`, text `--color-text`. Hover → background `--color-surface-raised`. Active → `scale(0.98)`. Focus → `--focus-ring`.
- **Card (bento):** background `--color-surface-raised` or `#fff`, `1px solid --color-border`, radius `--radius` (8–12px max), padding 24–40px, shadow none at rest. Hover → ultra-subtle lift `0 2px 8px rgba(0,0,0,0.04)` over 200ms. Never a colored left border, never `rounded-full`.
- **Input:** background `#fff`, `1px solid --color-border`, radius `--radius-sm` (5px), padding 10px/12px, text `--color-text`, placeholder `--color-text-muted`. Label sits above; helper/error below. Focus → border `--color-text` + `--focus-ring`. Error → `--color-danger` border. Disabled → 45% opacity.
- **Badge / Tag:** pill (`--radius-pill`) is permitted for small tags only — 2px/10px padding, 11px weight 600 uppercase, `0.05em` tracking. Neutral = `--color-surface-raised` bg / `--color-text-muted`; status uses a desaturated pastel bg with its matching status text color.
- **Heading:** display serif (`--font-display`), weight 500, tight tracking. Levels 1–3 step 44 → 32 → 24px. Never set the sans family on h1–h3.
- **Stack:** layout primitive on the 8px unit; `gap` in unit multiples for vertical rhythm.

## 7. Motion & Interaction

Motion is invisible — present but never distracting. Scroll-entry: `translateY(12px)` + `opacity:0` resolving over `--motion-base` (600ms) with `--ease-standard` (`cubic-bezier(0.16,1,0.3,1)`), via `IntersectionObserver`. Hover transitions over `--motion-fast` (200ms) on shadow/color only; buttons `scale(0.98)` on `:active`. Lists/grids cascade with an `80ms` stagger — never mount everything at once. Animate exclusively `transform`/`opacity`; never layout-triggering properties. Optional single slow radial blob (`20s+`, opacity 0.02–0.04) on a `position:fixed; pointer-events:none` layer. Respect `prefers-reduced-motion`.

## 8. Voice & Brand

Plain, specific, confident — editorial, not promotional. Sentence case throughout; short declarative sentences. Use realistic, contextual content — never "John Doe", "Acme Corp", or "Lorem Ipsum". No AI copywriting clichés ("Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer", "Delve"). No emoji, no hype, no exclamation. The brand is quiet expertise and craft — it is **not** a generic SaaS landing page, not a marketing splash, not loud.

## 9. Anti-patterns

**Do**
- Set headlines in the editorial serif; set body/UI in the geometric sans.
- Keep every card, divider, and edge to `1px solid --color-border`.
- Lead with macro-whitespace; let pages breathe.
- Spend color only on meaning — desaturated pastels for status, monochrome everywhere else.
- Write realistic, specific copy.

**Don't**
- Use indigo/violet/purple or any off-token color → lint `ai-default-indigo`, `off-token-color`.
- Use gradients, neon, glassmorphism, or any blue→cyan "trust" gradient → lint `purple-gradient`, `trust-gradient`.
- Use heavy Tailwind drop shadows; shadows stay < 0.05 opacity.
- Put the sans family on headings → lint `sans-display` (headings bind the serif display face).
- Use `rounded-full` on cards or primary buttons, or a colored left-border card.
- Use emoji as icons → lint `emoji-icon`. Use Phosphor/Radix SVG primitives.
- Invent metrics or write filler / placeholder names → lint `invented-metric`, `filler-copy`.
- Pull broken external stock images → lint `external-image`; prefer local assets.
- Note: the accent is **monochrome** (accent = text = `#111111`), so the charcoal ink recurs across CTAs, links, and emphasis. `accent-overuse` is **exempted** for this system (see manifest) — it would false-positive on the deliberate one-color palette.

## 10. Tokens

See `tokens.css` for the machine contract (`:root` custom properties for every role above).
