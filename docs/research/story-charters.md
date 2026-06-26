# Story Charters — Component-Level Validation for Storybook

> **A proposal to extend Element Charters from design-system-level to component/story-level,
> with a dedicated Storybook addon tab and doctor engine integration.**

---

## 1. Status Quo: What Element Charters Are Today

Element Charters (`packages/dsr/src/charters/`) provide **design-system-specific validation**
— deterministic rules that run against the knowledge graph or rendered DOM snapshots.
They live in `design-systems/<id>/charters/` as standalone JS modules:

```ts
// design-systems/atelier/charters/button-padding.ts
export default {
  name: 'button-padding',
  description: 'Buttons must have min 12px/20px padding',
  severity: 'P1',
  matcher: { type: 'dom-selector', selector: 'button, [role="button"]' },
  run(ctx) {
    return ctx.matchedElements
      .filter(el => {
        const { paddingLeft, paddingRight, paddingTop, paddingBottom } = el.node.styles;
        return parseInt(paddingLeft) < 12 || parseInt(paddingTop) < 8;
      })
      .map(el => ({
        id: 'insufficient-padding',
        severity: 'P1',
        message: `Button padding below minimum`,
        target: el.node.selector,
        remediation: 'Add px-3 py-2 or equivalent spacing',
      }));
  },
};
```

### Current Limitations

| Dimension | Status | Gap |
|-----------|--------|-----|
| Chartier definition location | `design-systems/<id>/charters/` | No per-component or per-story charters |
| Evaluation trigger | `gradeDesignSystem()` (manual run) | No automatic evaluation when viewing a story |
| Visual feedback | None | No Storybook addon UI to show findings |
| Reporting | Console warnings in `RuleEngine.evaluateCharters()` | Not surfaced in doctor reports |
| Scope | DS-wide: applies to all components of a matched type | Cannot express story-specific assertions |

---

## 2. Proposal: Story-Level Charters

### 2.1 Three Tiers of Charters

We introduce three tiers of charters, each scoping to a different level:

```
Design System Charters           →  design-systems/<id>/charters/
    ↓ applies to all components
Component Charters                →  Component.charters in CSF
    ↓ applies to all stories of that component
Story Charters                    →  MyStory.charters in CSF
    ↓ applies to one specific variant
Inline Charters                   →  parameters.charters in story
    ↓ one-off assertions per render
```

**Design System Charters** are what exists today — global rules like "all buttons have `min-height`".

**Component Charters** apply to every story of a component — e.g., "the Card component always shows its heading first".

**Story Charters** apply to one specific story — e.g., "the `Loading` variant displays a spinner".

**Inline Charters** are one-off assertions written inline as part of a story definition — they express specific expectations about this particular render.

### 2.2 Declaration Format in CSF

Charters would be declared using Storybook's CSF annotations, modeled on the existing
`play` function pattern:

```tsx
// src/components/Card/Card.stories.tsx
import type { StoryObj, Meta } from '@storybook/react';
import type { StoryCharter } from '@emdesign/dsr/charters';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  // Component-level charters — check every story of Card
  charters: [
    {
      name: 'has-heading',
      description: 'The Card always renders its heading',
      severity: 'P1',
      async run({ getByRole }) {
        const heading = await getByRole('heading', { level: 3 });
        if (!heading) throw new Error('Card must render an h3 heading');
      },
    },
  ],
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: { title: 'Hello', body: 'World' },
  // Story-level charters — check this specific variant
  charters: [
    {
      name: 'title-visible',
      description: 'The title text is visible',
      severity: 'P0',
      async run({ getByText }) {
        const title = await getByText('Hello');
        if (!title) throw new Error('Title "Hello" not found');
      },
    },
  ],
};

export const Loading: Story = {
  args: { loading: true },
  charters: [
    {
      name: 'shows-spinner',
      description: 'Loading state renders a spinner',
      severity: 'P1',
      async run({ container }) {
        const spinner = container.querySelector('[role="status"]');
        if (!spinner) throw new Error('Loading state must show a spinner element');
      },
    },
    // Inline: one-off assertion expressed inline
    {
      name: 'no-content-while-loading',
      description: 'No body text visible while loading',
      severity: 'P1',
      async run({ container }) {
        const body = container.querySelector('[data-testid="card-body"]');
        if (body && body.textContent) throw new Error('Body visible while loading');
      },
    },
  ],
};
```

### 2.3 Charter Interface (Story-Level)

The story-level charter interface is a simplified subset of the DS-level `ElementCharter`:

```ts
/** A charter defined at the story or component level in CSF. */
export interface StoryCharter {
  /** Unique name within the component namespace, e.g. "title-visible" */
  name: string;
  /** Human-readable description */
  description: string;
  /** Default severity when assertion fails */
  severity: 'P0' | 'P1' | 'P2';
  /** Optional CSS selector to identify the target element for display */
  target?: string;
  /**
   * The validation function.
   * Receives a StoryCharterContext with DOM query helpers scoped to the story root.
   * Throw to record a failure; return to pass.
   * Can be async (for waitFor, find* queries).
   */
  run(ctx: StoryCharterContext): Promise<void> | void;
}
```

The context object provides deterministic DOM queries without needing a full browser:

```ts
export interface StoryCharterContext {
  /** The story-root DOM element (#storybook-root) */
  container: HTMLElement;
  /** All render-probe data for this story (computed styles, layout) */
  snapshot: RenderSnapshot;
  /** Get an element by its text content */
  getByText(text: string, exact?: boolean): HTMLElement | null;
  /** Get an element by its ARIA role */
  getByRole(role: string, options?: { level?: number }): Promise<HTMLElement | null>;
  /** Query selectors within the story root */
  querySelector(selector: string): HTMLElement | null;
  querySelectorAll(selector: string): HTMLElement[];
}
```

### 2.4 What Charters Can Assert

Story charters are designed for **deterministic, structural assertions** about what renders:

| Category | Examples |
|----------|----------|
| **Presence** | "The heading renders", "The button has text", "The avatar image exists" |
| **Visibility** | "Loading state hides content", "Error state shows message", "Empty state shows CTA" |
| **Roles & a11y** | "Alert has `role=alert`", "Button has accessible name", "Image has `alt` text" |
| **Structure** | "First child is the badge", "List items are wrapped in `<ul>`" |
| **Tokens** | "Accent is used exactly once", "No raw hex values in custom styles" |
| **Layout** | "Button does not exceed container width", "Stack has correct gap" |

Charters **cannot** assert visual appearance (color, positioning, font rendering)
— those belong to visual regression tests and the vision critic.

---

## 3. Addon Tab: "Charters" Panel

### 3.1 Registration

A new full-page TAB registered in the existing addon pattern:

```ts
// packages/addon/src/manager.tsx
addons.add(CHART_TAB_ID, {
  type: types.TAB,
  title: 'Charters',
  route: tabRoute(VIEW_MODE_CHARTERS),
  match: ({ viewMode }) => viewMode === VIEW_MODE_CHARTERS,
  render: ({ active }) => (active ? <ChartersTab /> : null),
});
```

Constants:

```ts
// packages/addon/src/constants.ts
export const CHART_TAB_ID = `${ADDON_ID}/charters`;
export const VIEW_MODE_CHARTERS = 'emdesign-charters';
```

### 3.2 UI Layout

```
┌─────────────────────────────────────────────────────┐
│  Charters          ● 6 pass   ● 2 warn   ● 1 fail  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [Component] Card (3 charters, 2 pass / 1 warn)     │
│  ┌─────────────────────────────────────────────────┐ │
│  │ ✅ has-heading     Card renders h3 heading     │ │
│  │ ⚠️ accent-budget   Accent used 3× (limit: 2)   │ │
│  │ ✅ has-shadow      Card has shadow-raised       │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  [Story] Default (1 charter, 1 pass)                 │
│  ┌─────────────────────────────────────────────────┐ │
│  │ ✅ title-visible   "Hello" text found           │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  [Story] Loading (2 charters, 1 fail / 1 pass)       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ ✅ shows-spinner   Spinner element found         │ │
│  │ ❌ no-content      Body visible while loading   │ │
│  │    └─ fix: wrap body in {!loading && <Body />}  │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 3.3 Re-Evaluation

Charters are re-evaluated whenever the story changes:

1. The addon panel subscribes to Storybook's `SET_CURRENT_STORY` event
2. On story change, it reads the story's charters from the CSF parameters
3. The panel calls a backend endpoint or runs charters in-process via the preview iframe
4. Results are displayed with pass/fail/warn indicators

**Architecture option A: In-iframe evaluation (preferred)**

The charters `run()` function is executed inside the preview iframe (where the story
DOM lives). The story attaches charters to `window.__EMDESIGN_CHARTERS__` and the
addon panel communicates with the iframe via Storybook's channel API:

```
[Manager: ChartersTab]  ←channel→  [Preview: charterRunner]
                                        │
                                        ▼
                                  window.__EMDESIGN_CHARTERS__
                                  (per-component, per-story)
```

**Architecture option B: Backend evaluation**

The charters are extracted from the CSF file and sent to the emdesign backend,
which runs them against a render-probe `RenderSnapshot`. This is simpler but requires
parsing the CSF and serializing charters across the HTTP boundary.

### 3.4 Integration with Existing SystemTab

The charter summary (pass/fail counts) should also appear in the existing `SystemTab`
bottom panel, next to the lint pill:

```
[lint: OK]  [visual: pass]  [charters: 1 fail]  [scores: 0.82]
```

---

## 4. Doctor Engine Integration

### 4.1 Findings Flow

```
CSF charters
    │  extracted by addon at render time
    ▼
CharterRunner (in-iframe or backend)
    │  evaluates each charter's run() against live DOM / render snapshot
    ▼
CharterFinding[]  ──→  DoctorReport (new 'charter' category)
                           │
                           ▼
                      GradeReport.ratio
                      (blended with static + rendered lint)
```

### 4.2 New Finding Category

The `DoctorReport.byCategory` gains a `'charter'` category:

```ts
// packages/doctor/src/lint.ts
byCategory: {
  contract: { passed: 4, total: 5 },
  depth:  { passed: 2, total: 2 },
  charters: { passed: 5, total: 8 },  // NEW
  // ...
}
```

Each charter finding becomes a `DoctorFinding`:

```ts
{
  ruleId: 'charter/card/title-visible',
  category: 'charter',
  title: 'Title "Hello" not found in rendered DOM',
  severity: 'P0',
  pass: false,
  detail: 'Charter "title-visible" failed on component Card, story Default',
  target: 'Components/Card/Default',
  fix: 'Ensure the story renders an element containing the text "Hello"',
}
```

### 4.3 Collection Pipeline

When the doctor engine runs `gradeDesignSystem()`, it already:

1. Builds the graph
2. Runs static lint (DESIGN.md + tokens + conflicts)
3. Runs rendered lint (DOM snapshots → plugin rules)
4. Merges reports

**The charter phase slots into step 3:**

```
gradeDesignSystem()
    │
    ├── 1. Build graph
    ├── 2. Static lint (DESIGN.md + tokens + conflicts)
    ├── 3. Rendered lint ─┬── plugin rules (existing)
    │                      └── charter evaluation (NEW)
    │                           │
    │                           └── reads charters from generated/*.stories.tsx
    │                               renders each story via Playwright
    │                               runs each charter's run() in-page
    │                               collects findings
    ├── 4. Merge reports (static + rendered + charters)
    └── 5. Return GradeReport
```

### 4.4 MCP Tool

A new MCP tool for agent-driven charter evaluation:

```ts
server.registerTool('evaluate_story_charters', {
  description: 'Evaluate all charters defined on a component\'s stories. Returns pass/fail for each charter, suitable for agent self-check before capture.',
  inputSchema: {
    component: z.string().describe('Component name (PascalCase)'),
    story: z.string().optional().describe('Specific story to evaluate (default: all)'),
  },
}, async ({ component, story }) => {
  // 1. Read CSF from generated/ or components/
  // 2. Extract charters (component-level + matching story-level)
  // 3. Render each story via renderSnapshot
  // 4. Evaluate each charter's run()
  // 5. Return findings grouped by story
  return text(JSON.stringify(result, null, 2));
});
```

### 4.5 Gate Integration

Charter findings can optionally feed into the critique gate. When a component has
P0 charters that fail, the gate can reject it:

```ts
// In evaluate_component or ScoreCollector:
const charterFindings = await evaluateStoryCharters(paths, component);
const charterMustFix = charterFindings.filter(f => f.severity === 'P0' && !f.pass).length;
// Add to mustFix for the gate
```

---

## 5. Examples

### 5.1 Accessibility Charter

```tsx
export const WithError: Story = {
  args: { error: 'Invalid email' },
  charters: [
    {
      name: 'error-has-alert-role',
      description: 'Error state message has role="alert" for screen readers',
      severity: 'P0',
      run({ container }) {
        const msg = container.querySelector('[data-testid="error-message"]');
        if (msg && msg.getAttribute('role') !== 'alert') {
          throw new Error('Error message must have role="alert"');
        }
      },
    },
  ],
};
```

### 5.2 Structural Charter

```tsx
const meta: Meta<typeof Table> = {
  title: 'Components/Table',
  component: Table,
  charters: [
    {
      name: 'has-table-role',
      description: 'Table component renders a <table> element',
      severity: 'P2',
      run({ container }) {
        if (!container.querySelector('table')) {
          throw new Error('Table must render a native <table> element');
        }
      },
    },
    {
      name: 'header-row-count',
      description: 'Table has at least one header row',
      severity: 'P1',
      run({ container }) {
        const headers = container.querySelectorAll('thead tr, th');
        if (headers.length === 0) {
          throw new Error('Table must have at least one header row (<thead> or <th>)');
        }
      },
    },
  ],
};
```

### 5.3 Business Logic Charter

```tsx
export const ThreeItems: Story = {
  args: { items: ['A', 'B', 'C'] },
  charters: [
    {
      name: 'exact-item-count',
      description: 'The three items render as three list elements',
      severity: 'P1',
      run({ container }) {
        const items = container.querySelectorAll('[data-testid="list-item"]');
        if (items.length !== 3) {
          throw new Error(`Expected 3 items, found ${items.length}`);
        }
      },
    },
  ],
};
```

---

## 6. Implementation Path

### Phase 1 — CSF Annotations + Evaluation Engine

**Scope:** Define the `StoryCharter` type, parse charters from CSF, evaluate in-iframe.

| # | Item | Files | Effort |
|---|---|---|---|
| 1.1 | Define `StoryCharter` and `StoryCharterContext` types | `packages/dsr/src/charters/story-charter.ts` | Small |
| 1.2 | Create `StoryCharterRunner` — evaluates charters against live DOM | `packages/dsr/src/charters/runner.ts` | Medium |
| 1.3 | Create a `preview.ts` decorator that extracts charters from CSF and attaches to `window.__EMDESIGN_CHARTERS__` | `packages/addon/src/charters/preview.ts` | Medium |
| 1.4 | Add CSF `charters` field type augmentation for TypeScript users | `packages/dsr/src/charters/csf-augment.d.ts` | Small |

**Verification:** A Storybook story with `charters: [...]` has them evaluated on render.

### Phase 2 — Addon Tab

**Scope:** Storybook addon tab showing charter pass/fail.

| # | Item | Files | Effort |
|---|---|---|---|
| 2.1 | Create `ChartersTab.tsx` component | `packages/addon/src/charters/ChartersTab.tsx` | Medium |
| 2.2 | Register as TAB in `manager.tsx` | `packages/addon/src/manager.tsx` | Small |
| 2.3 | Add constants (`CHART_TAB_ID`, `VIEW_MODE_CHARTERS`) | `packages/addon/src/constants.ts` | Small |
| 2.4 | Wire channel communication between manager and preview | `packages/addon/src/charters/channel.ts` | Medium |
| 2.5 | Add charter summary pill to `SystemTab` | `packages/addon/src/SystemTab.tsx` | Small |

**Verification:** Navigating to the "Charters" tab shows pass/fail for the current story.

### Phase 3 — Doctor Integration

**Scope:** Charter findings collected in `DoctorReport`.

| # | Item | Files | Effort |
|---|---|---|---|
| 3.1 | Add `'charter'` category to `DoctorFinding` type | `packages/doctor/src/lint.ts` | Small |
| 3.2 | Create `lintCharters()` — reads CSF, renders stories, evaluates charters | `packages/doctor/src/charters.ts` | Large |
| 3.3 | Wire into `gradeDesignSystem()` in backend | `packages/backend/src/doctor.ts` | Medium |
| 3.4 | Add `evaluate_story_charters` MCP tool | `packages/mcp-server/src/mcp.ts` | Medium |
| 3.5 | Optional gate integration in `ScoreCollector` | `packages/backend/src/critique/collector.ts` | Small |

**Verification:** `gradeDesignSystem` returns a report with `byCategory.charters`.

### Phase 4 — Authoring Experience

**Scope:** Tooling to make writing charters frictionless.

| # | Item | Files | Effort |
|---|---|---|---|
| 4.1 | Scaffold charters as part of `emdesign init` or `create-component` | `packages/cli/src/commands/scaffold.ts` | Small |
| 4.2 | Add charter template to generated story files | `packages/backend/src/adapters/plugin-react.ts` | Small |
| 4.3 | Document charter authoring guide | `docs/guides/authoring-charters.md` | Medium |

---

## 7. Design Decisions

### Why in-iframe evaluation over backend?

Story charters run inside the preview iframe because:
- They have direct access to the live DOM (no serialization needed)
- They run synchronously or with simple async queries (no Playwright launch)
- They piggyback on Storybook's existing story lifecycle
- Backend evaluation is still needed for the doctor pipeline (Phase 3)

### Why CSF annotations over a separate file?

Putting charters in CSF keeps them co-located with the stories they validate:
- Story authors already understand CSF
- No separate charter file to maintain
- Chartriers naturally version with the component
- The `play` function pattern already established this convention

### Why not just use `play` functions?

Storybook's `play` functions are for **interaction testing** (clicks, inputs, assertions
that change state). Charters are for **structural validation** — they assert properties
of the rendered DOM without interacting. Key differences:

| Dimension | `play` function | Charter |
|-----------|----------------|---------|
| Purpose | Interaction testing | Structural validation |
| Runs after | Story renders | Story renders |
| Can click type | ✅ | ❌ (intentional) |
| Has severity | ❌ (pass/fail only) | ✅ P0/P1/P2 |
| Feed into gate | ❌ | ✅ via doctor |
| Addon tab | ❌ (test panel only) | ✅ dedicated tab |

---

## 8. Questions to Resolve

1. **Do charters run on every story render or on-demand?** In-iframe evaluation should
   run on every render for instant feedback. Backend evaluation is on-demand (via
   `gradeDesignSystem()` or the MCP tool). This matches the distinction between
   "dev feedback" and "CI verification."

2. **Should story charters be serializable across the channel?** Currently, functions
   (`run()`) cannot cross the Storybook channel. The in-iframe approach avoids this
   because the function runs inside the preview iframe. For backend evaluation, the
   CSF source is parsed via the graph parser.

3. **How do DS-level and story-level charters interact?** Both run. DS-level charters
   run against the render snapshot (existing `evaluateCharters` path). Story-level
   charters run against the live DOM. Findings from both are surfaced in the addon tab.

4. **Should charters be included in visual baseline snapshots?** No — charters are
   structural assertions, not visual. A charter change should not trigger a visual
   regression re-baseline.

---

## Key Files Reference

| File | Role |
|---|---|
| `packages/dsr/src/charters/charter.ts` | Existing `ElementCharter` interface (reference for `StoryCharter`) |
| `packages/dsr/src/charters/loader.ts` | Existing charter loader from `design-systems/<id>/charters/` |
| `packages/dsr/src/charters/matcher.ts` | Existing DOM matcher (`EcDomNode`, `buildDomTree`) |
| `packages/dsr/src/rules/engine.ts` | `RuleEngine.evaluateCharters()` — pattern for running DS-level charters |
| `packages/doctor/src/lint.ts` | `DoctorFinding`, `DoctorReport` types (new `charter` category) |
| `packages/doctor/src/rendered.ts` | `lintRendered`, `mergeReports` pattern to replicate for charters |
| `packages/backend/src/doctor.ts` | `gradeDesignSystem()` orchestration — where charters slot in |
| `packages/addon/src/manager.tsx` | Addon registration pattern — how to add new TABs |
| `packages/addon/src/ui.tsx` | Shared UI primitives (`Pill`, `Row`, `Section`, `SectionTitle`) |
| `packages/addon/src/constants.ts` | Addon constants — where new IDs go |
| `packages/addon/src/channel.ts` | Channel events — communication between manager and preview |
| `packages/mcp-server/src/mcp.ts` | MCP tool surface — where `evaluate_story_charters` is registered |
