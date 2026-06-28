## Context

The emdesign addon has 5 toolbar tools today: comment, copy, reference, text edit, and wand (auto-fix). Users can point at an element and request a change, reference it in chat, or auto-fix issues. But **adding a new component** still requires: describing it in chat → waiting for the agent → iterating. For common patterns ("put a stats card here", "add a button below this section"), this round-trip is wasteful.

Phase 1 of the "Storybook as a design tool" vision (Properties panel + Wand + Diff) made the canvas interactive for *inspection* and *fixing*. The component placement tool makes it interactive for *composition*. Users should be able to point at a location in their story and say "put X there" — and have the system generate, inject, and verify it.

## Goals / Non-Goals

**Goals:**
- Add a new "Place" tool mode to the preview toolbar — user clicks an element, picks a component from a palette, and it's inserted into the story
- Build a component palette that lists all available components (DS primitives, generated, captured) grouped by category
- Support 4 insertion modes: before, after, inside, replace
- Generate the component if it doesn't exist yet (new intent), or reuse an existing one
- Inject the component JSX into the story source file at the correct location
- Re-verify the story renders correctly after injection
- Add `placement-workflow.js` that orchestrates the full pipeline

**Non-Goals:**
- Not building a visual drag-and-drop canvas — this is "click to place", not "drag to arrange"
- Not modifying existing component code (the new component is added, existing code stays intact)
- Not handling complex layout restructuring — only local insertion relative to a target element
- Not building a visual layout editor — the palette is a searchable list, not a drag surface

## Decisions

### 1. "Place" as a new tool mode in the existing element picker

The existing element picker (`preview.tsx`) handles click detection, element highlighting, and channel communication. Adding a `place` mode reuses all this infrastructure. When the user clicks an element in "place" mode, instead of opening a comment popover, it opens a component palette popover.

**Why:** Reuses all overlay infrastructure. Same mode-switching pattern as wand/copy/reference. No new DOM traversal or iframe communication code.

**Alternatives considered:** A separate floating "add component" button on the preview. Rejected — would conflict with existing toolbar and the element targeting is not precise.

### 2. Component palette as an inline popover (not a side panel)

The palette opens as a popover near the clicked element (like the comment popover today), showing a searchable list of components with categories. User types to filter or browses categories. On selection, the palette emits the placement intent and closes.

**Why:** Inline popover keeps the user's focus on the canvas — they see the target element while choosing. A side panel would split attention.

**Alternatives considered:** Side panel with drag-to-place. Rejected for Phase 1 — adds DnD complexity for marginal benefit.

### 3. Four insertion modes: before, after, inside, replace

When the palette opens, the user sees 4 placement options (as toggle buttons at the top):
- **Before** — insert the component above the target element in the story
- **After** — insert below the target element
- **Into** — insert as the last child of the target element (if it's a container)
- **Replace** — swap the target element with the new component

**Why:** Covers the common insertion patterns. "Before/After" handles linear stories. "Into" handles container stories (cards, sections). "Replace" handles substitution.

### 4. Placement orchestration as a workflow, not a backend endpoint

Like the auto-fix wand, placement runs as a JavaScript workflow (`placement-workflow.js`) in the agent harness. It receives the placement intent → checks if the component exists → generates if needed → injects into story source → re-verifies via doctor lint + visual.

**Why:** Workflows have built-in error handling, parallel execution, and rollback via git (the source file change can be reverted). No new backend endpoint needed.

### 5. Story source injection via AST-aware parsing, not regex

The story source injector reads the CSF file using the TypeScript parser (ts-morph or equivalent), finds the story's JSX template in the CSF `args` or render function, and inserts the new component JSX at the correct position relative to the target element.

**Why:** Regex-based injection is fragile — it breaks on formatting changes, comments, or non-standard templates. AST-aware parsing handles all valid TSX patterns and preserves formatting.

**Alternatives considered:** Regex injection (rejected — fragile), Template string manipulation (rejected — breaks on real-world code).

### 6. Guided mode only (no auto-place)

Unlike the wand which supports both guided and auto modes, placement always shows the palette first — the user chooses what to place and where. There's no "one-click place" because placement requires a component choice.

## Risks / Trade-offs

- **[Parsing] CSF files vary widely in structure**: Some use `args` with template strings, others use custom render functions. The injector must handle at least the common patterns (CSFv3 args, render functions). Mitigation: start with CSFv3 args pattern (the most common), fall back to template-string injection for other patterns.
- **[Generation] Component may not exist**: If the user picks a component that doesn't exist yet, the workflow generates it first. This adds latency but is handled by the existing `component-workflow`.
- **[Regression] Injection could break the story**: Mitigation: git-based rollback. The workflow commits before injection and reverts if verification fails.
- **[Scope] Palette shows many components**: Mitigation: search + category filtering makes the palette manageable. Show most-common primitives first (Button, Card, Heading, Stack, Input).
- **[CSF format] CSFv3 vs CSFv2**: Mitigation: target CSFv3 (the modern Storybook format) first. CSFv2 support can be added as `InjectorAdapter` implementations.
