# @emdesign/mcp-server

The **emdesign MCP server** — wraps `@emdesign/backend`'s API as Model Context Protocol tools that
agents (Claude Code, etc.) can call directly.

## Role in the system

The MCP server is what agents connect to via `.mcp.json`. It translates agent tool calls into backend
operations — `get_design_context`, `create_component`, `lint_consistency`, `run_visual_test`,
`capture_reusable_component`, `render_preview`, `validate_design_system`, `grade_design_system`,
`vision_critique`, and `graph_*` tools.

## Usage

The backend writes `.mcp.json` automatically when it spawns an agent. To connect an agent you run
yourself, add to `.mcp.json`:

```jsonc
{ "mcpServers": { "emdesign": { "command": "npm", "args": ["run", "backend", "--", "mcp"] } } }
```

## Related

- `@emdesign/backend` — the engine this wraps
- `@emdesign/cli` — the CLI that serves the MCP transport
- `docs/architecture.md` — how MCP tools fit in the loop
