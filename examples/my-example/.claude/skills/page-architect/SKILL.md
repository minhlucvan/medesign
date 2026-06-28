---
name: page-architect
description: Methodology for building a large page by progressive decomposition — turn a page brief into a component tree, decide reuse-vs-author per leaf against the graph, build leaves first, and compose upward into an on-system page. Use for /mds:craft:view.
---

# page-architect

Big pages are built bottom-up: **decompose → build leaves → compose → verify the whole.** This is the
methodology the `view-loop` workflow follows.

## 1. Decompose (brief → tree)
- Read the brief + `get_design_context` (the design system's layout rhythm, container width, section spacing,
  voice, anti-patterns). A page is a vertical stack of **sections**; each section is a **component**.
- Build a tree (cap depth ~3): page → sections → (complex section) sub-components. Name each leaf in
  PascalCase with a clear intent + the real, specific content/CTA it carries (no filler).
- Typical landing tree: `Hero · FeatureGrid · PricingTiers · Testimonial · CTASection · SiteFooter`.

## 2. Reuse vs author (per leaf)
- Query the graph: `graph_query({label:'artifact'})` (captured components) + `({label:'primitive'})`. If a
  captured component already covers a leaf → **reuse it** (`exists: true`). Otherwise mark it to author.
- De-duplicate: a component used by several sections is built once and reused.

## 3. Build leaves first
- Author each missing leaf via the component gate (`/mds:craft:component` / nested `design-loop`): compose
  `@ds` primitives, token roles only, pass the four-source gate, then `capture_reusable_component`.

## 4. Compose upward
- The page imports the captured leaf components and lays them out per the tree. Compose only — never
  re-implement a component inline. Enforce page-level craft: consistent spacing scale + vertical rhythm,
  one clear hierarchy, and **one accent budget across the whole page** (not per-section).

## 5. Verify the whole
- Run the page through the four-source critique (visual + vision + LLM + rule) and the `critique_score` gate;
  fix via `graph_where_to_fix`; record evidence. A page ships only when the page-level gate passes AND a human approves.

## Guardrails
- Reuse before authoring; component-based (no monolith); on-system (tokens + DESIGN.md layout/anti-patterns).
- If the page needs something the design system lacks, surface a `/mds:system:update` rather than going off-system.
