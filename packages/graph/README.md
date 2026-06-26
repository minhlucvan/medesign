# @medesign/graph

A **labeled property graph** that encodes any information about a design system — files, stories,
components, tokens, colors, fonts, specs, rules, themes, props, variants, states, and artifacts —
each with `file:line` provenance.

## Role in the system

The graph powers the agent's awareness of the design system:

- **Where to fix** — localize a lint finding to the exact file:line and the token role to use
- **Impact propagation** — "what breaks if I change `--color-accent`?" (transitive dependents)
- **Consistency brief** — composable primitives, tokens by kind, governing rules, vibe
- **Context** — a node's wired neighborhood for prompt injection

## Usage

```bash
medesign graph build <id>    # Build from source → commits to design-systems/<id>/graph.json
```

Or via the `graph_rebuild` MCP tool. The graph is built **deterministically from code + metadata** —
never reconstructed by an LLM.

## Query intents

- `graph_where_to_fix` — localize a finding
- `graph_find_affected` — impact propagation
- `graph_consistency_brief` — build new on-system components
- `graph_get_context` — node neighborhood
- `graph_query` — generic property-filtered access

## Related

- `@medesign/dsr` — DDD domain layer over the graph data model
- `docs/data-model.md` — full node/edge kind specification
