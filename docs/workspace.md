# The medesign workspace — portable, framework-agnostic, opt-in

medesign is **opt-in** and **framework-agnostic**: you drop it into a project that already has Storybook,
or scaffold a fresh one. The workspace is split like the rest of the system — an **abstract core** plus
**per-framework** providers.

## Two layers
- **`@medesign/workspace`** (`apps/workspace`) — the abstract core: the `init`/`attach` installer, the
  canonical `.claude/` template (commands · agents · skills · workflows), the `medesign.config.json`
  schema, and the **framework registry**. No Storybook of its own.
- **`@medesign/workspace-react`** (`apps/workspace-react`) — the implemented React/Tailwind provider: the
  Storybook + Tailwind dogfood instance **and** the `init` template source. Future `workspace-vue`,
  `-svelte`, `-web-components`, `-angular` follow the same shape (stubbed today).

The engines stay in `packages/*` (server/CLI/addon/graph). Only the **`FrameworkAdapter`** is per-framework.

## Attach to an existing project (the opt-in path)
Your project already has Storybook? Install medesign additively:
```bash
npm i -D @medesign/addon @medesign/cli
medesign attach        # run at your repo root
```
`attach` is **additive and idempotent** — it:
1. detects `.storybook/main.*` (errors if there's no Storybook; install it first),
2. infers the framework from its `framework:` field,
3. adds `'@medesign/addon'` to the Storybook `addons` array (skips if present),
4. copies the `.claude/` workspace (never overwriting your files),
5. writes `medesign.config.json` (only if absent),
6. seeds `design-systems/atelier` if you have no design systems yet.
Then: run Storybook + `medesign serve`, and drive `/mds:design "<idea>"`.

## Init a new project
No Storybook yet?
```bash
medesign init react-tailwind ./my-app    # unknown framework → lists available providers
cd my-app && npm i
```
`init` lays down the provider's Storybook scaffold + `.claude/` + a starter design system + config.

## `medesign.config.json` (at the project root)
Re-targets the whole server at this project. All dirs are relative to the project root.
```jsonc
{ "framework": "react-tailwind",
  "storybookUrl": "http://localhost:6006",
  "generatedDir": "src/generated", "componentsDir": "src/components",
  "designSystemsDir": "design-systems", "screenshotsDir": "__screenshots__" }
```
`resolveRepoPaths` (`packages/backend/src/paths.ts`) reads it; every engine flows through `RepoPaths`.

## Data flow
```
Storybook FE (addon) ──HTTP/MCP──▶ studio server ──edits──▶ workspace code (your components/stories)
        ▲  HMR                                       │ reads (lint/graph via adapter)
        └──────────────── code → Storybook → FE ◀────┘
```

## Two flows (every project starts from a design system)

Like open-design, work splits into **Design System** then **Craft**:

**A. Design System** — author the contract.
- `/mds:system:create <id> <name> --mode brief|blank|import|extract` — scaffold + author a 9-section
  DESIGN.md + tokens.css + base primitives (tools: `create_design_system`, `validate_design_system`, the
  `design-system-loop` workflow, `design-system-author`/`brand-extract` skills).
- `/mds:system:update` — edit tokens/spec with `graph_find_affected` impact + re-validate + re-baseline.
- `/mds:system:use <id>` — **select → rewire the workspace**: rebind `tokens.css`, write `.medesign/active-ds`
  (the `@ds` alias reads it), rebuild the graph. *(Restart Storybook to repoint `@ds`; tokens hot-reload.)*

CLI parity for scripts/gates: `medesign ds create|use|validate|list`.

**B. Craft** — build against the active system (4-source loop + gate).
- `/mds:craft:component` (build) · `/mds:craft:update` (change-request) · `/mds:craft:view` (compose captured
  components into a screen) · `/mds:craft:story` (variants & states). Shared: `/mds:review`, `/mds:vision`,
  `/mds:ship`.

The router skill `using-design-skills` enforces **select/create a design system first, then craft**.
Scaffolding is self-contained: new systems are seeded by cloning the seeded reference system's primitives
(`scaffold_primitives`, default `atelier`) — no separate template tree to maintain.

## FrameworkAdapter (how every Storybook stack is supported)
The **agnostic core** works for any renderer: the Playwright visual test screenshots the rendered Storybook
iframe (framework-blind), as do the vision critique, the `critique_score` gate, the token/section knowledge
graph, the addon, and the MCP/HTTP surfaces. Only this interface is per-framework
(`packages/backend/src/adapters/`):
```ts
interface FrameworkAdapter {
  id; fileExt; primitiveImport;
  codegenInstructions(ds): string;   // stack-specific generation rules in the prompt
  lint(source, opts): Finding[];     // framework consistency rules + token self-check
  storyTemplate(name): string;       // this renderer's CSF
  parsesCode: boolean;               // graph code-parsing implemented?
}
```
`react-tailwind` is implemented (wraps the JSX/Tailwind lint + the React codegen rules). `vue`, `svelte`,
`web-components`, `angular` are **stubs**: the agnostic loop (build + visual + vision + gate) still runs; the
deterministic lint/parse is the TODO. `medesign frameworks` lists them.

### Add a framework
1. Create `apps/workspace-<fw>/templates/storybook/` (a Storybook scaffold for that renderer) + register it
   in `apps/workspace/src/registry.ts`.
2. Implement `packages/backend/src/adapters/<fw>.ts` (lint + codegen + storyTemplate; wire `parseComponent`
   into the graph) and register it in `adapters/index.ts`.
That's it — the server, addon, visual/vision/gate, and graph token layer are reused unchanged.

See [`harness-engine.md`](./harness-engine.md) for the loop and [`architecture.md`](./architecture.md) for the components.
