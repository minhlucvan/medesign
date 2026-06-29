# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

emdesign is a **design-engineering engine**: a headless Studio backend that drives **Storybook as its
front end**. An idea or change request flows through an agent + the backend's MCP/HTTP tools into
on-system, visually-tested React components committed to the repo. Quality is enforced by a `DESIGN.md`
contract, a consistency lint, and a critique gate — not by taste.

It is an npm-workspaces monorepo (`packages/*` + `apps/*`). Engines are framework-agnostic; only a
`FrameworkAdapter` is per-framework (React implemented; Vue/Svelte/etc. stubbed).

## Commands

```bash
npm install && npx playwright install chromium   # first-time setup (visual tests need chromium)

npm run studio      # Storybook + emdesign panel  → http://localhost:6006  (@emdesign/workspace-react)
npm run backend     # CLI dev server: HTTP bridge + MCP → http://localhost:4321  (@emdesign/cli)
npm run dev         # both of the above

npm run build              # tsc build across all workspaces (--if-present)
npm run test:visual        # Storybook test-runner visual snapshots (Storybook must be running)
npm test -w @emdesign/graph    # vitest for the graph package (the only package with unit tests)
```

Run a single graph test: `npx vitest run -t "<test name>" -w @emdesign/graph` (or pass a file path).

### CLI (`emdesign` / `emdesign-backend`, = `packages/cli`)
The thin client the agent, `/mds:*` commands, and gates invoke. Dev-invoke it without a build via
`npx tsx packages/cli/src/cli.ts <cmd>`.

#### CLI Command Overview (80+ commands across V1-V3)

**Workspace:** `init <framework>` | `attach` | `update` | `serve [--port]` | `up` | `health`

**Design System Registry:** `ds create` | `ds import awesome|git|vendor|project` | `ds info` | `ds list` | `ds bases`

**Design System Management:** `ds customize --primary --font` | `ds update` | `ds validate [--strict]` | `ds grade [--timeout]` | `ds conflicts` | `ds history`

**DS Compilation:** `ds compile` | `ds export` | `ds version <bump>` | `ds changelog` | `ds validate --strict`

**DS Lint Rules:** `ds lint-rules list` | `ds lint-rules set <rule> <severity>` | `ds lint-rules preset <name>`

**Component Lifecycle:** `design <comp> [instr]` | `ds context <comp>` | `generate <name> [--content]` | `story auto <comp>` | `capture <comp> [--baseline]` | `vision <comp>`

**Verification:** `doctor [lint|visual|spatial|snapshot|charters|react|a11y|all] <comp> [--gate]` | `doctor all --gate`

**Diagnostic:** `render analyze <comp>` | `spatial audit <comp> [--grid]` | `component a11y <comp>` | `component test <comp>` | `component diff <comp>`

**Composition & Screens:** `compose <name> --components <list>` | `ds blueprint apply|list` | `ds block list` | `ds scaffold --blocks` | `screen create|list`

**Knowledge Graph:** `graph build|context|impact|where-to-fix|guidance|query`

**Exploration:** `explore [overview|ds|tokens|primitives|components|hierarchy|rules|charters|sections|stats]` | `discover` | `doc`

**Automation:** `loop <comp> [--max-iterations]` | `generate --batch` | `capture --all` | `doctor all --gate`

**Universal flags:** `--json` | `--gate` | `--quiet` | `--version` | `--completion [bash|zsh]`

See `docs/cli-commands.md` for full reference. See `apps/workspace/templates/claude/skills/` per-workflow skills.

### Gates (`scripts/gates/*.sh`) — exit code is the verdict
`lint.sh <Component>` (0 = no P0), `visual.sh <Component>` (needs Storybook on :6006),
`build.sh` (typecheck). They shell out to the CLI via `${EMDESIGN_CLI:-npx tsx packages/cli/src/cli.ts}`.
Note: `build.sh` still points at `apps/studio/tsconfig.json`, which no longer exists (absorbed into
`apps/workspace-react/`) — update the path if you touch the build gate.

## Architecture

The closed loop (see `docs/architecture.md`): **change request** (addon panel → `POST /api/change-request`,
queued in `.emdesign/state.json`) → **agent** calls `poll_change_request` then `get_design_context`
→ writes component via `create_component`/`edit_component` (backend writes
`apps/workspace-react/src/generated/<Name>.tsx` + `.stories.tsx` and runs the lint) → Storybook HMR
→ `run_visual_test` (Playwright screenshot + pixelmatch diff) → **gate** decides → **Capture** promotes
to `apps/workspace-react/src/components/<Name>/` (git-tracked).

The agent can be driven two ways: (a) an MCP-capable agent you run that connects to the backend's MCP
server, or (b) the backend spawns the agent itself via the **harness** (`backend/src/harness/`).
Phase 0 ships (a).

### Packages
- **`@emdesign/backend`** — the engine (library; executable lives in the CLI). Key modules:
  `mcp.ts` (tool surface), `http.ts` (`/api/*` bridge for the addon), `designContext.ts` (prompt
  composer: DESIGN.md + tokens + primitives → agent prompt), `lint/` (anti-slop + token-contract
  self-check), `visualTest.ts`, `critique/scoreboard.ts` (`computeComposite` + dual-gate `decideRound`),
  `capture.ts`, `graph.ts`, `adapters/` (`FrameworkAdapter`: `react-tailwind`, `stub`), `state.ts`.
- **`@emdesign/cli`** — client/executable; proxies to a running server over HTTP or embeds the engine
  for one-shot ops; also `init`/`attach`.
- **`@emdesign/graph`** — labeled property graph of a whole design system (files, stories, components,
  tokens, colors, specs, rules, themes, each with `file:line` provenance). Powers `graph_*` MCP tools:
  where-to-fix, impact propagation, consistency briefs. Built into `design-systems/<id>/graph.json`.
- **`@emdesign/addon`** — the Storybook panel (chat · capture · visual-diff).
- **`@emdesign/dsr`** — shared token roles / primitives that design systems compile into.

### Apps
- **`apps/workspace-react`** — the React/Tailwind Storybook host (the dogfood instance + the
  react-tailwind `init` template source). `tailwind.config.js` maps semantic classes (`bg-surface`,
  `text-accent`) to the active design system's CSS custom properties; `@ds` (Vite alias) resolves to
  its `code/` primitives. Generated components land in `src/generated/`; captured ones in `src/components/`.
- **`apps/workspace`** — `@emdesign/workspace`: the abstract, framework-agnostic installer (init/attach),
  the canonical `.claude` template (`templates/claude/`), config schema, and framework registry.

### MCP tool surface (`backend/src/mcp.ts`)
`get_design_context`, `create_component`, `edit_component`, `lint_consistency`, `run_visual_test`,
`render_preview`, `capture_reusable_component`, `apply_design_system`, `create_design_system`,
`scaffold_primitives`, `validate_design_system`, `list_design_systems`, `poll_change_request`,
`screenshot_path`, `critique_score`, `record_evidence`, and `graph_*`
(`where_to_fix`, `find_affected`, `consistency_brief`, `get_context`, `query`, `rebuild`).

## Core invariants

- **Token binding, never raw values.** Components reference semantic roles (`bg-surface`, `text-accent`,
  `rounded`, `@ds` primitives). Every value traces back to the design system's `tokens.css` — there is one
  design system per workspace, declared in `emdesign.config.json`. Generated/captured
  code that hardcodes hex colors, off-token values, or invented spacing will fail the consistency lint.
- **The critique gate is dual.** A component passes only when `composite ≥ threshold && mustFix === 0`
  (plus a per-component ratchet) — a high average never overrides a blocking (P0/mustFix) issue.
- **The design system is the source of quality.** Each workspace has one design system at
  `design-systems/<id>/` (`DESIGN.md` 9-section contract + `tokens.css` + `code/` primitives +
  `graph.json`), declared in `emdesign.config.json`. Build against the contract; don't invent visual
  decisions outside it.

## Agent workspace (`.claude` / `apps/workspace/templates/claude`)
The `/mds:*` commands drive the loop: `/mds:system:create|update`, `/mds:craft:component|view|story|update`,
and shared `/mds:review`, `/mds:vision`, `/mds:ship`. The workspace has one design system (set in
`emdesign.config.json`); there is no runtime switching. Critic subagents: `vision-critic` (reads the
screenshot), `design-reviewer` (LLM critique), `consistency-auditor`. The four feedback sources the gate
weighs are **rule** (lint + token contract), **visual** (pixel regression), **vision** (subagent reads
the screenshot), and **LLM** (`design-reviewer`), plus **human** change requests. See
`docs/harness-engine.md`.

## Vendored skills
`skills/_vendor/open-design/` holds 159 vendored skills (Apache-2.0) — design/code patterns adapted from
[open-design](https://github.com/nexu-io/open-design); see `NOTICE` and `docs/open-design-analysis.md`.
Treat as upstream-vendored: prefer `skills/web-section/` and the workspace template skills for local changes.
