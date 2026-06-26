# `ds doctor` — rule-based design-system linting

`ds doctor` scans a design system and reports **findings** — what's missing or off, with a concrete fix and
where to improve to be production-ready. The grade is intentionally minimal (`X/Y rules passed`); the
**findings are the product**. It runs over the rich **dsr + graph data model**, not by re-parsing files.

```bash
medesign ds doctor <id>            # print the findings report + X/Y rules passed
medesign ds doctor <id> --gate     # exit 1 if any P0/P1 finding remains (CI gate)
medesign ds doctor open-design/digits-fintech-swiss   # grade a vendored base
```
Also the MCP tool `grade_design_system` and `gradeDesignSystem(paths, id)`. Implementation:
**`@medesign/doctor`** (`lintDesignSystem` + the built-in ruleset, depends on `@medesign/dsr` only); the backend
orchestrates (loads the aggregate, gathers conflicts + graph stats + the composed stack's `doctorRules()`).

## Rules are plugin-extensible
A review rule is a `DesignReviewRule { id, category, title, severity, target, check(ctx) → { pass, detail, fix } }`
(in `@medesign/dsr`). The doctor runs the **core ruleset** + every rule a plugin in the stack contributes via
`doctorRules()`. Today:
- **core** — token-contract, sections, type-scale depth, components-with-states, token richness, theming,
  doc-depth, motion, craft-contract, conflicts, anti-slop, primitives.
- **plugin-css** — `css-theming-complete` (every theme overrides all color roles), `css-contrast-aa`
  (surface↔text ≥ WCAG AA, read from the `contrastPair` nodes its parser emits).
- **plugin-react** — `react-stories`, `react-variants`.
- **plugin-tailwindcss** — `tailwind-token-binding` (primitives bind to token roles).

`ctx` is a `ReviewContext { ds, conflicts, stats }` — the `DesignSystem` aggregate + relational conflicts + graph
node/edge counts (including any plugin-contributed node types). Rules query **data**, not markdown.

## How a plugin extends the core
A `MedesignPlugin` can contribute, beyond codegen/lint:
- `graphParsers()` — parsers run during `buildGraph` that emit nodes/edges (any label). **`plugin-css` owns
  CSS→graph parsing**: tokens, colors, typefaces, themes, plus new node types `cssVarGroup`, `breakpoint`,
  `contrastPair`.
- `nodeTypes()` — declares the labels it contributes (the graph's labels are runtime-open).
- `doctorRules()` — the review rules above.
These are aggregated by `composeStack` and bridged into the graph build (`buildOpts`) + the runtime + the doctor.

## Calibration (it discriminates)
- `ledger` (`examples/ledger-console`, react+css+tailwind) → **18/18 · A · production-ready**.
- `digits-fintech-swiss` (vendored baseline) → passes the core rubric.
- `atelier` (toy starter) → **12/18 · D**, with fixes: shallow type-scale (10<14), 5<7 components, 24<26 tokens,
  no theming, 863<1300 words.
