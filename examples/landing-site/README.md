# Example — landing-site

A fully-working medesign project, **initialized by the CLI** (`medesign init`), demonstrating both flows:
**create a design system from a prebuilt**, then **craft components that are consistent by construction**.

Everything below was actually run to produce the committed files.

## How it was created
```bash
# 1. Initialize the project (scaffolds .claude workspace + Storybook + starter design system + config)
medesign init react-tailwind examples/landing-site      # → 43 files

cd examples/landing-site

# 2. DESIGN SYSTEM flow — create from a prebuilt, customize, select
medesign ds create noir import atelier   # clone the prebuilt 'atelier' → 'noir'
#   (browse vendored prebuilts with `medesign ds bases`; e.g. `... import open-design/brutalist`)
#   …edit design-systems/noir/{tokens.css,DESIGN.md} → dark canvas + electric-lime accent…
medesign ds use noir                     # select → rebind tokens.css + @ds, rebuild the graph
medesign ds validate noir                # token contract: ok

# 3. CRAFT flow — components are on-system (here authored into src/generated; normally via /mds:craft:component)
medesign lint Hero                       # PASS
medesign lint PricingTiers               # PASS
```
> In this monorepo, invoke the CLI as `npx tsx ../../packages/cli/src/cli.ts …` (the `medesign` bin exists
> after `npm run build`). `examples/*` is an npm workspace so the `@medesign/*` deps link for Storybook.

## Layout (produced by the steps above)
```
.claude/                 # the workspace `init` installed: /mds:system:* + /mds:craft:* commands,
                         #   critic agents, skills (+ using-design-skills router), workflow engines
.storybook/ · src/ · tailwind.config.js · postcss.config.js   # the React/Tailwind Storybook (from init)
design-systems/
  atelier/               # the prebuilt starter (seeded by init) — warm, light, terracotta
  noir/                  # created from atelier, recolored dark + lime (+ graph.json, .history snapshot)
src/generated/
  Hero.tsx · PricingTiers.tsx (+ stories)   # consistent components: compose @ds, token roles only
medesign.config.json     # framework: react-tailwind; designSystemsDir/generatedDir/…
.medesign/active-ds      # → noir  (the @ds alias + tokens bind to this)
```

## Run it
```bash
npm install                  # from the monorepo root (links the workspace deps)
npm run storybook -w my-medesign-workspace   # Storybook on :6006 — renders Hero, PricingTiers, the Noir showcase
medesign serve               # the studio server (MCP + HTTP) for the live /mds:* loop
```

## Why the components stay consistent
They reference **token roles** (`bg-surface`, `text-accent`, `font-[var(--font-display)]`) and compose the
design system's **primitives** from `@ds` — never raw hex. Because `@ds` + the tokens bind to the *active*
system, `Hero`/`PricingTiers` re-skin from Atelier → Noir with **zero edits**. The consistency lint
(`@medesign/dsr`'s rule engine) is the authority — `medesign lint` exits non-zero on any P0.

## Verified end-to-end
- `medesign init react-tailwind .` → 43-file project incl. `.claude/`, `.storybook/`, `design-systems/atelier`, config.
- `ds create noir import atelier` → `design-systems/noir/` (DESIGN.md + tokens.css + manifest + 6 primitives).
- `ds use noir` → rewired (tokens + `@ds` + graph); `ds validate noir` → **ok**.
- `lint Hero` / `lint PricingTiers` → **PASS**; an off-system component (raw indigo + purple gradient +
  invented metric + emoji) → **4 P0 blocking**, exit 1.
- `ds conflicts noir` (P2 orphans only) and `ds history noir --snapshot` work.
- **`npm run build-storybook` succeeds** — `@ds` resolves to Noir and the components compile.
