---
name: design-md
description: Author or maintain a design system's DESIGN.md + tokens.css (the contract). Use when fixing the SYSTEM rather than a component — adding tokens, tightening anti-patterns, or capturing visual rules. Adapted from open-design's design-md (Google Labs / Stitch).
---

# design-md

Adapted from open-design's `design-md`. In medesign the DESIGN.md is the contract the agent builds *from* and
the graph + lint enforce, so changes here ripple — use the graph to see the blast radius.

## When to use
A finding's root cause is the **system**, not the component (e.g. a missing token role, a too-loose
anti-pattern, an under-specified component spec). `consistency-auditor` / `graph_where_to_fix` will say so.

## Steps
1. Read the target system's `design-systems/<id>/DESIGN.md` (the 9 sections) + `tokens.css`. Follow
   [`docs/spec.md`](../../../docs/spec.md) and the rubric in [`docs/authoring-design-systems.md`](../../../docs/authoring-design-systems.md).
2. Make the change with the quality bar: exact values, semantic role names, an explicit Anti-pattern if you're
   forbidding something. Keep `tokens.css` self-consistent (every role declared; every `var()` resolves).
3. **Assess impact** — `graph_find_affected('<ds>/--<token>')` before changing a token: which primitives,
   variants, stories, and artifacts move. Decide whether to re-baseline affected visual tests.
4. `medesign graph build <id>` to re-index, then re-verify affected components.

## Guardrails
- A system change is bigger than a component change — surface it to the human and note the affected set.
- Never weaken an anti-pattern just to make one component pass; fix the component instead.
