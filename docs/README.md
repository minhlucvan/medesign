# medesign docs

The medesign design-engineering engine — a headless Studio backend that drives **Storybook as its front
end**, turning ideas into reusable, visually-tested React components through an agent-driven live loop.

## Getting started

| Document | What it covers |
|---|---|
| [QUICKSTART.md](QUICKSTART.md) | Run the live design loop end-to-end in 5 minutes |
| [architecture.md](architecture.md) | System architecture, component diagram, data flow |

## Core concepts

| Document | What it covers |
|---|---|
| [architecture.md](architecture.md) | System architecture — MCP server, lint, visual test, critique gate |
| [harness-engine.md](harness-engine.md) | The multi-feedback design loop — analyze → intent → build → verify → gate → ship |
| [spec.md](spec.md) | DESIGN.md specification — the 9-section contract, tokens.css, code/ binding |
| [data-model.md](data-model.md) | Design-system knowledge graph — node/edge kinds, queries, persistence |

## Guides

| Document | What it covers |
|---|---|
| [authoring-design-systems.md](authoring-design-systems.md) | How to write a great DESIGN.md — exact values, semantic roles, anti-patterns |
| [workspace.md](workspace.md) | Workspace architecture — init/attach, FrameworkAdapter, two flows |
| [skills.md](skills.md) | Skills protocol — reusable recipes for producing UI |
| [doctor.md](doctor.md) | `ds doctor` — rule-based design-system linting and production-readiness |

## Reference

| Document | What it covers |
|---|---|
| [agent-adapters.md](agent-adapters.md) | Pluggable agent-adapter registry — `MinimalAgentDef` contract |
| [vision-feedback.md](vision-feedback.md) | LLM-powered visual critique — five axes, providers, scoring |
| [open-design-analysis.md](open-design-analysis.md) | Engineering record of what we port, adapt, and beat from open-design |

## Contributing

| Document | What it covers |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute a design system, skill, or agent adapter |
