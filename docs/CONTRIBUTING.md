# Contributing

## Contribute a design system
A great DESIGN.md is the highest-leverage contribution — it's where design quality comes from.

1. `design-systems/<id>/` with `manifest.json`, `DESIGN.md`, `tokens.css`.
2. Follow [`spec.md`](./spec.md): YAML frontmatter, `# H1` + `> Category:` + summary, the 9 sections
   (verbatim titles), and a `tokens.css` `:root` declaring every required role.
3. Hit the quality bar (see [`authoring-design-systems.md`](./authoring-design-systems.md)): exact values,
   semantic role names, enforced anti-patterns.
4. Add `code/` primitives (React + Tailwind referencing token roles only) + a `Showcase.stories.tsx`.
5. Verify: `npm run backend -- use <id>`, then run the loop — generated components must pass the
   consistency lint with no P0s.

open-design / awesome-claude-design DESIGN.md files import cleanly because we keep their 9-section schema;
add the `code/` primitives to make them code-first. A bulk importer is planned (Phase 1).

## Contribute a skill
`skills/<id>/SKILL.md` per [`skills.md`](./skills.md). Skills must bind the active design system (not
define styling) and emit a component + CSF story.

## Contribute an agent adapter
`packages/backend/src/harness/defs/<id>.ts` per [`agent-adapters.md`](./agent-adapters.md).

## Code style
- Components reference **token roles**, never raw hex — the consistency lint enforces this.
- Backend is ESM TypeScript (NodeNext). The `code/` primitives are Vite-consumed (extensionless imports).
- Attribution: code adapted from open-design (Apache-2.0) is noted in [`/NOTICE`](../NOTICE).
