## Context

**Current state:** The emdesign addon has a split UI for design system management:
- **System tab** (`DesignSystemTab.tsx`): My Systems browser + Catalog view with search, filter, preview. Has a "request a change" input for agent-driven iteration.
- **+ Create tab** (`CreateWizard.tsx`): A text-form creation wizard with 4 modes (brief/blank/import/extract). The "import (base)" mode shows a flat dropdown of 13 vendor bases — no preview, no customization.

The backend (`scaffold.ts`) has full capabilities: create, clone, customize, import from awesome-design-md, validate, compile, and scaffold primitives. A `customizeDesignSystem()` function exists but only modifies tokens via string replacement — no DESIGN.md generation, no agent workflow.

**The gap:** The agent loop — emdesign's core differentiator — is absent from DS creation. "Create from prompt" goes through `brief` mode (skeleton + agent prompt) but there's no structured workflow that takes a user from idea → complete tokenized system. The customization flow is invisible (flat dropdown), not visual. Post-creation iteration is limited to a single text input.

**Constraints:**
- All existing design system file formats (DESIGN.md, tokens.css, manifest.json) MUST remain compatible
- The agent workflow MUST not block the UI — progress reporting is required
- Backward compatibility with existing vendor bases and user-created systems

---

## Goals / Non-Goals

**Goals:**
- Provide 3 creation paths in the System tab: Import from prebuilt, Create from prompt, Upload DESIGN.md
- Agent-driven multi-stage workflow for prompt-based and DESIGN.md-based creation
- Visual 5-step customization flow for imported bases with live preview
- Conversational post-creation iteration (richer than current single text input)
- Token browser/editor and primitive scaffolding UI in the DS tab
- Real-time agent progress reporting during DS generation

**Non-Goals:**
- Not replacing the create-wizard for components, stories, or views (those stay in "+ Create")
- Not building a full design-tool (no Figma import, no pixel-level editing)
- Not generating production-ready CSS-in-JS output (tokens.css is the contract)
- Not building a design token diff/comparison tool (future concern)

---

## Decisions

### D1: Unify DS creation in System tab, simplify CreateWizard

**Decision:** Remove the 3 DS-related items from CreateWizard (`DesignSystemForm`) and move all DS creation into the System tab. The "+ Create" tab keeps Component, Story, and View forms only.

**Rationale:** The current split is confusing — System tab has "Catalog" and "My Systems" but the actual creation entry point is in a different tab. Unifying reduces cognitive load. The Catalog already shows vendor bases; adding creation paths there is the natural flow.

**Alternatives considered:**
- Keep both entry points → introduces sync issues and duplicates UI surface
- Remove catalog from System tab, put everything in CreateWizard → loses the visual browsing context

### D2: Agent workflow for DS generation uses staged MCP tools, not a monolithic agent

**Decision:** The create-from-prompt and create-from-DESIGN.md flows are implemented as a sequence of MCP tool calls dispatched by the backend, not a single monolithic agent session. Each stage (analyze → generate DESIGN.md → generate tokens → scaffold primitives → validate → build graph) is an independent tool call with progress reported to a workflow session.

**Rationale:** Monolithic agent sessions are opaque (user sees "agent thinking" with no granular progress) and hard to resume on failure. Staged MCP calls let the frontend show per-stage progress, retry individual stages, and cache results.

**Alternatives considered:**
- Single agent session with structured output → simpler but opaque progress
- Claude Code workflow → lives outside the app (not accessible from the addon UI)
- Sequential API calls with no agent → no creative generation, only templating

### D3: Customization flow uses query-parameter CSS injection for live preview

**Decision:** The customization preview loads `reference-example.html` in an iframe with CSS overrides passed as URL query parameters. The backend injects `<style>` overrides before serving the HTML.

**Rationale:** Already implemented in `basePreviewHtml()`. No cross-origin messaging, no iframe listener code needed in reference files. Each customization step triggers a new iframe load, but reference files are <10KB so this is fast.

**Alternatives considered:**
- postMessage-based live update → requires modifying all 13 reference-example.html files
- WebSocket push → overengineered for this use case
- Client-side rendering from tokens → duplicates the rendering engine

### D4: Agent refinement uses existing intent queue with a new session type

**Decision:** Post-creation ("request a change") uses the existing `submitIntent` mechanism but with a new intent type `refine-design-system` that creates a dedicated chat session. The agent can read the current system state (DESIGN.md, tokens.css, manifest) and write back modifications.

**Rationale:** The existing intent queue already handles async agent processing. Adding a new intent type is minimal code. The agent needs full system context to make informed changes, and a dedicated session provides that.

**Alternatives considered:**
- Direct token value editing (no agent) → limited to surface changes, can't regenerate DESIGN.md
- Inline agent in the addon panel → complex state management, no conversation history

### D5: Token manager is a read-write UI with inline editing

**Decision:** The token manager shows all tokens grouped by category (color, typography, shape, motion, layout) with inline value editing. Changes write directly to `tokens.css` via `POST /api/design-system/:id/tokens`. Primitive scaffolding uses the existing `scaffoldBlocks()` function with a one-click "Add primitive" button.

**Rationale:** Token editing is the most common post-creation action. Direct file editing is error-prone and requires knowing the token contract. A visual editor with validation prevents invalid values. The block registry already has 27 built-in primitives — scaffolding should be one click.

---

## Architecture

### Frontend Component Tree (System tab - redesigned)

```
DesignSystemTab
├── View toggle: [Design System | Catalog | Create New ▼]
│   │   (single DS per project — no chip list, no system switching)
│   │
│   ├── Design System (section-card dashboard for the active system):
│       │
│       ├── Branding Card ──────────────────────────────
│       │   ├── Name, description, category (from frontmatter)
│       │   ├── Brand voice/tone excerpt from DESIGN.md §8
│       │   ├── [Edit inline ✏️] → edit name/description
│       │   └── [Customize with AI 💬] → "Update branding: ..."
│       │
│       ├── DESIGN.md Card ─────────────────────────────
│       │   ├── Collapsed: title, first 3 lines preview
│       │   ├── Expanded: full markdown with formatting
│       │   ├── [Edit inline ✏️] → editable textarea
│       │   └── [Customize with AI 💬] → pre-fills chat: "Update DESIGN.md: ..."
│       │
│       ├── Colors Card ────────────────────────────────
│       │   ├── Color swatches with role labels
│       │   ├── Click swatch to edit hex inline
│       │   └── [Customize with AI 💬] → "Update colors: ..."
│       │
│       ├── Typography Card ────────────────────────────
│       │   ├── Font family tokens with preview text
│       │   ├── Click value to edit inline
│       │   └── [Customize with AI 💬] → "Update typography: ..."
│       │
│       ├── Spacing & Shape Card ───────────────────────
│       │   ├── Space unit, radius values
│       │   ├── Sliders for quick adjustment
│       │   └── [Customize with AI 💬]
│       │
│       ├── Motion Card ────────────────────────────────
│       │   ├── Duration, easing tokens
│       │   └── [Customize with AI 💬]
│       │
│       └── Primitives Card ────────────────────────────
│           ├── List of scaffolded components (Button, Card, etc.)
│           ├── [Add primitive +] → opens block registry picker
│           └── [Customize with AI 💬] → "Add/update primitives: ..."
│
├── Catalog (existing, enhanced)
│   ├── Search + filters
│   ├── BaseCard grid
│   └── BasePreview with [Use as Template →] button → opens Create New (Import path)
│
└── Create New (new — replaces CreateWizard DS forms, or opens directly when no DS exists)
    │
    ├── Path selector (step 1): 3 visual cards ──────────
    │   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │   │ 🖼 Gallery       │ │ 📝 From Prompt   │ │ 📄 DESIGN.md     │
    │   │ Pick a prebuilt  │ │ Describe in NL   │ │ Upload a spec    │
    │   │ design system    │ │ "dark editorial  │ │ file & auto-     │
    │   │ & customize it   │ │ with lime acc…"  │ │ generate tokens  │
    │   └─────────────────┘ └─────────────────┘ └─────────────────┘
    │
    ├── Gallery path (step 2-3): browse + customize ────
    │   │
    │   ├── Step 2: Gallery browser
    │   │   ├── Search bar + category filter pills
    │   │   ├── Card grid of vendor bases (existing CatalogView)
    │   │   ├── Click card → inline preview (tokens + iframe)
    │   │   └── [Select this base →]
    │   │
    │   └── Step 3: Quick-customize form
    │       ├── Name & ID fields (pre-filled from base)
    │       ├── Seed color picker (pre-filled from base accent)
    │       ├── Font selects (headline, body — pre-filled)
    │       ├── Roundness slider
    │       ├── Light/dark toggle
    │       ├── Live preview panel (right side, updates on change)
    │       └── [Create Design System →] → triggers workflow
    │
    ├── From Prompt path (step 2-3): prompt → progressive build ──
    │   │
    │   ├── Step 2: Prompt input
    │   │   ├── Textarea: "Describe your design system…"
    │   │   ├── Example prompts below:
    │   │   │   "Dark editorial with lime accent, serif headlines"
    │   │   │   "Minimal fintech, blue primary, Inter font"
    │   │   │   "Warm brand system, rounded corners, playful"
    │   │   ├── Name & ID fields
    │   │   └── [Generate →] → triggers workflow
    │   │
    │   └── Step 3: Progressive workflow progress
    │       ├── Live-updating stage list, each item shows:
    │       │   [✓] Analyzing prompt        ← done, 0.5s
    │       │   [〜] Generating DESIGN.md    ← in progress (3s)
    │       │   [ ] Generating tokens.css    ← pending
    │       │   [ ] Scaffolding primitives   ← pending
    │       │   [ ] Building graph           ← pending
    │       │   [ ] Validating               ← pending
    │       ├── Each stage shows timing + detail on hover
    │       ├── Intermediate preview panel (right):
    │       │   - As DESIGN.md is generated, first lines appear
    │       │   - As tokens are generated, swatches appear
    │       │   - As primitives scaffold, component list populates
    │       ├── [Cancel] button always available
    │       └── On completion → switch to Design System view
    │
    └── DESIGN.md path (step 2-3): upload → progressive build ──
        │
        ├── Step 2: File upload
        │   ├── Drag-and-drop zone or file picker
        │   ├── Validates: .md extension, valid YAML frontmatter
        │   ├── Parsed preview: shows name, category, sections found
        │   ├── Name & ID fields (pre-filled from frontmatter)
        │   └── [Generate Design System →] → triggers workflow
        │
        └── Step 3: Progressive workflow progress
            ├── Same stage list as prompt path, but adapted:
            │   [✓] Parsing DESIGN.md      ← done
            │   [〜] Extracting tokens      ← in progress
            │   [ ] Scaffolding primitives  ← pending
            │   [ ] Building graph          ← pending
            │   [ ] Validating              ← pending
            ├── Intermediate preview panel shows:
            │   - Extracted color palette as swatches
            │   - Extracted typography as font previews
            │   - Extracted spacing/shape values
            └── On completion → switch to Design System view
```

### Agent Workflow Stages — Progressive Feedback

Each artifact appears immediately as its stage completes. The user watches the system get built piece by piece, not a single "done" at the end.

```
User prompt: "dark editorial system with lime accent"

                     WORKFLOW PROGRESS                    INTERMEDIATE PREVIEW
┌─────────────────────────────────────────────────┐  ┌──────────────────────────┐
│ [✓] Analyzing prompt             0.4s           │  │ Mood: dark               │
│     → dark, editorial, lime accent              │  │ Category: editorial      │
│                                                 │  │ Accent: lime #84cc16     │
│ [〜] Generating DESIGN.md        2.1s ──running  │  │ ─────────────────────── │
│     → Writing Visual Theme...                   │  │ # Dark Editorial System  │
│                                                 │  │ Visual Theme & Atmosp…   │
│ [ ] Generating tokens.css        pending        │  │ A dark, serif-led…       │
│ [ ] Scaffolding primitives       pending        │  └──────────────────────────┘
│ [ ] Building graph               pending        │
│ [ ] Validating                   pending        │
└─────────────────────────────────────────────────┘

    ↓ stage completes ↓

┌─────────────────────────────────────────────────┐  ┌──────────────────────────┐
│ [✓] Analyzing prompt             0.4s           │  │ ┌──┐ ┌──┐ ┌──┐ ┌──┐    │
│ [✓] Generating DESIGN.md         3.2s           │  │ │██│ │██│ │██│ │██│    │
│ [〜] Generating tokens.css        1.1s ──running  │  │ │ac│ │su│ │tx│ │bd│    │
│     → Writing color tokens...                   │  │ └──┘ └──┘ └──┘ └──┘    │
│ [ ] Scaffolding primitives       pending        │  │ accent: #84cc16         │
│ [ ] Building graph               pending        │  │ surface: #1a1a1a        │
│ [ ] Validating                   pending        │  └──────────────────────────┘

    ↓ stage completes ↓

┌─────────────────────────────────────────────────┐  ┌──────────────────────────┐
│ [✓] Analyzing prompt             0.4s           │  │ ✓ Button  ✓ Card        │
│ [✓] Generating DESIGN.md         3.2s           │  │ ✓ Heading ✓ Text        │
│ [✓] Generating tokens.css        2.8s           │  │ ✓ Input   ✗ Badge       │
│ [✓] Scaffolding primitives       1.5s           │  │ ─────────────────────── │
│ [〜] Building graph              0.9s ──running  │  │ Token contract: 18/18   │
│ [ ] Validating                   pending        │  │ Graph: building...      │
└─────────────────────────────────────────────────┘  └──────────────────────────┘

    ↓ all stages complete ↓

┌─────────────────────────────────────────────────┐  ┌──────────────────────────┐
│ [✓] Analyzing prompt             0.4s           │  │ ✅ Design system ready!  │
│ [✓] Generating DESIGN.md         3.2s           │  │                          │
│ [✓] Generating tokens.css        2.8s           │  │ 18 tokens, 6 primitives  │
│ [✓] Scaffolding primitives       1.5s           │  │ All valid, graph built   │
│ [✓] Building graph              1.2s           │  │                          │
│ [✓] Validating                  0.3s           │  │ [View Design System →]   │
└─────────────────────────────────────────────────┘  └──────────────────────────┘
```

### Data Flow: Customization

```
User clicks "Use as Template" on base card
  → CustomizeFlow opens (5 steps)
  → Each step updates local state + triggers iframe reload with CSS params
  → Step 5: POST /api/design-systems/customize {
      baseRef, id, name,
      customizations: { seedColor, colorVariant, colorMode, headlineFont, bodyFont, roundness, spacing }
    }
  → Backend: clone base → modify tokens.css → validate → build graph
  → Response: { id, note, active: true }
  → Frontend: switch to Design System view, section cards show the new system
```

### Data Flow: Scoped Agent Refinement (per-section card)

Each section card's `[Customize with AI 💬]` button opens a scoped chat intent. The instruction is pre-filled with the section context so the agent knows exactly what to modify — no need to re-read the whole system.

```
User clicks [Customize with AI] on Colors card
  → Prompt: "Update colors: <free text>"
  → POST /api/intent {
      type: 'refine-design-system',
      instruction: user text,
      payload: { id, scope: 'colors' }   ← scope limits what agent modifies
    }
  → Agent reads: only color tokens from tokens.css + color section from DESIGN.md
  → Agent modifies: color tokens in tokens.css, color section in DESIGN.md
  → Agent rebuilds graph + validates
  → On completion, only the Colors card refreshes (not the whole page)

User clicks [Customize with AI] on Primitives card
  → Prompt: "Add a card component and style it with rounded corners"
  → POST /api/intent {
      type: 'refine-design-system',
      instruction: user text,
      payload: { id, scope: 'primitives' }
    }
  → Agent reads: current primitive list, block registry
  → Agent scaffolds Card.tsx from block registry
  → Agent may also adjust radius token if user asked for rounded corners
  → Primitives card refreshes with new component listed
```

**Scope values**: `branding`, `design-md`, `colors`, `typography`, `spacing`, `motion`, `primitives`, or `all` (default, current behavior).

---

## API Changes

### New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/design-systems/from-prompt` | Create DS from text prompt (triggers agent workflow) |
| POST | `/api/design-systems/from-design-md` | Create DS from uploaded DESIGN.md (triggers agent workflow) |
| GET | `/api/design-systems/:id/workflow-status` | Poll agent workflow progress (per-stage status) |
| GET | `/api/design-systems/:id/workflow-stream` | SSE stream for real-time workflow progress |
| POST | `/api/design-systems/:id/tokens` | Update tokens in bulk |
| POST | `/api/design-systems/:id/primitives` | Scaffold one or more primitives |
| GET | `/api/design-systems/create-options` | Get available create modes, sample prompts, and tips |

### Modified Endpoints

| Method | Path | Change |
|--------|------|--------|
| POST | `/api/design-systems/customize` | Add new customization options (labelFont, colorMode) |
| POST | `/api/intent` | Handle new `refine-design-system` intent type |

### New MCP Tools (for agent workflow stages)

| Tool | Input | Output |
|------|-------|--------|
| `analyze-design-prompt` | prompt: string | `{ mood, category, keywords, accentColor?, fonts? }` |
| `generate-design-md` | analysis + optional baseRef | DESIGN.md string |
| `generate-tokens` | designMd: string + id: string | tokens.css string |
| `refine-design-system` | id, instruction | `{ changes, note }` |

---

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent workflow takes too long (30s+) | User abandons creation | SSE progress stream shows per-stage status. Each stage is <10s. Timeout at 120s with partial result (user gets what was generated so far). |
| Agent generates low-quality DESIGN.md | System is unusable | Validation gate after generation — if token contract incomplete, agent retries. User can iterate via refinement. |
| Customization preview breaks for bases without reference-example.html | 4 of 13 bases show nothing | Show gradient placeholder generated from accent color + category. |
| Token editor writes invalid CSS | System breaks | Client-side validation before POST. Backend also validates via `validateDesignSystem()`. |
| DESIGN.md upload is too large | Memory pressure on backend | Limit to 256KB. Validate YAML frontmatter separately. |
| User wants to revert a refinement | No undo | Agent records pre-modification state at session start. Add a "revert" button that writes the snapshot back. |
