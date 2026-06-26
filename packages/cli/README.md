# @medesign/cli

The **medesign CLI** (`medesign`) — the thin client that agents, workspace commands, and gates invoke.
Proxies to a running backend server over HTTP, or embeds the `@medesign/engine` for one-shot operations
(init, attach, lint, validate, graph build).

## Role in the system

The CLI is the interface between the agent/developer and the backend engine. It's what
`scripts/gates/*.sh` and the `/mds:*` commands shell out to.

## Usage

```bash
medesign serve              # Start the HTTP + MCP server
medesign mcp                # MCP server over stdio
medesign init <framework>   # Scaffold a new medesign workspace
medesign attach             # Attach to an existing Storybook project
medesign ds <cmd>           # Design system commands: create, use, validate, list, bases, doctor
medesign lint <Component>   # Consistency-lint a generated component
medesign graph build <id>   # Rebuild the knowledge graph for a design system
```

## Binaries

- `medesign` / `medesign-backend` — both point at `dist/cli.js`

## Related

- `@medesign/backend` — the engine library the CLI wraps
- `@medesign/workspace` — init/attach installer
- `@medesign/mcp-server` — MCP server wrapper
