# Design System Browser — Browse, Preview, Customize & Create

> **A proposal to transform the current flat-dropdown creation flow into a rich
> visual gallery with preview, customization, and guided creation.**

---

## 1. Current State Audit

### The Creation Flow Today

The entire Design System creation UX is a single form in the "+ Create" tab
(`packages/addon/src/CreateWizard.tsx`, lines 92-143). When the user picks
"import (base)" mode, they get:

```
[id input]  [name input]  [mode: import ▼]

[base dropdown ▼]  ← 13 bases crammed into one <select>
[pick a base…]
[After Hours — Editorial]
[Industrial Brutalist — Brutalist]
[Deck — Guizang Editorial — Deck]
[...]

[optional notes input]

[Create design system button]
```

**What's missing:**

| Feature | Current | Needed |
|---------|---------|--------|
| **Visual gallery** | Flat `<select>` with text labels | Card grid with thumbnails, names, and descriptions |
| **Category browsing** | Category baked into option label | Filter pills, category sections |
| **Search** | None | Search by name, description, category |
| **Base preview** | No preview (just a description string) | Iframe of reference-example.html, token palette |
| **Pre-creation customization** | None — clone as-is | Color picker, font selector, roundness slider |
| **Live preview during customize** | None | Side-by-side preview panel |
| **Comparison** | None | Side-by-side base comparison |
| **Backend preview endpoints** | `GET /api/bases` (list only) | Preview render, base detail, customization |

### Assets Available on Disk

The `design-systems/_vendor/open-design/` directory contains 13 bases with
significant untapped preview content:

| Asset | Coverage | Size | Current Use |
|-------|----------|------|-------------|
| `reference-example.html` | 9 of 13 bases | 432–9,229 bytes | **Unused** |
| `assets/template.html` | 5 of 13 bases | — | **Unused** |
| `DESIGN.md` | 13 of 13 bases | Full spec | Used in agent prompt only |
| `tokens.css` | 13 of 13 bases | Full token contract | Used in agent prompt only |
| `manifest.json` | 13 of 13 bases | Metadata | Used in `listBases()` |
| `catalog.json` | 1 index file | 6,398 bytes | Used in `listBases()` as index |

The `reference-example.html` files are complete HTML renderings of each design
system's visual identity. They are currently **never served, rendered, or
referenced** by any code.

---

## 2. Proposed: Design System Browser UI

### 2.1 Tab Structure

The existing "System" tab is redesigned. Instead of one tab, we split into
two views controlled by a toggle at the top of the tab:

```
[  My Systems  ╎  Catalog ◀ ]    ← toggle
```

**My Systems** — The current `DesignSystemTab` experience: horizontal chips of
user-owned systems, token browser, diagnostics, raw source. Unchanged.

**Catalog** — A visual browser of all vendored bases (open-design), with
preview, filtering, and a "Use as template →" button that starts the
customization flow.

### 2.2 Catalog Layout

```
┌─────────────────────────────────────────────────────┐
│  Design System Catalog                               │
│  [search...]                                         │
│                                                      │
│  [All] [Editorial] [Brutalist] [Fintech] [Deck] …   │
│                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │ 🖼 preview   │ │ 🖼 preview   │ │ 🖼 preview   │    │
│  │ After Hours  │ │ Brutalist   │ │ Swiss        │    │
│  │ Editorial    │ │ Industrial  │ │ Creative     │    │
│  │ 432px ref    │ │ no ref img  │ │ 3523b ref    │    │
│  │ [Preview ▾]  │ │ [Preview ▾] │ │ [Preview ▾]  │    │
│  └─────────────┘ └─────────────┘ └─────────────┘    │
│                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │ 🖼 preview   │ │ 🖼 preview   │ │ 🖼 preview   │    │
│  │ Digits       │ │ Editorial   │ │ Field Notes  │    │
│  │ Fintech      │ │ Burgundy    │ │ Editorial    │    │
│  │ 8640b ref    │ │ 9005b ref   │ │ 9229b ref    │    │
│  │ [Preview ▾]  │ │ [Preview ▾] │ │ [Preview ▾]  │    │
│  └─────────────┘ └─────────────┘ └─────────────┘    │
└─────────────────────────────────────────────────────┘
```

#### 2.2.1 Search Bar

A text input at the top of the catalog that filters bases by name, category,
and description. Debounced (300ms) to avoid excessive re-renders. Uses the
existing `<Input>` component from `ui.tsx`.

#### 2.2.2 Category Filters

A row of pill/chip buttons matching the existing `<Chip>` pattern:

```
[All] [Editorial] [Brutalist] [Fintech] [Deck] [Minimalist] [Swiss] [Product] [Expressive]
```

Each pill toggles the category filter. Multiple categories can be selected
(OR logic). "All" clears all filters.

Base categories (from catalog.json):

| Category | Bases |
|----------|-------|
| Editorial | after-hours, editorial-burgundy, field-notes-editorial |
| Brutalist | brutalist |
| Fintech | digits-fintech-swiss |
| Deck | deck-guizang-editorial, deck-open-canvas, deck-swiss-international, keynote-warm |
| Minimalist | minimalist |
| Swiss | swiss-creative |
| Product | stitch |
| Expressive | soft |

#### 2.2.3 Card Grid

Each base card shows:

```
┌──────────────────────────┐
│ [reference-example       │  ← iframe preview OR placeholder gradient
│  iframe / screenshot]    │     (generated from primary color)
│                          │
│ ──────────────────────── │
│ Name                     │  ← base name (e.g. "After Hours")
│ Category pill            │  ← e.g. "Editorial"
│ Short description        │  ← from DESIGN.md frontmatter
│                          │
│ [Preview ▼] [Use →]      │  ← Preview expands inline; Use starts customize
└──────────────────────────┘
```

**Card states:**

| State | What Shows |
|-------|------------|
| **With reference** | Iframe of `reference-example.html` (or screenshot of it) |
| **Without reference** | Gradient generated from the base's primary `--color-accent` value |
| **Loading** | Skeleton pulse |
| **Hover** | Slight lift + shadow (CSS transform) |

### 2.3 Inline Preview Expansion

When the user clicks "Preview ▼" on a card, it expands to show:

```
┌─────────────────────────────────────────────────────┐
│  After Hours — Editorial                             │
│  ┌──────────────┐ ┌────────────────────────────────┐│
│  │  Tokens       │ │  Preview                      ││
│  │               │ │  ┌──────────────────────────┐ ││
│  │  ● #fbfaf7    │ │  │  reference-example.html  │ ││
│  │  ● #1a1714    │ │  │  in an iframe (600×400)  │ ││
│  │  ● #b4532a    │ │  │                          │ ││
│  │  ● #e6e1d8    │ │  └──────────────────────────┘ ││
│  │  …            │ │                               ││
│  │  Fonts:       │ │  [Close] [Use as template →]  ││
│  │  Display:     │ │                               ││
│  │  Newsreader   │ └────────────────────────────────┘│
│  └──────────────┘                                    │
│                                                      │
│  DESIGN.md excerpt (first 300 chars)                 │
│  "A warm, serif-led editorial system — ink-on-paper  │
│   calm, generous whitespace, one decisive accent."   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

The preview panel is a new component `<BasePreview>` that receives a base ID
and fetches detail from `GET /api/bases/:id/detail`.

The iframe preview loads the `reference-example.html` from
`GET /api/bases/:id/preview`. Bases without reference examples show an
informational state: "No preview available — this base has no reference example."

---

## 3. Preview System

### 3.1 Backend Endpoints

#### `GET /api/bases/:id/preview`

Serves the `reference-example.html` file for the given base, if it exists.
Returns 404 with a JSON error if no preview is available.

```typescript
// Response: HTML content with Content-Type: text/html
// If base has reference-example.html:
//   Status 200, Content-Type: text/html
// If base does not:
//   Status 404, { error: 'no preview available' }
```

Implementation: simple `fs.readFileSync` of
`design-systems/_vendor/open-design/<id>/reference-example.html`.

#### `GET /api/bases/:id/detail`

Returns full base metadata, token palette, and DESIGN.md excerpt.

```typescript
interface BaseDetailResponse {
  id: string;
  name: string;
  category?: string;
  surface?: string;
  description?: string;
  hasPreview: boolean;
  tokens: Array<{ role: string; kind: string; value: string }>;
  designMdExcerpt: string;
  fonts: { display?: string; body?: string; mono?: string };
  accentColor: string;
  source?: { type: string; skill?: string; upstream?: string; license?: string };
}
```

Implementation: reads tokens.css (parses `--color-*`, `--font-*` values), reads
the first 500 chars of DESIGN.md, reads manifest.json.

#### `GET /api/bases/:id/tokens`

Returns just the token palette for a base — lighter weight than the full detail.
Used by the customization preview to update colors in real time.

#### `GET /api/bases/categories`

Returns the distinct categories present in the catalog, with counts:

```typescript
interface CategoriesResponse {
  categories: Array<{ name: string; count: number }>;
}
```

Implementation: aggregates from catalog.json or filesystem scan.

### 3.2 Thumbnail Generation (Future)

For bases with `reference-example.html`, a build-time step can generate
screenshots of the reference examples using Playwright:

```bash
# In the doctor/lint pipeline, or as a one-off script:
for base in design-systems/_vendor/open-design/*/; do
  npx playwright screenshot "$base/reference-example.html" "$base/preview-thumbnail.png"
done
```

These thumbnails would be served at `GET /api/bases/:id/thumbnail`.

**Phase 1 approach:** Skip thumbnails and load the `reference-example.html` in
a sandboxed iframe directly. Lighter implementation, instant preview.

---

## 4. Customization Flow

When the user clicks "Use as template →" from a base card or the preview panel,
they enter a multi-step guided creation flow.

### 4.1 Step Form Layout

```
┌──────────────────────────────────────────────────────────┐
│  Step 1 of 5: Identity                [Next →]  [Cancel] │
│                                                          │
│  Based on: Industrial Brutalist                          │
│                                                          │
│  ID: ____my-brand__________________________________      │
│  Name: ____My Brand________________________________     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │  Live Preview Panel                                │  │
│  │  (shows reference-example.html with colors/fonts   │  │
│  │   updated in real-time via CSS variable injection)  │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Step Details

#### Step 1: Identity

| Field | Control | Default |
|-------|---------|---------|
| ID | Text input | `my-brand` |
| Name | Text input | `My Brand` |

The live preview panel updates the header to show the new name.

#### Step 2: Colors

| Field | Control | Default |
|-------|---------|---------|
| Seed color | Color input (`<input type="color">`) | Base's `--color-accent` |
| Color variant | `<select>` (Monochrome, Neutral, Tonal Spot, Vibrant, Expressive, Fidelity, Content, Rainbow, Fruit Salad) | `tonal-spot` |
| Light/dark mode | Toggle | `light` |

The color input is a native HTML `<input type="color">` (supported everywhere).
Color variant maps to the `--color-variant` theme option.

The live preview injects a `<style>` block into the iframe that overrides
`--color-accent` and `--color-surface` so the user sees the change instantly.

#### Step 3: Typography

| Field | Control | Default |
|-------|---------|---------|
| Headline font | `<select>` of available fonts | Base's `--font-display` |
| Body font | `<select>` of available fonts | Base's `--font-sans` |
| Label font | `<select>` of available fonts | Base's `--font-sans` |

Fonts are listed from the DESING.md font definitions (~68 available fonts from
the Google Fonts set supported by the design system).

The live preview updates the iframe's `font-family` on headlines and body text.

#### Step 4: Shape & Feel

| Field | Control | Default |
|-------|---------|---------|
| Roundness | Range slider (2/4/8/12/full) | Base's `--radius` |
| Spacing | Range slider (4/8/12/16) | Base's `--space-unit` |
| Design MD tone | Textarea | Base's existing tone — editable |

The roundness maps to the `--radius` token. The spacing maps to `--space-unit`.
Both update the preview in real time.

#### Step 5: Review & Create

```
┌─────────────────────────────────────────────────────┐
│  Summary                                            │
│                                                     │
│  Name:         My Brand                             │
│  Based on:     Industrial Brutalist                 │
│  Seed color:   #b4532a                              │
│  Variant:      tonal-spot                           │
│  Headline:     Newsreader (unchanged)               │
│  Body:         Inter (unchanged)                    │
│  Roundness:    rounded (changed from sharp)         │
│  Spacing:      8px (unchanged)                      │
│                                                     │
│  [← Back]  [Create Design System ✓]                 │
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │  Final preview with all customizations applied │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

On "Create," the frontend sends a `POST /api/design-systems/customize` request
with all the customization parameters. The backend generates the modified
`tokens.css` and `DESIGN.md` and creates the system.

### 4.3 Customize API

#### `POST /api/design-systems/customize`

```typescript
interface CustomizeRequest {
  /** Base ref to clone from */
  baseRef: string;
  /** New system ID */
  id: string;
  /** New system name */
  name: string;
  /** Customizations */
  customizations: {
    seedColor?: string;       // hex, e.g. "#b4532a"
    colorVariant?: string;    // e.g. "tonal-spot"
    colorMode?: 'light' | 'dark';
    headlineFont?: string;
    bodyFont?: string;
    labelFont?: string;
    roundness?: 'ROUND_FOUR' | 'ROUND_EIGHT' | 'ROUND_TWELVE' | 'ROUND_FULL';
    spacing?: number;         // base unit in px
    designMdTone?: string;    // replacement text for DESIGN.md
  };
}

interface CustomizeResponse {
  id: string;
  name: string;
  path: string;
  tokensCss: string;
  designMd: string;
}
```

Implementation in `packages/backend/src/scaffold.ts`:

```
customizeDesignSystem(paths, req)
  │
  ├── 1. Copy base from _vendor/open-design/<id> to design-systems/<new-id>
  ├── 2. Rewrite manifest.json (new id, name, remove vendor source)
  ├── 3. Modify tokens.css:
  │     ├── --color-accent → req.customizations.seedColor
  │     ├── --font-display → req.customizations.headlineFont
  │     ├── --font-sans → req.customizations.bodyFont
  │     ├── --radius → req.customizations.roundness
  │     ├── --space-unit → req.customizations.spacing
  │     └── --color-surface (dark mode if requested)
  ├── 4. Prepend customization note to DESIGN.md (or replace tone)
  ├── 5. Run token validation
  ├── 6. Build graph
  └── 7. Return result
```

### 4.4 Live Preview Panel Component

The live preview is a new React component `<CustomizationPreview>` that:

1. Renders a sandboxed `<iframe>` loading `GET /api/bases/:id/preview`
2. Listens for customization changes passed as props
3. Injects `<style>` overrides into the iframe via `postMessage`:
   ```js
   // Sent to the iframe
   iframe.contentWindow.postMessage({
     type: 'emdesign-customize',
     css: `:root {
       --color-accent: #b4532a;
       --font-display: 'Newsreader', serif;
       --radius: 12px;
     }`,
   }, '*');
   ```
4. The `reference-example.html` file must listen for this message and apply
   the overrides (a one-time addition to the HTML files, or handled via a
   proxy that wraps the HTML with a listener).

An alternative (simpler) approach: instead of postMessage, the preview endpoint
accepts query parameters for customization:

```
GET /api/bases/:id/preview?seedColor=b4532a&radius=12px
```

The backend injects the CSS overrides before serving the HTML. This avoids
cross-origin iframe messaging entirely.

---

## 5. Backend Changes Summary

| Endpoint | Method | Purpose | New? |
|----------|--------|---------|------|
| `/api/bases` | GET | List all bases (exists) | Kept as-is |
| `/api/bases/categories` | GET | List categories with counts | **New** |
| `/api/bases/:id/detail` | GET | Full base detail (tokens, DESIGN.md excerpt) | **New** |
| `/api/bases/:id/preview` | GET | Serve `reference-example.html` with optional CSS overrides | **New** |
| `/api/bases/:id/tokens` | GET | Token palette only (lightweight) | **New** |
| `/api/design-systems/customize` | POST | Clone base + apply customizations | **New** |
| `/api/design-systems/create` | POST | Direct creation (alternative to intent queue for customized systems) | **New** |

### Backend Files to Modify

| File | Changes |
|------|---------|
| `packages/backend/src/scaffold.ts` | Add `customizeDesignSystem()`, `baseDetail()`, `basePreviewHtml()` |
| `packages/backend/src/http.ts` | Add 6 new routes for bases/* and customize |
| `packages/backend/src/index.ts` | Export new functions |

---

## 6. Frontend Components Summary

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| `<CatalogView>` | `packages/addon/src/ds-browser/CatalogView.tsx` | Search, filter pills, card grid |
| `<BaseCard>` | `packages/addon/src/ds-browser/BaseCard.tsx` | Single base card with preview iframe |
| `<BasePreview>` | `packages/addon/src/ds-browser/BasePreview.tsx` | Expanded preview panel (tokens + iframe) |
| `<CustomizeFlow>` | `packages/addon/src/ds-browser/CustomizeFlow.tsx` | Multi-step customization form |
| `<CustomizationPreview>` | `packages/addon/src/ds-browser/CustomizationPreview.tsx` | Live preview iframe with CSS injection |
| `<ColorPicker>` | `packages/addon/src/ds-browser/ColorPicker.tsx` | Color input + variant selector |
| `<FontPicker>` | `packages/addon/src/ds-browser/FontPicker.tsx` | Font family dropdown |
| `<RoundnessSlider>` | `packages/addon/src/ds-browser/RoundnessSlider.tsx` | Roundness range slider |

### Modified Components

| Component | Changes |
|-----------|---------|
| `DesignSystemTab.tsx` | Add Catalog/My Systems toggle |
| `manager.tsx` | Possibly remove separate "System" and "+ Create" tabs in favor of unified tab |
| `api.ts` | Add `getCategories()`, `getBaseDetail()`, `getBasePreview()`, `customizeDesignSystem()` |
| `constants.ts` | Add new types (`BaseDetailResponse`, `CustomizeRequest`, etc.) |

### Typography

The font family list used in the `<FontPicker>` dropdown should come from
the base detail response's available fonts (parsed from DESIGN.md), with a
fallback to the canonical set of ~68 Google Fonts supported by the tool.

---

## 7. Implementation Phases

### Phase 1 — Catalog Browsing (Effort: ~3 days)

| # | Item | Files |
|---|------|-------|
| 1.1 | Add backend endpoints: `GET /api/bases/:id/detail`, `GET /api/bases/:id/preview`, `GET /api/bases/categories` | `packages/backend/src/scaffold.ts`, `http.ts` |
| 1.2 | Create `<CatalogView>` with search, category filters, card grid | `packages/addon/src/ds-browser/CatalogView.tsx` |
| 1.3 | Create `<BaseCard>` with iframe preview loading | `packages/addon/src/ds-browser/BaseCard.tsx` |
| 1.4 | Create `<BasePreview>` expanded detail panel | `packages/addon/src/ds-browser/BasePreview.tsx` |
| 1.5 | Add `getCategories()`, `getBaseDetail()`, `getBasePreview()` to API client | `packages/addon/src/api.ts` |
| 1.6 | Wire catalog into DesignSystemTab with toggle | `packages/addon/src/DesignSystemTab.tsx` |

**Verification:** User can browse all 13 bases as cards, filter by category,
search by name, click a card to see token palette + iframe preview.

### Phase 2 — Customization Flow (Effort: ~5 days)

| # | Item | Files |
|---|------|-------|
| 2.1 | Add `POST /api/design-systems/customize` endpoint | `packages/backend/src/scaffold.ts`, `http.ts` |
| 2.2 | Create `<CustomizeFlow>` multi-step form | `packages/addon/src/ds-browser/CustomizeFlow.tsx` |
| 2.3 | Create Step 1: Identity form | `packages/addon/src/ds-browser/steps/IdentityStep.tsx` |
| 2.4 | Create Step 2: Color picker + variant | `packages/addon/src/ds-browser/ColorPicker.tsx` |
| 2.5 | Create Step 3: Font selection | `packages/addon/src/ds-browser/FontPicker.tsx` |
| 2.6 | Create Step 4: Roundness + spacing | `packages/addon/src/ds-browser/RoundnessSlider.tsx` |
| 2.7 | Create Step 5: Review & Create | `packages/addon/src/ds-browser/steps/ReviewStep.tsx` |
| 2.8 | Implement `<CustomizationPreview>` with CSS parameter injection | `packages/addon/src/ds-browser/CustomizationPreview.tsx` |
| 2.9 | Add `customizeDesignSystem()` API method | `packages/addon/src/api.ts` |

**Verification:** User can pick a base, go through 5-step customization,
see live preview updates, and click "Create" to produce a customized system.

### Phase 3 — Polish & Edge Cases (Effort: ~2 days)

| # | Item | Files |
|---|------|-------|
| 3.1 | Handle bases without reference-example.html (gradient placeholder) | `BaseCard.tsx` |
| 3.2 | Error handling: backend down, base missing, customization invalid | All components |
| 3.3 | Loading skeletons for cards and previews | `BaseCard.tsx`, `BasePreview.tsx` |
| 3.4 | Empty states: no search results, no bases | `CatalogView.tsx` |
| 3.5 | Keyboard navigation: arrow keys between cards | `CatalogView.tsx` |
| 3.6 | Responsive grid: 3 columns → 2 columns → 1 column | `CatalogView.tsx` |

---

## 8. Design Decisions

### Why iframe preview over screenshots?

Screenshots require a build step (Playwright), are static, and can't reflect
customizations in real time. Iframes load the existing `reference-example.html`
files directly — no build step, and CSS variable injection enables live preview.

### Why query-parameter CSS injection over postMessage?

Query parameters on the preview URL are simpler: the backend reads the params,
generates the CSS overrides, and serves the modified HTML. No cross-origin
messaging, no iframe listener code needed in the reference files. The tradeoff
is that each customization step requires a new iframe load, but since the
reference HTML files are small (<10KB), this is acceptable.

### Why a multi-step form instead of a single page?

A step form guides the user through decisions in a logical order. Each step
has a clear focus (identity → colors → typography → shape → review). This
reduces cognitive load compared to a single page with 10+ controls. Each
step can validate before proceeding.

### How do customizations map to design system tokens?

Each customization control maps to one or more CSS custom properties in the
`tokens.css` file:

| Control | Token(s) |
|---------|----------|
| Seed color | `--color-accent`, `--color-accent-hover` (generated) |
| Color variant | `--color-variant` (affects palette generation) |
| Color mode | `:root` vs `[data-theme="dark"]` block |
| Headline font | `--font-display` |
| Body font | `--font-sans` |
| Label font | `--font-label` (if supported) |
| Roundness | `--radius` |
| Spacing | `--space-unit` |

---

## 9. Mockup: Full User Flow

```
┌──────────────────────────────────────────────────────┐
│  User Journey Map                                     │
│                                                       │
│  1. Opens "System" tab                                │
│     └─ Sees "My Systems | Catalog" toggle             │
│                                                       │
│  2. Clicks "Catalog"                                  │
│     └─ Sees 13 base cards in grid                     │
│        └─ Can filter by category                      │
│        └─ Can search by name                          │
│                                                       │
│  3. Hovers over "Editorial Burgundy" card             │
│     └─ Card lifts slightly (CSS transform)            │
│                                                       │
│  4. Clicks "Preview ▼" on the card                    │
│     └─ Card expands to show:                          │
│        ├─ Token palette (colors, fonts)               │
│        ├─ reference-example.html in iframe            │
│        └─ DESIGN.md excerpt                           │
│                                                       │
│  5. Clicks "Use as template →"                        │
│     └─ Enters customization flow (Step 1 of 5)        │
│        ├─ Step 1: Set name/id (with preview)          │
│        ├─ Step 2: Pick accent color (with preview)    │
│        ├─ Step 3: Pick fonts (with preview)           │
│        ├─ Step 4: Set roundness/spacing (preview)     │
│        └─ Step 5: Review all + "Create"               │
│                                                       │
│  6. Clicks "Create Design System"                     │
│     └─ POST /api/design-systems/customize             │
│        └─ System created, appears in My Systems       │
│           └─ Can immediately use with agent           │
└──────────────────────────────────────────────────────┘
```

---

## Key Files Reference

| File | Role |
|------|------|
| `packages/addon/src/CreateWizard.tsx` | Current creation UI — the `<DesignSystemForm>` is the baseline |
| `packages/addon/src/DesignSystemTab.tsx` | Existing system browser — pattern for chips, token grid, detail view |
| `packages/addon/src/ui.tsx` | Shared primitives: `Page`, `PageTitle`, `Chip`, `Pill`, `Row`, `Stack`, `Input`, `Btn`, `Section`, `Swatch` |
| `packages/addon/src/api.ts` | HTTP client — add `getCategories()`, `getBaseDetail()`, `getBasePreview()`, `customizeDesignSystem()` |
| `packages/addon/src/constants.ts` | Types — `BaseDetailResponse`, `CustomizeParams`, etc. |
| `packages/addon/src/manager.tsx` | Addon registration — may need to adjust tab structure |
| `packages/backend/src/scaffold.ts` | `createDesignSystem()`, `listBases()` — add `customizeDesignSystem()`, `baseDetail()`, `basePreviewHtml()` |
| `packages/backend/src/http.ts` | HTTP routes — add `GET /api/bases/:id/detail`, `GET /api/bases/:id/preview`, `POST /api/design-systems/customize` |
| `design-systems/_vendor/open-design/catalog.json` | Catalog index — may extend with `hasPreview`, `accentColor`, `fontFamilies` fields |
| `design-systems/_vendor/open-design/*/reference-example.html` | Visual preview files — 9 bases have them, served via `/api/bases/:id/preview` |
