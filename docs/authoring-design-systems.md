# Authoring a great design system

The DESIGN.md is the single biggest lever on output quality. open-design's "secret sauce" is not a model
trick — it's that its `DESIGN.md` files are extraordinarily specific. Vague prose → generic UI. This is
the rubric for hitting the bar. Study `design-systems/atelier/DESIGN.md` as the reference.

## The quality bar (what separates designed from generic)

1. **Exact values, never approximations.** `#08090a`, not "very dark". `letter-spacing: -0.4px`, not "a
   little tight". A real type-scale **table** (15–25 roles: family · size · weight · line-height ·
   tracking). Components specified with every state (default/hover/active/disabled/focus).
2. **Semantic, role-based naming.** `--color-accent`, `--color-text-muted` — never `blue-500`. Roles let
   the system re-skin and let the linter reason about intent.
3. **Anti-patterns as hard guardrails.** Section 9 is not decoration — each "Don't" maps to a
   consistency-lint rule that blocks the agent (e.g. "never indigo gradients", "never sans on headings",
   "accent ≤ 2 per screen"). This is what stops AI-slop.
4. **A point of view.** Section 1 (Visual Theme & Atmosphere) should be opinionated and evocative — "ink
   on warm paper, unhurried, literate." A system without an attitude produces forgettable UI.
5. **Voice rules** (Section 8). Copy is part of design: tone, casing, what the brand is *not*. This kills
   filler copy and invented metrics.

## Checklist
- [ ] YAML frontmatter (`name`, `category`, `surface`, `description`, `colors`) within the parser subset.
- [ ] `# H1` + `> Category:` + `> Surface:` + a ≤240-char summary paragraph.
- [ ] All 9 sections, verbatim titles, in order.
- [ ] Color section: every role with exact hex, in a parseable swatch form (list or table).
- [ ] Typography: a full type-scale table; distinct display/body/mono families.
- [ ] Components: each spec includes all interactive states.
- [ ] Anti-patterns: a concrete Do/Don't list that maps to lint rules.
- [ ] `tokens.css`: every required role declared; no unknown roles; every `var()` resolves (self-check).
- [ ] `code/` primitives reference token roles only; a `Showcase.stories.tsx` renders them.
- [ ] Run the loop with `npm run backend -- use <id>`; generated components pass the lint with zero P0s.

## Tuning which rules apply
Set `manifest.craft.exemptions` to skip rules that conflict with the system's intent (e.g. exempt
`sans-display` for a deliberately sans, utilitarian system). Everything else stays enforced.

## Starting from a base
You don't have to start blank. medesign ships **prebuilt bases** under
`design-systems/_vendor/open-design/` — design systems derived from open-design (brutalist, editorial,
Swiss, fintech, dark decks, minimalist, …), each a full DESIGN.md + token contract with atelier's
primitives re-skinned by its palette, plus the origin SKILL.md and reference assets bundled in.

- **List them:** `medesign ds bases` (or the `list_design_system_bases` MCP tool). Each entry has a
  `ref` like `open-design/brutalist`.
- **Start from one:** `medesign ds create <id> import <ref>` (or `/mds:system:create … --mode import <ref>`).
  The clone is re-id'd (its vendor `source` provenance dropped), graph-built, and validated — ready to
  `medesign ds use <id>`. Then edit its DESIGN.md/tokens to differentiate; you're customizing a known-good
  system instead of authoring from scratch.

Bases are excluded from `ds list` / the active-system picker (they live under the `_vendor/` prefix) — they
are clone sources, not systems you build against directly. To add or refresh bases, edit
`scripts/import-open-design/bases.ts` and run `npx tsx scripts/import-open-design/convert.ts`.
