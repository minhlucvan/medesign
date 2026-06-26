# @medesign/dsr

The **design-system runtime** — a DDD domain layer over the `@medesign/graph` data model. Lets you
load, read, and manage a design system like a typed code library.

## Role in the system

`dsr` provides the typed domain abstractions that every other package builds on:

- **Aggregates** — `DesignSystem`, `Token`, `Primitive`, `Story`, `Artifact`
- **Rule engine** — `DesignReviewRule` interface with `check(ctx)` → `{pass, detail, fix}`
- **Validation** — token contract self-check, structural validation
- **References** — cross-file reference resolution with `file:line` provenance
- **Conflicts** — detection of token/primitive conflicts
- **Cache + History** — efficient reads, change snapshots

## Related

- `@medesign/graph` — the underlying graph data model
- `@medesign/doctor` — rule-based production-readiness linting (runs over dsr aggregates)
- `@medesign/plugin-*` — plugins extend dsr's rule engine via `doctorRules()`
