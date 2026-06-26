# Quickstart

Run the live design ↔ change-request loop end-to-end.

## Prerequisites
- Node ≥ 20
- An MCP-capable coding agent on your PATH (e.g. Claude Code — `claude`)

## Install
```bash
npm install
# Playwright browser for visual testing (one-time):
npx playwright install chromium
```

## Run (two terminals)
```bash
# 1. Storybook front end (the visual surface)
npm run studio          # → http://localhost:6006

# 2. medesign backend HTTP bridge (feeds the addon panel)
npm run backend         # → http://localhost:4321
```
Open Storybook, pick a story, open the **medesign** panel. You'll see the active design system (Atelier)
and the seed `Generated/PricingTiers` story.

## Drive the loop with an agent
Point your agent at the backend's MCP server. The backend writes `.mcp.json` automatically when it spawns
an agent; to connect an agent you run yourself, add:
```jsonc
// .mcp.json
{ "mcpServers": { "medesign": { "command": "npm", "args": ["run", "backend", "--", "mcp"] } } }
```
Then ask the agent: *"use the medesign tools to build a pricing section with three tiers, highlight the
middle one."* It will call `get_design_context` → `create_component` → `lint_consistency` →
`run_visual_test`. Storybook hot-reloads the new `Generated/*` story.

## The acceptance demo
1. *"a pricing section with three tiers, highlight the middle one"* → an on-system story renders; code lands in `apps/workspace-react/src/generated/`.
2. *"make the highlighted tier use the accent color and add a Most Popular badge"* → live re-render + a visual diff; the consistency lint passes (tokens only, no off-system hex).
3. Click **Capture as reusable** in the panel → `<PricingTiers/>` + its story land in `apps/workspace-react/src/components/`, git-tracked.
4. Re-running the same request yields visually consistent output.

## Switch design systems
```bash
npm run backend -- use <design-system-id>   # e.g. atelier
```

## Visual tests (CI)
```bash
npm run test:visual
```
