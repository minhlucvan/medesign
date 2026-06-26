# Design-system data model — the knowledge graph

`@medesign/graph` encodes **any information of a design system** as a **labeled property graph** so the
agent can craft, customize, and fix a design system with full awareness: *where* to fix something (down to
`file:line`), *what a change affects* (impact propagation), and *how to build something new* that's
on-system. This is the data-modeling reference; the package lives at `packages/graph/`.

## Why a property graph

A design system is deeply relational — a token is used by a primitive, which is composed by an artifact,
which is rendered by a story, governed by a rule, defined in a spec section. Flat text can't answer
"what breaks if I change `--color-accent`?" A **labeled property graph** (nodes + edges that both carry
properties) makes those relationships first-class and filterable.

## Shape

```ts
type Node = { id: string; label: NodeLabel; props: Record<string, unknown> };
type Edge = { id: string; label: EdgeLabel; from: string; to: string; props: Record<string, unknown> };
```

- `label` = the kind (tables below). `props` = an open key→value bag, so new information attaches without
  schema churn.
- **Provenance is universal:** every node carries `props.source = { file, line? }` and a `declaredIn`
  edge to its `file` node — so any query resolves to an exact `file:line`.
- Queries **filter on label + props**: `nodes({ label: 'token', where: { kind: 'color' } })`,
  `edges({ label: 'violates', where: { severity: 'P0' } })`.

## Node kinds

| label | id pattern | notable props |
|---|---|---|
| `designSystem` | `<ds>` | name |
| `file` | `<ds>/<relpath>` | path, type (`tokens`/`design`/`component`/`story`/`manifest`/`asset`) |
| `section` | `<ds>/§<slug>` | title, index |
| `token` | `<ds>/--<name>` | name, kind (`color`/`type`/`spacing`/`radius`/`shadow`/`motion`/`layout`), value |
| `color` | `<ds>/<hex>` | value (deduped concrete swatch) |
| `typeface` | `<ds>/face/<family>` | family, role |
| `theme` | `<ds>/<theme>` | name |
| `primitive` | `<ds>/<Name>` | name |
| `prop` | `<ds>/<Name>#<prop>` | name, type |
| `variant` | `<ds>/<Name>@<value>` | name |
| `state` | `<ds>/<Name>:<state>` | name |
| `story` | `<ds>/<Base>.stories#<Export>` | title, exportName |
| `artifact` | `art/<Name>` | name, status (`generated`/`captured`) |
| `rule` | `rule/<id>` | ruleId, severity, message, remediation, appliesTo |
| `skill` | `skill/<id>` | name, mode, scenario |
| `intent` | `intent/<slug>` | slug, title (the change's spec/"playbook" — overlay) |

## Edge kinds

| label | from → to | meaning |
|---|---|---|
| `declaredIn` | any → file | provenance (where it lives) |
| `contains` | designSystem → * | catalog membership |
| `definedIn` | token → section | which spec section specifies the token |
| `tokenValue` | token → color | the concrete color a role points at |
| `usesFont` | token → typeface | font role → family |
| `uses` | primitive\|variant → token | consumes a token role |
| `composes` | artifact\|primitive → primitive | builds out of |
| `references` | artifact → token\|color | direct token/color use |
| `hasProp` / `hasVariant` / `hasState` | primitive → prop\|variant\|state | component surface |
| `storyOf` | story → primitive\|artifact | what a story renders |
| `overrides` | theme → token | theme re-value |
| `governs` | rule → primitive\|artifact | which rule applies |
| `violates` | artifact → rule | a detected violation (props: severity, snippet, source) |
| `documentedBy` | primitive → section | spec coverage |
| `produces` | intent → artifact | the change's spec/playbook that drove the artifact (overlay) |

Inverse relations (e.g. *affectedBy*) are computed by reverse traversal, not stored.

## Source → graph encoding

| Source | Pass | Produces |
|---|---|---|
| every file under `design-systems/<id>/` | walk | `file` nodes + `contains` |
| `tokens.css` | `addTokens` | `token` (+ `color` via `tokenValue`, `typeface` via `usesFont`), `declaredIn` |
| `DESIGN.md` | `addSections` | `section` nodes; `definedIn` (token mentioned in a section's body) |
| `code/*.tsx` | `addPrimitives` (ts-morph) | `primitive`, `prop`, `variant`, `state`; `uses`; `composes` |
| `code/*.stories.tsx` | `addStories` (ts-morph) | `story` + `storyOf` |
| rule registry (`rules.ts`) | build | `rule` nodes + `governs` (minus `manifest.craft.exemptions`) |
| `skills/*/SKILL.md` | `addSkills` | `skill` nodes |
| generated/captured `*.tsx` + lint findings | `overlayArtifact` | `artifact`, `composes`, `references`, `violates` |

## Query intents

- **`whereToFix(artifactId, findingId)`** → the offending `file:line`, the token role to use (+ its
  `file:line`), and the defining spec section. *Localize any fix.*
- **`findAffected(nodeId)`** → reverse-traverse `uses`/`references`/`composes`/`tokenValue`/`hasVariant`/
  `storyOf`/`overrides` for the transitive dependents. *Change `--color-accent` → Button, Button@primary,
  Badge@accent, its stories, PricingTiers.*
- **`consistencyBrief({ name, intent })`** → composable primitives, tokens by kind, governing rules, and the
  vibe (Visual Theme + Anti-patterns sections). *Build new, on-system.*
- **`getContext(nodeId)`** → a node's wired neighborhood for prompt injection.
- **`query({ label?, where?, edgeLabel?, from?, to? })`** → generic property-filtered access; `toJSON()`
  exports the whole graph (for a future Storybook viewer).

## Worked example — `PricingTiers`

```
art/PricingTiers ──composes──▶ atelier/Button ──uses──▶ atelier/--color-accent ──tokenValue──▶ atelier/#b4532a
       │                              ▲                         │
       ├──composes──▶ atelier/Card    │ hasVariant              └──definedIn──▶ atelier/§color
       ├──composes──▶ atelier/Badge   atelier/Button@primary ──uses──▶ atelier/--color-accent
       ├──references──▶ atelier/--color-accent
       └──violates──▶ rule/off-token-color   (if a raw hex slipped in)
```
- `findAffected('atelier/--color-accent')` → `{Button, Button@primary, Badge@accent, Button.stories, art/PricingTiers}`.
- `whereToFix('art/PricingTiers', 'off-token-color')` → "use `--color-accent` (atelier/tokens.css:8, defined §Color); offending code at art/PricingTiers (file:line)."

## Build modes
The graph is built **deterministically from code + metadata** via the CLI/MCP (`medesign graph build`,
`graph_rebuild`) — never reconstructed by the LLM. Two modes, chosen by the project's framework adapter:
- **AST + metadata** (`parseCode: true`, e.g. `react-tailwind`): real wiring — `uses`/`composes`/`hasProp`/
  `hasVariant` from the source, plus the metadata layer.
- **Metadata-only** (`parseCode: false`, stub frameworks): primitives from filenames (`parsedFrom: 'metadata'`)
  + the token/color/section/file layer from regex over `tokens.css`/`DESIGN.md`/`manifest.json`. No code
  wiring yet — the agnostic loop (visual + vision + gate) still carries quality until an adapter lands.

The **intent overlay** (`intent` node + `produces` edge) is layered on at artifact-overlay time from
`design/changes/<slug>/intent.md` — the spec/playbook is an *overlay for traceability*, never the base
source of truth.

## Persistence
`design-systems/<id>/graph.json` (committed, diffable), built on demand via `medesign-backend graph build <id>`
or the `graph_rebuild` MCP tool. Artifacts are overlaid at query time.
