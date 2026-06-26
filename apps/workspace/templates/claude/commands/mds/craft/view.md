---
name: "MDS: Craft View"
description: Craft a large, complex page (e.g. a landing page) by progressive decomposition — gather requirements, decompose into components, author or reuse each (gated), compose into the page, and verify the whole. Component-based and on-system.
category: Craft
tags: [craft, view, page, decomposition, composition, feedback-loop]
---

# MDS: Craft View

A **view** is a full page/screen built by **progressive decomposition**: the page is decomposed into
sections → components; missing components are authored (each through the component gate) or reused, then
composed into the page and verified as a whole. The result is a real, component-based, on-system page —
not one monolithic blob.

**Input**: a page brief + optional PascalCase `name`.
Example: `/mds:craft:view "a landing page for an AI notetaker — hero, features, pricing, testimonial, CTA" Landing`

## Workflow
1. **Gather requirements.** Use `AskUserQuestion` to fill the gaps the brief leaves open — audience, the
   **section list**, key copy/CTAs, must-haves, and the quality `threshold` (default 0.8). Keep it tight
   (the brief + a couple of decisive questions). Use the `page-architect` skill for the methodology.
2. **Run the engine.** `Workflow({ name: 'view-loop', args: { name, instruction: <refined brief + sections>, threshold } })`.
   The engine: **Decompose** (brief + `get_design_context` + `graph_query` → a component tree, reuse-vs-author
   per leaf, written to `design/changes/<slug>/plan.json`) → **Author** the missing leaves (each via a nested
   `design-loop` component gate, then `capture_reusable_component`) while reusing existing ones → **Compose**
   the page importing those components → **Verify** the whole page (visual + vision + LLM + rule → `critique_score`),
   revising until the page gate passes.
3. **Review.** Present the PagePlan tree, the per-component results, and the page-level scores.
4. **Ship.** Human checkpoint → `/mds:ship <name>`.

## Guardrails
- **Reuse before authoring** — compose captured components (graph `composes` edges); only author what's missing.
- **Component-based** — author missing pieces as real captured components, not inline blobs; the page composes them.
- **On-system** — token roles + the DESIGN.md layout/spacing/anti-patterns; keep ONE accent budget across the page.
- **Never self-ship** — leaves and the page both pass the gate; the final ship needs human approval.
- A page that needs a *design-system* change (new token/primitive) surfaces it via `/mds:system:update` — don't force off-system.
