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

## User stories

Independent user stories — "who, what, why" without implementation details.
These define the product vision; test scenarios derive from them.

| Story | Role | Goal |
|---|---|---|
| [01-first-contact](userstories/01-first-contact.md) | Developer evaluating emdesign | Go from zero to running Studio in 2 min |
| [02-pick-customize-ds](userstories/02-pick-customize-ds.md) | Product designer | Browse, preview, customize a design system |
| [03-chat-to-component](userstories/03-chat-to-component.md) | Designer (non-coding) | Describe a component in English, see it render |
| [04-quality-gate](userstories/04-quality-gate.md) | Frontend developer | Ship with confidence via 4-source critique |
| [05-compose-deliver](userstories/05-compose-deliver.md) | Product team | Compose components into production pages |
| [06-evolve-system](userstories/06-evolve-system.md) | Design system operator | Rebrand without rewriting components |
| [07-brownfield-project](userstories/07-brownfield-project.md) | Team with existing UI | Wire into running codebase, no restructuring |

## Test scenarios

Each journey starts from a user story and walks through concrete
Given/When/Then scenarios that exercise the full product experience —
filesystem, CLI, browser, chat, addon panels, critique gate, capture.

| Journey | Based on | Scenarios |
|---|---|---|
| [01-first-contact](testscenarios/01-first-contact.feature.md) | User story 01 | 3 |
| [02-pick-customize-ds](testscenarios/02-pick-customize-ds.feature.md) | User story 02 | 5 |
| [03-chat-to-component](testscenarios/03-chat-to-component.feature.md) | User story 03 | 6 |
| [04-quality-gate](testscenarios/04-quality-gate.feature.md) | User story 04 | 7 |
| [05-compose-deliver](testscenarios/05-compose-deliver.feature.md) | User story 05 | 6 |
| [06-evolve-system](testscenarios/06-evolve-system.feature.md) | User story 06 | 4 |
| [07-brownfield-project](testscenarios/07-brownfield-project.feature.md) | User story 07 | 6 |

**Total: 7 user stories → 37 test scenarios.**
