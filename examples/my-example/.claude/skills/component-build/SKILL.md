---
name: component-build
description: Build a reusable, on-system React+Tailwind component from an intent. Use when creating or editing a component in emdesign. Composes design-system primitives from "@ds", references token roles only, emits a CSF story, and feeds the verify loop.
---

# component-build

The core build skill. Turns an intent into a code-first component that the loop can verify.

## Steps
1. `get_design_context` (componentName + instruction) → read the consistency brief: composable primitives,
   tokens by kind, governing rules, and the **vibe** (Visual Theme + Anti-patterns). Read those DESIGN.md sections.
2. Plan structure with **real, specific copy** — no filler ("Feature one"), no invented metrics, no emoji icons.
3. Build by composing primitives imported from `@ds` (Button, Card, Heading, Badge, Stack…). Use **semantic
   token classes only** (`bg-surface`, `text-accent`, `rounded`) — never raw hex. Headings use the display font.
   Respect the accent budget (≤ ~2 accent elements).
4. Write via `create_component` (or `edit_component`) — include a CSF story titled `Generated/<Name>` with a
   `Default` export so it renders in Storybook and the visual test can find it.
5. Hand off to verify (`/mds:review`) — fix every **P0** before declaring done; use `graph_where_to_fix` for
   exact `file:line` + the token role to use.

## Notes
- Output is a **reusable component**, not a page: minimal props, no one-off content baked into structure.
- If the design system lacks a needed primitive/token, surface it (don't invent an off-system value).
- Keep editing in the same session so the agent retains context across loop rounds.

## CLI Alternative Workflow

Instead of the MCP-based flow (above), the same result can be achieved with direct CLI commands:

```bash
# Step 1: Get design context
emdesign ds context StatsCard "A stats card with trend indicator"
# or: emdesign design StatsCard "..."

# Step 2: Generate the component with --content
emdesign generate StatsCard --mode create --content "$(cat << 'EOF'
import { Card, Heading, Text, Stack } from "@ds";
export function StatsCard({ title, value, trend }: { title: string; value: string; trend?: string }) {
  return (
    <Card className="p-4">
      <Stack gap="xs">
        <Text variant="label">{title}</Text>
        <Heading level="h3">{value}</Heading>
        {trend && <Text variant="body-sm">{trend}</Text>}
      </Stack>
    </Card>
  );
}
EOF
)"

# Step 3: Auto-generate stories from props
emdesign story auto StatsCard

# Step 4: Verify
emdesign doctor lint StatsCard
emdesign doctor visual StatsCard     # needs Storybook
emdesign doctor all StatsCard --gate # composite ship decision

# Step 5: Iterate via loop
emdesign loop StatsCard --max-iterations 3

# Step 6: Capture when done
emdesign capture StatsCard --baseline
```

**When to use CLI vs MCP:**

| Aspect | MCP (`create_component`) | CLI (`generate`) |
|--------|-------------------------|-------------------|
| Source input | Tool parameter | `--content`, `--source`, or `--stdin` |
| Story generation | Separate step | Same file or `story auto` |
| Lint check | Auto-runs | Auto-runs |
| Best for | Agent-in-the-loop | Scripted/batch/CI |
| Flags | — | `--content`, `--mode`, `--story`, `--batch` |
