## Why

The current design loop requires the user to manually spot visual issues, describe them in chat, wait for the AI to propose a fix, then manually iterate. For common visual problems — contrast violations, spacing misalignment, inconsistent geometry, broken grid rhythm — this round-trip is wasteful. The AI has all the tools to detect and fix these issues autonomously, but there's no single "fix this" command the user can invoke from the visual surface.

A **magic wand auto-fix** tool lets the user select a component or region in the preview, click a wand button, and have the system automatically: diagnose visual/geometric/accessibility issues, propose fixes, apply them, and re-verify — all in one shot.

## What Changes

- **Magic wand tool in the preview toolbar**: A new wand icon (🪄) alongside the existing comment, copy, reference, and text tools. When active, clicking an element triggers the auto-fix workflow rather than just selecting it.
- **Element selection → auto-fix pipeline**: Selecting an element with the wand active runs a multi-step diagnostic pipeline: `render analyze` (DOM tree + coordinates) → `spatial audit` (overlaps, grid alignment) → optional `vision critique` (LLM screenshot analysis) → issue aggregation → fix generation → fix application → re-verification.
- **Auto-fix issue types**: The wand detects and fixes: contrast/accessibility (color ratio violations), spacing rhythm (inconsistent padding/margin), alignment (off-grid elements), token binding (raw values that should be tokens), and visual polish (stray borders, inconsistent radii, font-size jumps).
- **Results panel**: After the fix runs, a collapsible results panel shows: what was detected (before/after scores), what was fixed (each fix with file:line), what couldn't be auto-fixed (needs human judgment).
- **Leverages existing infrastructure**: Builds on the element selection tool (ai-native-design-ide's reference mode) and the existing verification workflows (`spatial-fix.js`, `element-workflow.js`, `component-audit.js`).
- **One-click vs guided mode**: Default is one-click auto-fix (detect → fix → verify). An optional "guided" mode steps through each issue and asks for confirmation before applying.

## Capabilities

### New Capabilities
- `magic-wand-tool`: A new preview iframe tool (wand mode in the element picker) that, on element click, triggers the auto-fix workflow instead of just selecting. Shows a wand cursor, results panel in the manager UI.
- `auto-fix-workflow`: An orchestrator that chains: diagnostic probes (render analyze, spatial audit, vision critique) → issue aggregation → fix candidate generation → fix application → re-verification through the gate. Handles rollback on regression.
- `visual-diagnostic-aggregator`: Collects outputs from multiple diagnostic sources (deterministic geometry checks, optional LLM vision) into a unified, prioritized issue list with file:line locations and fix candidates.
- `fix-application-engine`: Applies auto-generated fixes to component source code. Each fix is a targeted, revertible edit. Tracks what was changed and why.

### Modified Capabilities
- *(none — this builds on existing capabilities but doesn't change their requirements)*

## Impact

- **`packages/addon/`**: New magic wand tool mode in the preview iframe's element picker (`preview.tsx`). New results panel component in the manager UI (`WandResultsPanel.tsx`). Channel events for wand activation and results streaming.
- **`packages/backend/`**: New orchestrator endpoint or MCP tool for the auto-fix workflow. Integration of render analyze, spatial audit, and vision critique into a pipeline.
- **`apps/workspace/templates/claude/workflows/`**: New `magic-wand-workflow.js` orchestrator that chains diagnostics → fix → verify. New `auto-fix.js` workflow for applying and reverting fixes.
- **`apps/workspace/templates/claude/commands/mds/`**: Optional `/mds:wand` command for CLI-triggered auto-fix on a named component.
