---
name: Industrial Brutalist
category: Brutalist
surface: web
description: Tactical-telemetry brutalism — bone paper, carbon ink, one hazard-red accent, zero radius, visible grid.
version: 1.0.0
colors:
  surface: "#f4f4f0"
  text: "#050505"
  accent: "#e61919"
---

# Industrial Brutalist
> Category: Brutalist
> Surface: web
> Source: open-design/brutalist-skill — https://github.com/Leonxlnx/taste-skill

Raw mechanical interface — matte bone paper, full-strength carbon ink, one aviation-red accent, and a visible blueprint grid. Zero radius, no shadows, no gradients. Reads like a declassified equipment manual.

## 1. Visual Theme & Atmosphere

Industrial Brutalist commits to the **Swiss-Industrial Print** substrate: a matte, unbleached documentation paper (`#f4f4f0`) printed with full-strength carbon ink (`#050505`) and exactly one accent — aviation/hazard red (`#e61919`). The feeling is a 1960s machinery blueprint crossed with a tactical telemetry readout: monolithic heavy-grotesque headlines set against tight clusters of uppercase monospace metadata, everything anchored to a rigid CSS grid and segregated by visible `1px`–`2px` ink rules. There is no soft depth here — depth is communicated by compartmentalization, not elevation. Every corner is exactly 90 degrees; nothing glows, blurs, floats, or fades. Negative space is calculated, not decorative: vast empty fields frame viewport-bleeding numerals, then collapse into dense monospace data tables. The accent is a hazard signal, never decoration — a strike-through, a structural divider, a single vital readout. The optional terminal/signal green (`#4af626`) belongs only to a dark CRT mode and is omitted from this light substrate.

Foundational palette: bone paper `#f4f4f0`, panel `#eae8e3`, carbon ink `#050505`, hazard red `#e61919`. Borders are ink, not gray. Pick one substrate and never mix light and dark within a single interface.

## 2. Color

Components reference semantic roles only — never raw hex. The accent is the single hazard color; the border is ink, deliberately heavy.

| Role | Value | Use |
| --- | --- | --- |
| **Surface** | `#f4f4f0` | page substrate (bone paper) |
| **Surface raised** | `#eae8e3` | panels, compartments, raised plates |
| **Text** | `#050505` | carbon ink — primary foreground, headings, data |
| **Text muted** | `rgba(5,5,5,0.62)` | telemetry labels, metadata, unit IDs |
| **Accent** | `#e61919` | the one hazard accent — dividers, strike-throughs, vital data |
| **Accent hover** | `#c41212` | depressed/active accent |
| **Border** | `#050505` | full-strength ink rules, compartment dividers, crosshairs |
| **Success** | `#2f6b34` | positive status (signal-green `#4af626` reserved for dark CRT mode) |
| **Warn** | `#b45309` | caution status |
| **Danger** | `#b91c1c` | fault / destructive status |

Carbon ink `#050505` on bone `#f4f4f0` clears WCAG AAA. Hazard red `#e61919` is used for fills and rules, not body text. `--color-text-muted` at 62% ink stays above AA for metadata. Light substrate only; the dark tactical variant is a separate skin.

## 3. Typography

Typography is the structural infrastructure — imagery is secondary. The system demands extreme scale contrast: monolithic uppercase grotesk headlines against fixed-small uppercase monospace telemetry. Display is **Neue Haas Grotesk** (heavy/black); data and metadata are **JetBrains Mono**. The body sans (Inter) is a utilitarian fallback for running prose only.

| Role | Family | Size | Weight | Line-height | Tracking | Case |
| --- | --- | --- | --- | --- | --- | --- |
| Mega numeral | display | 160px | 900 | 0.85 | -0.06em | UPPER |
| Display XL | display | 96px | 800 | 0.88 | -0.05em | UPPER |
| Display L | display | 64px | 800 | 0.9 | -0.04em | UPPER |
| Display M | display | 44px | 700 | 0.95 | -0.03em | UPPER |
| Title | display | 30px | 700 | 1.0 | -0.02em | UPPER |
| Subtitle | display | 22px | 600 | 1.1 | -0.01em | UPPER |
| Heading | display | 18px | 700 | 1.15 | 0 | UPPER |
| Body L | sans | 18px | 400 | 1.5 | 0 | sentence |
| Body | sans | 15px | 400 | 1.5 | 0 | sentence |
| Body S | sans | 13px | 400 | 1.45 | 0 | sentence |
| Data L | mono | 14px | 500 | 1.3 | 0.05em | UPPER |
| Data | mono | 12px | 400 | 1.35 | 0.08em | UPPER |
| Telemetry | mono | 11px | 400 | 1.4 | 0.1em | UPPER |
| Unit ID | mono | 10px | 500 | 1.4 | 0.1em | UPPER |
| Code | mono | 13px | 400 | 1.5 | 0 | as-is |
| Label | mono | 11px | 600 | 1.2 | 0.1em | UPPER |

Macro headlines use fluid `clamp()` (e.g. `clamp(4rem, 10vw, 15rem)`) so they bleed aggressively across viewports. Headlines are exclusively uppercase. All metadata, navigation, coordinates, and unit IDs are uppercase monospace with generous mechanical tracking. High-contrast serif is allowed only as a degraded textural disruption (halftone/1-bit dither) — never as clean running text.

## 4. Spacing

Base unit **8px**. Scale: 0, 1, 2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Spacing is bimodal: telemetry clusters pack tight (4–8px between monospace rows) while macro-typography sits in vast calculated voids (96–128px). Prefer `gap: 1px` between grid children over `0.06)` of any soft shadow — razor-thin ink dividers are the spacing language. Compartment padding is flat 16–24px; section rhythm is `--section-y` (96px).

## 5. Layout & Composition

A strict **blueprint grid**: elements are anchored to CSS Grid tracks and intersections, never floated. Container max-width `--container-max` (1180px), but macro numerals are allowed to bleed past gutters. Visible compartmentalization is mandatory — `1px`/`2px solid` ink borders delineate every information zone, and full-width `<hr>` rules segregate operational units. Use `display: grid; gap: 1px` with contrasting parent/child backgrounds to render mathematically perfect hairline dividers. Layouts oscillate between extreme density (packed monospace tables) and aggressive asymmetric negative space. Crosshairs (`+`) mark grid intersections; barcode rules and warning stripes frame zones. Construct the DOM with precise semantic tags (`<data>`, `<samp>`, `<kbd>`, `<output>`, `<dl>`).

## 6. Components

Reuses the shared atelier primitives (`code/`); the brutalist character comes entirely from the token values (zero radius, ink borders, no shadow). All states below.

- **Button (primary):** background `--color-accent`, text `#fff`, radius `--radius` (0px — hard rectangle), padding 12px/20px, weight 600, uppercase. Hover → `--color-accent-hover`. Active → no transform, instant color snap (`--motion-fast`). Focus → `--focus-ring` (ink + red double outline). Disabled → 45% opacity, `pointer-events:none`.
- **Button (secondary):** transparent background, `2px solid --color-border` (ink), text `--color-text`, uppercase. Hover → background `--color-surface-raised`. Active → border stays, no lift. Focus → `--focus-ring`. Disabled → 45% opacity.
- **Card / Panel:** background `--color-surface-raised`, `1px solid --color-border`, radius `--radius` (0px), padding 24px, shadow `--shadow-raised` (none). Depth comes from the ink border, never elevation. Never rounded, never a colored left-only border.
- **Input:** background `--color-surface`, `1px solid --color-border`, radius `--radius-sm` (0px), padding 10px/12px, mono font, text `--color-text`, placeholder `--color-text-muted`. Focus → border `--color-accent` + `--focus-ring`. Disabled → 45% opacity. Error → `--color-danger` border.
- **Badge / Plate:** rectangular (`--radius-pill` = 0px), 2px/10px padding, 11px mono weight 600 uppercase, `0.1em` tracking. Neutral = `--color-surface-raised` bg / `--color-text` + ink border; accent = `--color-accent` bg / white text (hazard flag, counts toward the accent budget).
- **Heading:** display family (`--font-display`, heavy grotesk), uppercase, tracked tight. Levels 1–3 step down 44 → 30 → 22px. Never the body sans on a structural heading.
- **Stack:** layout primitive on the 8px unit; `gap` in unit multiples. Prefer `gap: 1px` with a contrasting background to draw ink dividers between rows.

## 7. Motion & Interaction

Mechanical and near-instantaneous. Color/border transitions `--motion-fast` (90ms); structural reveals `--motion-base` (140ms) with `--ease-standard`. No bounce, no parallax, no easing drama, no auto-playing motion, no fade-in choreography. Buttons snap on color only — no scale, no lift. Permitted "motion" is analog texture (static CRT scanlines, low-opacity grain) applied to fixed layers, never on scroll. Respect `prefers-reduced-motion`.

## 8. Voice & Brand

Terse, technical, declassified. Copy reads like equipment labels and operational logs: uppercase identifiers, unit codes, revision strings (`REV 2.6`, `UNIT / D-01`), coordinates. Industrial markers (`®`, `©`, `™`) and ASCII framing (`[ DELIVERY SYSTEMS ]`, `>>>`, `///`) act as structural graphics, not legal text. No marketing warmth, no hype, no emoji, no exclamation. The brand is mechanical authority — it is **not** a friendly consumer SaaS, not a startup landing page, not playful. State facts; let the grid carry the weight.

## 9. Anti-patterns

**Do**
- Commit to one substrate (light Swiss-Industrial here); keep every corner at 90 degrees (`--radius: 0`).
- Use full-strength ink borders and `gap: 1px` dividers for all compartmentalization.
- Reserve the hazard red for structural rules, strike-throughs, and single vital readouts.
- Set headlines in heavy uppercase grotesk; set all metadata in uppercase monospace.
- Use real telemetry copy (unit IDs, revisions, coordinates).

**Don't**
- Use indigo/violet/purple, or any color outside the token roles → lint `ai-default-indigo`, `off-token-color`.
- Use blue→cyan or any "trust" gradient, or gradients at all → lint `purple-gradient`, `trust-gradient`.
- Add `border-radius`, drop shadows, or glows — hard edges and flat fills only.
- Use emoji as icons → lint `emoji-icon`. Use ASCII glyphs / industrial marks instead.
- Invent metrics ("10× faster", "99.9% uptime") or write filler ("Feature one", "Lorem ipsum") → lint `invented-metric`, `filler-copy`.
- Pull external placeholder imagery → lint `external-image`. Brutalism is type-first; use generated grids/barcodes.
- Note: the accent (hazard red) is used heavily and structurally, so `accent-overuse` is **exempted** for this system (see manifest). The display face is a heavy grotesk *by design* — `sans-display` does not apply to its grotesk display token.

## 10. Tokens

See `tokens.css` for the machine contract (`:root` custom properties for every role above).
