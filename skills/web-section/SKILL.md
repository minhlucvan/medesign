---
name: web-section
description: Generate a polished marketing/web section as a reusable React component, on-system.
trigger: ["section", "hero", "pricing", "features", "CTA", "testimonial"]
mode: component
scenario: marketing
platform: web
example_prompt: "a pricing section with three tiers, highlight the middle one"
---

# web-section

Produce a single, reusable React + Tailwind **section component** that composes the active design
system's primitives. It must look designed (per the DESIGN.md) and pass the consistency lint.

## Workflow

1. Call `get_design_context` with the user's instruction and a PascalCase `componentName`. Read the
   DESIGN.md **Anti-patterns** and **Components** sections carefully.
2. Plan the section structure with real, specific copy — no filler ("Feature one"), no invented metrics
   ("10× faster"), no emoji icons.
3. Build by composing primitives imported from `@ds` (e.g. `Button`, `Card`, `Heading`, `Badge`,
   `Stack`). Reference token roles only (`bg-surface`, `text-accent`) — never raw hex.
4. Respect the accent budget: at most ~2 accent elements per screen.
5. Call `create_component` with the `.tsx` source and a CSF story (`title: "Generated/<Name>"`,
   `Default` export). Read the returned lint report.
6. Fix every **P0** finding via `edit_component` and re-check until the lint passes.
7. Call `run_visual_test`. If a baseline exists and the diff is unexpected, reconcile.
8. Report the preview URL. The user captures it when satisfied.

## Notes
- Output is a component, not a page — it should drop into any layout.
- Keep it self-contained and prop-light for v1; refine via change requests.
