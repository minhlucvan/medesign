# emdesign docs

The emdesign design-engineering engine — a headless Studio backend that drives **Storybook as its front
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

## Research & analysis

| Document | What it covers |
|---|---|
| [research/broken-fe-loop.md](research/broken-fe-loop.md) | Why stronger models alone won't solve the frontend bottleneck — four infrastructure shifts |
| [research/gap-analysis.md](research/gap-analysis.md) | Deep comparison of research proposals vs. current implementation across all four pillars |
| [research/implementation-gaps.md](research/implementation-gaps.md) | Concrete gap catalog — every documented-vs-actual discrepancy, with file:line references and fixes |
| [research/improvement-roadmap.md](research/improvement-roadmap.md) | Phased improvement plan: P0 (immediate automation) through P4 (Figma-to-code pipelines) |
| [research/story-charters.md](research/story-charters.md) | Component/story-level validation for Storybook — CSF charters, addon tab, doctor integration |

## Contributing

| Document | What it covers |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute a design system, skill, or agent adapter |
