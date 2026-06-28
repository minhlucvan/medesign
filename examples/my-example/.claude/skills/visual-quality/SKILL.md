---
name: visual-quality
description: Deep visual and spatial analysis of rendered components. Use when a component looks wrong but lint passes, or for deterministic geometry checks (overlaps, alignment, contrast).
when: After `doctor` shows a visual/spatial failure, or to get precise numbers before a vision critique.
workflow: verify
commands: [render analyze, spatial audit, spatial grid, component a11y, component test, vision]
---

# Visual & Spatial Quality Skill

## Purpose

Move beyond subjective "looks off" feedback to deterministic geometry and contrast measurements. This skill teaches you to use Playwright-based render analysis, spatial auditing, a11y scanning, and AI vision critique — in that order of increasing cost.

## Prerequisites

All visual/spatial/a11y commands need Storybook running. Before starting, verify:

```bash
emdesign storybook health
```

If the status is `down`, start Storybook first with `emdesign up` or `npx storybook dev -p 6006`.
If `degraded`, fix high-severity issues before proceeding — compilation errors will cause false positives in render/spatial analysis.

## Workflow

```
0. Storybook Health → verify Storybook is ready
1. Render Analyze   → semantic DOM tree + coordinates + computed styles
2. Spatial Audit    → overlap detection, grid alignment, spacing metrics
3. A11y Audit       → axe-core violation tree (if applicable)
4. Component Test   → generate vitest tests (optional)
5. Vision Critique  → AI scores hierarchy/balance/spacing/onBrand/polish
```

## Step-by-Step

### 1. Render Analyze — "What does the DOM actually look like?"

```bash
emdesign render analyze <Component> [--story <name>] [--theme dark]
```

Captures the rendered component as a **semantic DOM tree** with:
- Bounding boxes (`rect: {x, y, w, h}`) for every visible element
- Computed styles (backgroundColor, color, fontSize, fontFamily, borderRadius, etc.)
- Text content for leaf nodes
- Max depth and total node count

**When to use:** Before any fix — get the ground truth. If the DOM structure is wrong (missing children, wrong nesting), fix that before tuning styles.

**Output interpretation:**
```json
{
  "tree": { "tag": "div", "rect": {"x":0,"y":0,"w":380,"h":140}, "children": [...] },
  "metrics": { "depth": 4, "nodeCount": 12 }
}
```

Look for:
- **Missing children** — component rendered empty? Check props.
- **Wrong coordinates** — `x:0, y:0` when it should be indented? Check parent layout.
- **Too many/few nodes** — unexpected wrapper elements or missing slots.

### 2. Spatial Audit — "Are elements colliding or misaligned?"

```bash
emdesign spatial audit <Component> [--grid]
```

Computes overlap detection and optional grid alignment measurement (default 8px grid).

**When to use:** After render analyze shows the right structure but positioning is off. Get precise px values for overlaps.

**Output interpretation:**
```
Overlaps: 2 (Card/Button:120px)
Grid (8px): 5 aligned, 3 violations
```

- **Overlaps > 0** — elements covering each other. Note the px values.
- **Grid violations** — elements not aligning to the design grid. Fix positioning.

### 3. A11y Audit — "Does it pass accessibility?"

```bash
emdesign component a11y <Component>
```

Runs axe-core via Playwright on the rendered story. Reports violations by impact level.

**When to use:** Before shipping any component. Especially important for interactive elements (buttons, inputs, links).

**Output interpretation:**
```
Violations: 3 (critical: 1, serious: 1, moderate: 1)
[critical] color-contrast: Text has insufficient contrast
  → <span class="text-muted">...</span>
[serious] aria-required-children: ARIA attribute not allowed
```

- **Critical/Serious** — must fix before ship
- **Moderate/Minor** — should fix, document if deferred

### 4. Vision Critique — "Does it look good?"

```bash
emdesign vision <Component> [--provider claude|gemini|minimax]
```

AI vision model scores the rendered component across 5 axes: hierarchy, balance, spacing, on-brand, polish. Each 0–1.

**When to use:** After deterministic checks pass and you need a human-like quality assessment. Use as a final gate before shipping.

## Command Reference

| Command | Purpose | Speed | Requires |
|---------|---------|-------|----------|
| `storybook health` | Verify Storybook readiness | ~3s | Running Storybook |
| `render analyze <comp>` | Semantic DOM tree + coordinates | ~3s | Storybook |
| `spatial audit <comp>` | Overlap + alignment detection | ~1s | Storybook |
| `spatial grid <comp>` | Grid adherence measurement | ~1s | Storybook |
| `component a11y <comp>` | Axe-core audit | ~5s | Storybook |
| `component test <comp>` | Generate vitest tests | ~2s | Component source |
| `vision <comp>` | AI visual critique | ~10s | Storybook + AI provider |

## Common Pitfalls

- **Skip render analyze for simple lint fixes** — if `doctor lint` shows a clear token violation, fix that first; don't run a full render.
- **Always run `storybook health` first** — if Storybook has compilation errors, visual/spatial/a11y commands will produce false positives. Fix the Storybook build before analyzing components.
- **Storybook must be running** — all visual/spatial/a11y commands need Storybook on :6006.
- **Axe-core only works browser-side** — if component doesn't render, a11y audit fails. Fix render first.
- **Vision critique is slowest** — run it last, only when deterministic checks pass.
- **Grid alignment expects 8px base** — use `--grid` only if the DS uses an 8px grid.
