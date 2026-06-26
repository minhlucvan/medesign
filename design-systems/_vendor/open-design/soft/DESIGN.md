---
name: Soft Studio
category: Expressive
surface: web
description: Awwwards-soft agency on OLED black — warm-cream monochrome type, pillowy squircle radius, diffused ambient depth, spring motion.
version: 1.0.0
colors:
  surface: "#050505"
  text: "#fdfbf7"
  accent: "#fdfbf7"
---

# Soft Studio
> Category: Expressive
> Surface: web
> Source: open-design/soft-skill — https://github.com/Leonxlnx/taste-skill

A $150k-agency dark aesthetic: deepest OLED black, warm-cream type, and a deliberately monochrome palette where the accent *is* the cream. Pillowy squircle radii, nested double-bezel cards, hugely diffused ambient depth, spring-physics motion.

## 1. Visual Theme & Atmosphere

Soft Studio is engineered to feel expensive and calm — Apple-keynote meets Linear, rendered on the deepest OLED black (`#050505`). There is no hue fighting for attention: type is a single warm cream (`#fdfbf7`), and the accent is that same cream, so the whole surface reads as one quiet material. Depth is *haptic*, not harsh — cards are built as nested "double-bezel" enclosures (a hairline outer shell in `rgba(253,251,247,0.06)` cradling an inner core with an inset top highlight), like a glass plate seated in a machined tray. Corners are generous squircles (20px+). Shadows are huge and diffused — a soft 80px ambient lift, never a hard `shadow-md`. Whitespace is doubled: sections breathe at `py-24` to `py-40`. Typography is wide geometric Grotesk for display and a refined humanist sans for body — never the default Inter/Roboto. The feeling: a piece of premium hardware photographed in a dark studio, restrained and tactile.

## 2. Color

Use semantic roles, never raw hex. This is a **monochrome dark** system — surface is OLED black, everything else is one warm cream at varying alpha. The accent equalling the text is intentional: there is no second color.

| Role | Value | Use |
| --- | --- | --- |
| **Surface** | `#050505` | page ground (deepest OLED black) |
| **Surface raised** | `#141414` | card inner core, raised panels |
| **Text** | `#fdfbf7` | primary type (warm cream) |
| **Text muted** | `rgba(253,251,247,0.64)` | secondary / meta cream |
| **Accent** | `#fdfbf7` | emphasis = the cream itself (monochrome by design) |
| **Accent hover** | `#e9e5dc` | accent / CTA hover, a touch dimmer |
| **Border** | `rgba(253,251,247,0.14)` | hairline cream seams, double-bezel rings |
| **Success** | `#15803d` | functional status only |
| **Warn** | `#b45309` | functional status only |
| **Danger** | `#b91c1c` | destructive / error |

Because accent = text, the usual "≤2 accents per screen" rule is exempt (`accent-overuse` exempted in manifest). Emphasis is carried by **weight, scale and the bezel**, not by color. Borders are cream-at-low-alpha so they glow faintly rather than reading as gray lines.

## 3. Typography

Display is a wide geometric Grotesk (Cabinet Grotesk / Clash Display); body is a refined humanist sans (Plus Jakarta Sans / Geist). Inter, Roboto, Arial, Open Sans and Helvetica are **banned**. Mono for data/labels only.

| Role | Family | Size | Weight | Line-height | Tracking |
| --- | --- | --- | --- | --- | --- |
| Hero | display | 96px | 600 | 1.0 | -0.02em |
| Display XL | display | 72px | 600 | 1.02 | -0.02em |
| Display L | display | 56px | 600 | 1.05 | -0.015em |
| Title | display | 40px | 600 | 1.1 | -0.01em |
| Subtitle | display | 28px | 500 | 1.2 | -0.005em |
| Section | display | 22px | 500 | 1.3 | 0 |
| Body XL | sans | 20px | 400 | 1.6 | 0 |
| Body L | sans | 18px | 400 | 1.6 | 0 |
| Body | sans | 16px | 400 | 1.65 | 0 |
| Body S | sans | 14px | 400 | 1.55 | 0 |
| Label | sans | 13px | 500 | 1.3 | 0.01em |
| Eyebrow Tag | sans | 10px | 500 | 1.2 | 0.2em (UPPERCASE) |
| Caption | sans | 12px | 400 | 1.4 | 0 |
| Code | mono | 13px | 400 | 1.5 | 0 |
| Data | mono | 15px | 500 | 1.3 | 0 |

Display sets large and tight (negative tracking); body stays airy at 1.6+ line-height. Eyebrow tags are the only uppercase, sit inside a pill, and always carry 0.2em tracking. Headings use the Grotesk display face — the deliberate sans display means `sans-display` is exempt for this system.

## 4. Spacing

Base unit **8px** (`--space-unit`). Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256. Macro-whitespace is the rule — double your instinct. Section vertical padding ranges 96–192px (`--section-y` = 96px floor). Card inner padding 24–32px; the double-bezel outer shell adds 6–8px around the core. Inline gaps 8–16px; stack gaps 24–48px.

## 5. Layout & Composition

Container max-width **1180px**, centered, with generous gutters. Layouts favor the asymmetric — a bento of varying card sizes or an editorial split (massive type left, content right) — never a symmetric 3-column Bootstrap grid. Components float on the black with diffused shadow rather than sitting in boxed rows. Navigation is a detached floating pill, not an edge-to-edge sticky bar. Below 768px everything collapses to a single `w-full` column with `px-4`; rotations and negative-margin overlaps are removed. Use `min-h-[100dvh]`, never `h-screen`.

## 6. Components

Reuse the atelier primitives (Button, Card, Input, Badge, Heading, Stack). On OLED black, borders are cream-alpha and the focus ring is cream, not blue.

- **Button (primary):** fully rounded pill (`--radius-pill`), background `--color-accent` (cream), text `#050505`, padding 12px/24px, weight 600. Hover → `--color-accent-hover` + the nested trailing-icon circle nudges diagonally. Active → `scale(0.98)` (physical press). Disabled → 40% opacity, no pointer. Focus → `--focus-ring` (cream ring).
- **Button (secondary):** transparent background, `1px solid --color-border`, text `--color-text`, pill radius. Hover → background `rgba(253,251,247,0.06)`. A trailing arrow lives in its own `rounded-full` circle, never naked.
- **Card:** double-bezel — outer shell `rgba(253,251,247,0.06)` with `1px solid --color-border` and `--radius`; inner core `--color-surface-raised`, `--radius-sm` smaller for concentric curves, inset top highlight `inset 0 1px 1px rgba(253,251,247,0.12)`, shadow `--shadow-raised`. Never a flat card directly on the ground; never a colored left border.
- **Input:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius-sm`, padding 12px/16px, text `--color-text`, placeholder `--color-text-muted`. Focus → border brightens toward `rgba(253,251,247,0.3)` + `--focus-ring`. Disabled → 45% opacity.
- **Badge:** eyebrow pill (`--radius-pill`), 4px/12px padding, 10px weight 500, uppercase 0.2em, `1px solid --color-border`, muted cream text.
- **Heading:** Grotesk display, weights 500–600, tight negative tracking per the scale.
- **Stack:** vertical rhythm on the spacing scale; default gap 24px; section blocks 96–192px.

## 7. Motion & Interaction

Every transition simulates real-world mass — custom springs, never `linear` or `ease-in-out`. Use `cubic-bezier(0.32,0.72,0,1)` over 600–800ms for entrances; hover/focus run faster on `--motion-fast` (120ms) but still eased. Scroll-entry: elements fade-up from `translateY(16px) blur(8px) opacity(0)` to rest via `IntersectionObserver` (never a scroll listener). Buttons press with `active:scale(0.98)` and an internal icon nudge. Animate only `transform` and `opacity`; `backdrop-blur` only on fixed/sticky chrome; grain on a fixed `pointer-events:none` layer. Honor `prefers-reduced-motion` — drop the spring and blur, keep a short fade.

## 8. Voice & Brand

Confident, spare, design-literate — like a top studio's case study, not a marketer. Short sentences, concrete nouns. Sentence case for body; tight display headlines; uppercase only inside eyebrow tags. No hype, no growth-hacking metrics, no emoji. The brand is calm, expensive restraint — it is *not* a busy SaaS hero, a rainbow gradient, or a "template with nice fonts."

## 9. Anti-patterns

**Do**
- Use the Grotesk display and humanist body; keep everything monochrome cream on black (`off-token-color`).
- Carry emphasis with weight, scale and the double-bezel — color stays single (`accent-overuse` exempt; depth via bezel + diffused shadow).
- Build cards as nested enclosures with cream-alpha hairlines and inset highlights.
- Breathe: section padding ≥ 96px, generous gaps.

**Don't**
- ❌ Indigo/violet/purple or blue→cyan gradients, or any second hue — the system is monochrome (`purple-gradient`, `trust-gradient`, `ai-default-indigo`).
- ❌ Banned fonts (Inter, Roboto, Arial, Open Sans, Helvetica) — Grotesk + humanist sans only.
- ❌ A rounded card with a colored left border, or a flat card straight on the ground (`left-accent-card`).
- ❌ Harsh dark `shadow-md` / `rgba(0,0,0,0.3)` drops or generic 1px gray borders — use diffused ambient depth + cream-alpha hairlines.
- ❌ Emoji as icons, invented metrics, or filler copy (`emoji-icon`, `invented-metric`, `filler-copy`).
- ❌ External placeholder images (`external-image`); raw hex in components (`off-token-color`).

## 10. Tokens

See `tokens.css` for the machine contract (`:root` custom properties for every role above).
