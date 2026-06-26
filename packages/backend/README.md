# @medesign/backend

The **medesign Studio backend** — the headless design-engineering engine. It's a library (not a
standalone binary — use `@medesign/cli` for that) containing:

- **MCP server** — tool surface agents drive the design loop through
- **Agent harness** — pluggable adapter registry for spawning coding-agent CLIs
- **Prompt composer** — assembles DESIGN.md + tokens + primitives into agent prompts
- **Consistency lint** — anti-slop + token-contract self-check (P0/P1 rules)
- **Visual test** — Playwright screenshot + pixelmatch diff vs baseline
- **Critique scoreboard** — composite weighted scoring + dual-gate decide
- **Capture** — promotes generated components to git-tracked reusable components
- **HTTP bridge** — `/api/*` endpoints for the Storybook addon panel

## Role in the system

The backend is the brain: it owns `.medesign/` state, `design-systems/<id>/graph.json`,
and all the deterministic quality tools (lint, visual test, scoreboard gate). It exposes
its capabilities via MCP tools and HTTP endpoints.

## Related

- `@medesign/cli` — wraps the backend as a CLI binary
- `@medesign/dsr` — design-system runtime domain layer
- `@medesign/graph` — knowledge graph data model
- `@medesign/doctor` — rule-based design-system linting
- `@medesign/plugin-*` — framework/styling/library plugins
