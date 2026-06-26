# Brownfield Project — Wire Into an Existing UI Repository

## User story

> As a **team with an existing React project**,
> I want to **wire emdesign into my running codebase without restructuring it**,
> So that **I can start using the design loop on components that already exist,
> in the folders where they already live.**

## Acceptance criteria

- Running `emdesign attach` in an existing project detects the tech stack (React/Vue/etc.)
- It does NOT create `src/generated/` or `src/components/` — the project's own structure is respected
- It scans existing `.stories.tsx` files and their companion `.tsx` components wherever they are
- It detects the existing Storybook setup and adds `@emdesign/addon` to the addons array
- It writes `emdesign.config.json` pointing at the real `src/` paths, not generated folders
- It creates a starter design system by **extracting tokens from existing components** (scanning for hex colors, font stacks, spacing values used across components)
- The agent can create/edit components in-place in the project's own directory structure
- The critique gate works on existing components without moving them
- Visual baselines are stored for existing stories
- The `.claude/` commands and `/mds:*` tools work without assuming a `generated/` directory
- The project's existing folder conventions (atomic design, feature folders, flat) are preserved

## Role

Team with an existing UI project

## Effort

~5 minutes to attach, scan, and have a running design loop on existing code
