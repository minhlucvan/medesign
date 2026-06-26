---
name: component-build
description: Build a reusable, on-system React+Tailwind component from an intent. Use when creating or editing a component in medesign. Composes design-system primitives from "@ds", references token roles only, emits a CSF story, and feeds the verify loop.
---

# component-build

The core build skill. Turns an intent into a code-first component that the loop can verify.

## Steps
1. `get_design_context` (componentName + instruction) → read the consistency brief: composable primitives,
   tokens by kind, governing rules, and the **vibe** (Visual Theme + Anti-patterns). Read those DESIGN.md sections.
2. Plan structure with **real, specific copy** — no filler ("Feature one"), no invented metrics, no emoji icons.
3. Build by composing primitives imported from `@ds` (Button, Card, Heading, Badge, Stack…). Use **semantic
   token classes only** (`bg-surface`, `text-accent`, `rounded`) — never raw hex. Headings use the display font.
   Respect the accent budget (≤ ~2 accent elements).
4. Write via `create_component` (or `edit_component`) — include a CSF story titled `Generated/<Name>` with a
   `Default` export so it renders in Storybook and the visual test can find it.
5. Hand off to verify (`/mds:review`) — fix every **P0** before declaring done; use `graph_where_to_fix` for
   exact `file:line` + the token role to use.

## Notes
- Output is a **reusable component**, not a page: minimal props, no one-off content baked into structure.
- If the design system lacks a needed primitive/token, surface it (don't invent an off-system value).
- Keep editing in the same session so the agent retains context across loop rounds.
