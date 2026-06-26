# @medesign/workspace

The **workspace core** — the abstract, framework-agnostic installer (`init`/`attach`), the canonical
`.claude/` template (commands, agents, skills, workflows), the `medesign.config.json` schema, and
the framework registry.

## Role in the system

`@medesign/workspace` is the abstract base that every framework-specific workspace builds on. It:

- **`init <framework>`** — scaffolds a new medesign project from scratch (Storybook + workspace)
- **`attach`** — adds medesign to an existing Storybook project (additive + idempotent)
- Defines the `medesign.config.json` schema that targets engines at the workspace
- Hosts the **framework registry** — maps `react-tailwind`, `vue`, `svelte`, etc. to their providers

## Framework-agnostic

The engines (server, CLI, addon, graph) are framework-blind. Only the `FrameworkAdapter` is
per-framework. `@medesign/workspace-react` implements the React/Tailwind provider; Vue, Svelte,
Web Components, and Angular are stubbed.

## Related

- `@medesign/workspace-react` — the React/Tailwind provider (dogfood instance)
- `@medesign/cli` — CLI that runs `init`/`attach`
- `docs/workspace.md` — full workspace documentation
