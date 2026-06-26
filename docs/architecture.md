# medesign architecture

```
                         ┌───────────────────────────────────────────────┐
                         │  Storybook (FRONT END)  apps/workspace-react             │
   you ───change req──▶  │  • renders generated CSF stories (live, HMR)    │
                         │  • @medesign/addon panel: chat · capture · diff │
                         └───────▲───────────────────────┬─────────────────┘
                          HTTP   │ /api/state             │ change requests
                          bridge │                        ▼
                         ┌───────┴───────────────────────────────────────┐
                         │  medesign Studio backend  packages/backend
                         │  ┌─────────────┐  ┌──────────────┐  ┌─────────┐ │
   agent (Claude Code) ─▶│  │ MCP server  │  │ prompt       │  │ harness │ │─▶ spawns agent
   via .mcp.json         │  │ (tools)     │  │ composer     │  │ (CLIs)  │ │   (optional)
                         │  └─────┬───────┘  └──────┬───────┘  └─────────┘ │
                         │        │ get_design_context │                    │
                         │  ┌─────▼──────┐  ┌─────────▼───────┐  ┌────────┐ │
                         │  │ design-sys │  │ consistency lint│  │ visual │ │
                         │  │ resolver   │  │ + token check   │  │ test   │ │
                         │  └─────┬──────┘  └─────────────────┘  └───┬────┘ │
                         │        │ critique/scoreboard (gate)       │       │
                         └────────┼──────────────────────────────────┼──────┘
                                  ▼                                  ▼
                         design-systems/<id>/            apps/workspace-react/src/generated/
                         DESIGN.md · tokens.css · code/   <Name>.tsx + <Name>.stories.tsx
                                                          → capture → src/components/<Name>/
```

## The loop (Phase 0)

1. **You** type a change request in the Storybook **addon panel** → `POST /api/change-request` → queued in the shared `Store` (`.medesign/state.json`).
2. The **agent** (Claude Code, connected to the backend's MCP server via the `.mcp.json` the harness writes) calls `poll_change_request`, then `get_design_context` (DESIGN.md + tokens + primitives + rules).
3. The agent writes the component via `create_component`/`edit_component` → backend writes `apps/workspace-react/src/generated/<Name>.tsx` + story and runs the **consistency lint**.
4. Storybook **hot-reloads** the story. The agent (or the panel) calls `run_visual_test` → screenshot diff vs baseline.
5. The **scoreboard gate** (`composite ≥ threshold && mustFix === 0`) decides done; otherwise the P0-first lint feedback is fed back and the agent revises (`edit_component`).
6. You click **Capture** → `capture_reusable_component` promotes it to `src/components/<Name>/`, git-tracked.

Two ways to drive step 2–5: **(a)** an MCP-capable agent you already run (simplest — the backend is just the MCP server + HTTP bridge), or **(b)** the backend spawns the agent itself via the **harness** (`packages/backend/src/harness/`). Phase 0 ships (a); (b) is wired for the autonomous orchestrator in Phase 1.

## Components

| Piece | Path | Role |
|---|---|---|
| MCP server | `backend/src/mcp.ts` | tool surface: `get_design_context`, `create_component`, `edit_component`, `lint_consistency`, `run_visual_test`, `render_preview`, `capture_reusable_component`, `apply_design_system`, `poll_change_request` |
| Prompt composer | `backend/src/designContext.ts` | DESIGN.md + tokens + primitives + task → agent prompt |
| Consistency lint | `backend/src/lint/` | anti-slop + token contract self-check (ported from `lint-artifact.ts`) |
| Scoreboard gate | `backend/src/critique/scoreboard.ts` | `computeComposite` + dual-gate `decideRound` (ported from `critique/`) |
| Visual test | `backend/src/visualTest.ts` | Playwright screenshot + pixelmatch diff vs baseline |
| Harness | `backend/src/harness/` | agent-adapter registry + spawn driver (ported from `runtimes/`) |
| HTTP bridge | `backend/src/http.ts` | `/api/*` for the addon; serves diff images |
| Front end | `apps/workspace-react/` | Storybook + Tailwind bound to the active design system's tokens |
| Addon panel | `packages/addon/` | the live loop UI |
| Design systems | `design-systems/<id>/` | DESIGN.md + tokens.css + `code/` primitives (+ committed `graph.json`) |
| Knowledge graph | `packages/graph/` | labeled property graph of the library; `graph_*` MCP tools for where-to-fix, impact, consistency brief, context — see [`data-model.md`](./data-model.md) |
| Workspace | `.claude/` | the agent-facing orchestration: `/mds:*` commands, critic subagents, skills (+ router), `design-loop` workflow engine, gates — see [`harness-engine.md`](./harness-engine.md) |
| CLI | `@medesign/cli` (`packages/cli`, bin `medesign`) | thin client the agent + gates invoke; proxies to the running server (HTTP) or embeds the engine; also `init`/`attach` |
| Critique gate | `backend/src/critique/` | `critique_score` = `computeComposite` + dual-gate `decideRound` + per-component ratchet (the four-source gate) |

## Token binding

`apps/workspace-react/tailwind.config.js` maps semantic classes (`bg-surface`, `text-accent`, `rounded`) to the active design system's CSS custom properties, imported via `src/active-design-system.css`. `@ds` (Vite alias) resolves to the active system's `code/` primitives. Swap the design system → everything re-skins, because components reference roles, never raw values. See [`spec.md`](./spec.md).
