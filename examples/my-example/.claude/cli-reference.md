# emdesign CLI Command Reference

> Auto-generated reference. All commands support `--json` (structured output) and `--gate` (exit code verdict).

## Workspace & Server

| Command | Description |
|---------|-------------|
| `init <framework> [--dir .]` | Scaffold a new emdesign workspace |
| `attach [--dir .]` | Link emdesign to an existing project |
| `update [--dir .] [--force]` | Update workspace templates |
| `serve [--port 4321]` | Start HTTP bridge |
| `up` | Start everything (bridge + Storybook) |
| `health` | Ping the HTTP server |

## Design System Registry

| Command | Description |
|---------|-------------|
| `ds create <id> [--mode blank\|brief\|import\|extract] [--from <base>] [--name <name>] [--description <text>]` | Create a design system |
| `ds import awesome <brand> [--name <name>]` | Import from awesome-design-md |
| `ds import git <url> [--ref <ref>] [--path <dir>] [--name <name>]` | Import from git |
| `ds import vendor <id> [--name <name>]` | Import from vendored base |
| `ds search <query> [--limit <n>]` | Search registries |
| `ds info [id]` | Show design system details |
| `ds list` | List all design systems |
| `ds bases` | List vendored base systems |
| `ds base-detail <id>` | Show base system details |
| `ds use <id>` | Switch active design system |

## Design System Management

| Command | Description |
|---------|-------------|
| `ds update <id> [--name] [--description]` | Update DS metadata |
| `ds customize <id> [--color <hex>] [--font <family>] [--brand <name>] [--primary <hex>] [--secondary <hex>] [--body-font <font>] [--spacing <px>]` | Customize a design system |
| `ds validate [id] [--strict] [--gate]` | Validate token contract |
| `ds grade [id] [--gate] [--timeout <ms>]` | Grade DS quality |
| `ds conflicts [id]` | List token conflicts/orphans |

## Design System Compilation

| Command | Description |
|---------|-------------|
| `ds compile <id> [--out <dir>]` | Compile tokens → TypeScript types |
| `ds export <id> [--out <dir>]` | Export as npm package |
| `ds version <id> <major\|minor\|patch>` | Semantic version bump |
| `ds changelog <id> [--snapshot]` | Show/create changelog |

## Design System Lint Rules

| Command | Description |
|---------|-------------|
| `ds lint-rules list [id]` | Show active rules |
| `ds lint-rules set <id> <rule> <P0\|P1\|P2\|off>` | Change rule severity |
| `ds lint-rules preset <id> <preset>` | Apply rule preset |

## Component Lifecycle

| Command | Description |
|---------|-------------|
| `design <comp> [instruction]` | Print design-context prompt |
| `ds context <comp> [instruction]` | Design-context prompt (ds subcommand) |
| `generate <name> [--content <src>] [--source <file>] [--stdin] [--mode create\|edit] [--batch <file.json>]` | Create/edit a component |
| `story auto <comp>` | Auto-generate CSF stories from props |
| `capture <comp> [--baseline]` | Promote to reusable component |
| `capture --all [--baseline]` | Capture all generated components |
| `vision <comp> [--mode] [--provider]` | AI vision critique |

## Verification (Doctor)

| Command | Description |
|---------|-------------|
| `doctor [kind] <comp> [--gate] [--timeout] [--detail] [--quiet]` | Run verification checks |
| `doctor lint <comp>` | Token lint only (fastest) |
| `doctor visual <comp>` | Pixel diff vs baseline |
| `doctor spatial <comp>` | Geometry audit |
| `doctor snapshot <comp>` | DOM render check |
| `doctor charters <comp>` | Story charter evaluation |
| `doctor react <comp>` | React anti-patterns |
| `doctor a11y <comp>` | Fast a11y rule check |
| `doctor all <comp> --gate` | Full composite gate |

## Visual & Spatial Analysis

| Command | Description |
|---------|-------------|
| `render analyze <comp> [--story] [--theme]` | Semantic DOM tree + coordinates |
| `render snapshot <comp>` | Capture render as structured JSON |
| `spatial audit <comp> [--grid]` | Full geometry breakdown |
| `spatial grid <comp>` | Grid overlay measurement |

## Storybook Diagnostics

| Command | Description |
|---------|-------------|
| `storybook health` | Deep Storybook diagnostics (port, index, compilation, aliases, duplicates) |
| `storybook health --verbose` | Full check with console logs and error details |
| `storybook health --story <id>` | Check a specific story renders without errors |

## Component Intelligence

| Command | Description |
|---------|-------------|
| `component a11y <comp>` | Deep axe-core a11y audit |
| `component test <comp>` | Generate vitest tests |
| `component diff <comp>` | Compare generated vs captured |

## Composition & Screens

| Command | Description |
|---------|-------------|
| `compose <name> --components "A,B,C" [--layout stack\|grid\|sidebar]` | Compose a view |
| `ds blueprint list [--category <cat>]` | List composition blueprints |
| `ds blueprint apply <id> <target>` | Create component from blueprint |
| `ds block list [--tags <tags>]` | List building blocks |
| `ds scaffold <id> --blocks <list>` | Scaffold specific blocks into DS |
| `screen create <name> [--route <path>] [--layout <layout>]` | Create screen with routing |
| `screen list` | List all screens |

## Knowledge Graph

| Command | Description |
|---------|-------------|
| `graph build [ds-id]` | Rebuild knowledge graph |
| `graph context <node-id>` | Full node context |
| `graph impact <node-id>` | Blast radius / affected dependents |
| `graph where-to-fix <artifact> <finding>` | Pinpoint fix location |
| `graph guidance [name] --intent <text>` | Consistency brief |
| `graph query [--label] [--from] [--to] [--where <json>]` | Flexible queries |

## Exploration

| Command | Description |
|---------|-------------|
| `explore [overview\|ds\|tokens\|primitives\|components\|hierarchy\|rules\|charters\|sections\|stats]` | Explore workspace |
| `explore hierarchy <name>` | Composition tree |
| `explore tokens --json` | Structured token output |
| `discover [--kind] [--filter]` | List stories, components, systems |
| `doc <target>` | Component/story documentation |

## Automation

| Command | Description |
|---------|-------------|
| `loop <comp> [--max-iterations <n>]` | Double-loop until gate passes |
| `generate --batch <file.json>` | Batch-generate from manifest |
| `capture --all [--baseline]` | Batch capture all generated |
| `doctor all --gate` | CI-ready composite gate |

## Universal Flags

| Flag | Description |
|------|-------------|
| `--json` | Structured JSON on stdout |
| `--gate` | Exit code = verdict (0 pass, 1 fail) |
| `--quiet` | Suppress stderr output |
| `--version`, `-V` | Show version |
| `--completion [bash\|zsh]` | Generate shell completion |
