# The Quality Gate — Iterate, Critique, Ship

## User story

> As a **frontend developer building UI components**,
> I want **an automated quality gate that checks my work from 4 independent angles**,
> So that **I never ship a component with broken tokens, visual regressions,
> or design inconsistencies.**

## Acceptance criteria

- Every component is automatically linted for token binding compliance
- Lint findings are visible in the addon panel with severity (P0/P1/P2)
- A visual baseline is established on first test; subsequent runs diff against it
- Visual diffs produce a pixelmatch image showing exactly what changed
- The 4-source critique (tokens, visual, vision, LLM) produces a single composite score
- Components must score >= 0.8 AND have mustFix === 0 to ship
- A single P0 issue blocks shipping regardless of composite score
- Per-source floor checks ensure no dimension drops below minimum
- The per-component ratchet prevents quality from regressing across iterations
- Capture seeds the baseline — no file moves, no generated/ directory

## Role

Frontend developer

## Effort

~2 seconds from component write to gate verdict
