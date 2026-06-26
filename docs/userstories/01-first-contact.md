# First Contact — From Zero to Running Studio

## User story

> As a **developer evaluating emdesign**,
> I want to **go from `npm init` to a running design studio in under 2 minutes**,
> So that **I can decide if this tool fits my workflow.**

## Acceptance criteria

- Running `emdesign init react-tailwind` creates the workspace scaffold (`.claude/`, `.storybook/`, config)
- `emdesign serve` starts an HTTP + MCP server on :4321
- Storybook dev server starts on :6006 with the @emdesign/addon panels visible
- A starter design system (atelier) is available with DESIGN.md, tokens.css, and primitives
- The Studio UI shows: System tab, Charters tab, + Create tab, and the Emdesign bottom panel
- CLI commands (`emdesign ds list`, `emdesign ds doctor`) work against the running server
- The project has no special emdesign folder conventions — it's a normal Storybook repo

## Role

Developer evaluating the tool

## Effort

~2 minutes to first running Studio
