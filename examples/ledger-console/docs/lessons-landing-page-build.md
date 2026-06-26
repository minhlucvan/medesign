# Lessons Learned: Landing Page Build Post-Mortem

**Date:** 2026-06-26
**Build:** view-loop → 6 leaf components → composed landing page
**Design system:** Digits Fintech Swiss ("ledger")
**Cost:** 181 agents, ~7.55M tokens, ~85 min wall-clock
**Result:** composite 0.574, threshold 0.8, mustFix 5, shipped: false

---

## Executive Summary

The medesign engine successfully decomposed a page brief, authored 6 on-system components through the design-loop gate, composed them into a single page, and ran the full four-source critique. The components are structurally sound, token-disciplined, and well-documented. **However**, the engine failed to deliver a production-grade page because of three critical issues:

1. The critique gate allowed a "continue" verdict despite composite below threshold **and** 5 blocking issues — it should have forced "revise"
2. No visual baselines were seeded, making visual regression testing decorative
3. The Tailwind config doesn't expose token colors as semantic utilities, forcing inline `var()` usage

---

## The Good

### 1. Progressive decomposition works
The page brief was correctly decomposed into 6 leaf components (NavigationBar, HeroSection, StatsSection, FeaturesSection, RoadmapSection, PageFooter), each authored independently then composed. No component re-implements another.

### 2. Token discipline is strong
No raw hex values leaked into components. Every color, font, and spacing references `var(--color-*)` / `var(--font-*)` / `var(--section-y)`. The DESIGN.md contract is honored.

### 3. Component interfaces are production-quality
Each component has:
- TypeScript interface with optional props + sensible defaults
- Full JSDoc explaining visual intent and design constraints
- Clean separation of content (props) from presentation (styles)

### 4. Four-source critique gate runs end-to-end
Vision (screenshot read), LLM (design-reviewer), tokens/lint (consistency-auditor), and visual (pixel diff) all produce scores. The composite score is computed with mustFix tracking.

### 5. Design system contract is comprehensive
DESIGN.md has all 9 sections (theme, color, typography, spacing, layout, components, motion, voice, anti-patterns) plus a machine-readable tokens.css. This is the right foundation.

---

## The Bad

### 1. Primitive API doesn't match DESIGN.md specs

| DESIGN.md spec | Heading primitive has | Gap |
|---|---|---|
| 86px (h1) | 44px (h1) | 2× undersized |
| 56px (h2) | 30px (h2) | ~1.9× undersized |
| 26px (subtitle) | 22px (h3) | undersized |
| 122px (mega numeral) | — | no escape hatch |

**Root cause:** `code/Heading.tsx` was written against an older spec and never re-synced when DESIGN.md was authored. Primitives are not validated against the design system contract on `create_design_system` / `update_design_system`.

**Fix:**
- After `create_design_system`, validate that `code/` primitives match the DESIGN.md spec section
- Re-scaffold primitives that are out of sync
- Add a "mega" / level-0 heading size for 122px numerals

### 2. No semantic Tailwind utilities for token colors

Components use inline `style={{ backgroundColor: 'var(--color-highlight)' }}` instead of `className="bg-highlight"`. This means:
- Tailwind JIT can't tree-shake them
- The style is invisible to the Tailwind purge step
- No `dark:` variant can be applied
- The component source is noisier

**Root cause:** `tailwind.config.js` doesn't map `--color-*` vars to semantic utility classes. The tokens.css declares the values, but Tailwind doesn't know about them.

**Fix:**
- On `create_design_system` / `update_design_system`, parse `tokens.css` and emit a tailwind config fragment
- Map every `--color-*` → Tailwind color utility (`bg-highlight`, `text-highlight-ink`, `border-border`, etc.)
- This eliminates inline `var()` in generated components and enables `dark:` variants by construction

### 3. Import path inconsistency in composed page

`landing.tsx` imports from **both** `src/generated/` and `src/components/`:

```
import { NavigationBar } from './NavigationBar';          // generated/
import { StatsSection } from './StatsSection';              // generated/
import { HeroSection } from '../components/HeroSection/...';  // captured
import { FeaturesSection } from '../components/FeaturesSection/...'; // captured
```

Half the components were captured (moved to `src/components/`), half weren't. The composed page shouldn't need to know about this split.

**Fix:** Make capture transactional — either capture all leaf components or capture none.

### 4. `new Date()` in PageFooter

```tsx
year = new Date().getFullYear()
```

This breaks:
- Workflow determinism/resume (banned in workflows)
- SSR/hydration (server and client render different years)
- Test reproducibility

**Fix:** Add `new Date()`, `Date.now()`, `Math.random()` to the lint/anti-slop rules as hard errors. Pass timestamps in via props.

### 5. Incomplete capture

2/6 components (NavigationBar, StatsSection) stayed in `src/generated/` while 4/6 were captured to `src/components/`. The capture wasn't transactional — partial capture leaves the project in an inconsistent state.

**Fix:** Make capture transactional (all or nothing). View-loop should verify capture succeeded for every leaf before composing.

### 6. Inbox intents never resolved to `done`

The state file still shows 3 create-view intents as `in_progress`. The workflow processed them but never marked them `done`.

**Fix:** Wire `resolve_intent` into the view-loop output. The inbox workflow should have a cleanup phase.

---

## The Ugly

### 1. Gate says "continue" when it should say "revise"

```
composite: 0.574   (threshold: 0.8)
mustFix: 5
decision: "continue"
```

The gate allowed passing despite **both** conditions failing: composite below threshold **and** blocking issues present. This is the single biggest engine bug.

A correct gate must enforce:
- `mustFix > 0` → ALWAYS `"revise"`, never pass
- `composite < threshold` → ALWAYS `"revise"` regardless of average
- `"continue"` should only fire when `composite >= threshold && mustFix === 0`

**Fix:** See `critique/scoreboard.ts` — `computeComposite` uses `continue` as fallback. MustFix must be a hard blocker.

### 2. No visual baselines

`lastDiff.status: "new"` — every visual test ran against a first-ever screenshot with no baseline. There is no regression detection. Without baselines, visual testing is decorative.

**Fix:** Add a `capture_baseline` MCP tool called after `capture_reusable_component`. It takes a Playwright screenshot of the captured story and saves it to `screenshots/<Name>.baseline.png`. `run_visual_test` then has a real baseline to compare against.

### 3. Design-loop doesn't truly iterate

The view-loop wraps design-loop for each component, but:
- The outer view-loop gate got "continue" and stopped after round 1
- The design-loop's own gate should have caught these issues
- Neither loop's iteration forced quality up to threshold

**Fix:** The gate fix in #1 above cascades — with mustFix-as-hard-blocker, neither loop can exit early with unresolved issues.

### 4. No dark mode in generated components

`tokens.css` has a full `[data-theme="dark"]` block with rewritten colors, but generated components don't use `dark:` Tailwind variants. The dark theme is dead code — switching the theme attribute would produce broken contrast.

**Fix:** When `[data-theme="dark"]` block exists in tokens.css, component prompts should include: "Generate `dark:` variants for every color utility, matching the tokens.css dark theme."

### 5. Cost-to-result ratio is unacceptable

- 181 subagents
- 7.55M output tokens
- ~85 min wall-clock
- Result: `shipped: false` for all components

For production use, the engine must either tighten loops (fewer/focused agents per component) or run cheaper models for mechanical stages.

---

## Root Causes Summary

| Issue | Root cause |
|---|---|
| Primitive/DESIGN.md mismatch | No validation after `create_design_system` checks primitives match spec |
| Inline `var()` instead of Tailwind classes | Tailwind config isn't auto-generated from tokens.css |
| Gate passes bad output | `mustFix` not treated as a hard blocker; `continue` used as fallback |
| No visual baselines | `capture_reusable_component` doesn't seed a baseline screenshot |
| Inconsistent capture | No transaction/rollback for multi-component capture |
| `new Date()` in output | No lint rule for non-deterministic code |
| Dark mode missing | Agent prompts don't reference the dark theme block |
| High cost | Redundant verification (leaf + page both run full four-source gate) |
| Intents not resolved | `view-loop` doesn't call `resolve_intent`; no cleanup phase |

---

## Recommendations

### Ship-blocking engine fixes

1. **Fix the gate** — `mustFix > 0` → "revise". `composite < threshold` → "revise". Add test cases.
2. **Auto-generate Tailwind config from tokens.css** — parse `--color-*` vars and emit semantic utilities.
3. **Add `capture_baseline` MCP tool** — seed visual baselines when a component is captured.

### Quality improvements

4. **Sync primitives on system create/update** — validate `code/` primitives against DESIGN.md spec sizes.
5. **Ban non-deterministic code** — `new Date()`, `Date.now()`, `Math.random()` → lint hard errors.
6. **Generate `dark:` variants automatically** when `[data-theme="dark"]` block exists.
7. **Make capture transactional** — all or nothing.

### Cost/performance

8. **Reduce redundant verification** — leaf components only need tokens/lint + visual during authoring; full four-source gate runs at compose time.
9. **Use cheaper models for mechanical stages** — lint, capture, visual test, graph rebuild don't need top-tier models.

---

## How to verify fixes

1. Run `create_design_system` → verify tailwind config fragment is generated with color utilities
2. Run `design-loop` with a component that has mustFix issues → verify gate returns "revise", not "continue"
3. Run `capture_reusable_component` → verify `capture_baseline` runs and produces a baseline screenshot
4. Run `create_component` → verify no `new Date()` / `Math.random()` in output
5. Run `validate_design_system` → verify Heading sizes are flagged as mismatched with DESIGN.md
6. Run the full view-loop again → verify composite >= threshold before "continue"
