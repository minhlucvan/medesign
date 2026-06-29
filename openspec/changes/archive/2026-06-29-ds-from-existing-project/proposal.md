---
id: proposal
title: Design System From Existing Project
description: Standardize an existing codebase (with or without a DESIGN.md) into a ready-to-use emdesign design system, and adopt its components into the workflow loop
---

## Why

emdesign can create a design system from a natural-language prompt (`ds-from-prompt`) or
from an uploaded `DESIGN.md` (`ds-from-design-md`), but it has no path for the most common
real-world starting point: **a team already has a project**. They have a Tailwind config, CSS
custom properties, and dozens of React components with their own — often inconsistent — color,
spacing, and typography decisions. Today the only way to onboard such a project is to hand-write a
`DESIGN.md` and manually re-tokenize every component, which defeats the point of an automated
design-engineering engine. We need to **reverse-engineer the design decisions that already exist in
the code** and standardize the workspace into emdesign's contract so the existing components become
first-class citizens of the loop (design / edit / doctor / capture / critique).

## What Changes

- **New "From Existing Project" creation path.** The user points emdesign at a project directory
  (or the current workspace). The engine analyzes the source — Tailwind config, CSS variables,
  inline/utility classes, and component files — and infers a complete, standardized design system.
- **A `DESIGN.md` is optional, not required.** If the project already has one (any compatible
  format), it is treated as the canonical source and reconciled against what the code actually uses.
  If it is absent, the engine generates one from the extracted evidence and flags low-confidence
  inferences for review.
- **New multi-stage agent workflow** (`ds-from-project`) with SSE progress: scan project → extract
  design decisions → synthesize `DESIGN.md` → generate `tokens.css` → scaffold/derive primitives →
  adopt existing components → build graph → validate → emit an **adoption report**.
- **New backend API + CLI command** to start the workflow, stream progress, and return the report.
  CLI surface: `ds import project <path>` (alongside existing `ds import awesome|git|vendor`).
- **New MCP tools** for project analysis and component adoption, usable by the agent loop.
- **Component adoption.** Existing components are placed under the standardized component directory,
  hardcoded values are rebound to the newly inferred semantic tokens where it is safe to do so, and
  each component is registered in the graph. The report lists which components are loop-ready vs.
  which need manual fixes (so they don't silently fail the consistency lint later).
- **UI** in the System tab's creator to launch the flow, watch progress, and review/triage the
  adoption report (accept rebinds, mark components for follow-up). The UI is tracked as
  implementation-only with no spec contract: it is a display/triage client over the read-only
  `design-surface-api` (progress + report), so triage is client-side only and persists nothing.
- **No breaking changes** to the design system file format, token contract, or existing creation
  paths.

## Capabilities

### New Capabilities

- `ds-from-existing-project`: Orchestrates standardizing an existing project into a complete,
  validated emdesign design system — runs the multi-stage `ds-from-project` agent workflow, writes
  the standardized artifacts (`DESIGN.md`, `tokens.css`, `code/` primitives, `graph.json`), declares
  the system in `emdesign.config.json`, and produces an adoption report. Covers the new backend
  workflow endpoints, SSE progress, and the `ds import project` CLI command.
- `project-design-extraction`: Deterministic + agent-assisted analysis of an existing codebase that
  mines design decisions — color / typography / spacing / radius / shadow values from the
  Tailwind config, CSS custom properties, and component source — clusters them, proposes semantic
  token roles and primitive candidates, and records `file:line` provenance and a confidence score
  for every inference. Exposed as MCP tools.
- `component-adoption`: Brings an existing project's components under emdesign management — places
  them in the standardized component directory, rebinds hardcoded values to the inferred semantic
  tokens where safe, registers them in the graph, and reports per-component readiness (loop-ready vs.
  needs-manual-fix) so all downstream workflows can operate on them.

### Modified Capabilities

- `design-surface-api`: The surface API exposes status and real-time progress for the
  `ds-from-project` workflow (analysis, extraction, adoption stages) and serves the adoption report
  so the frontend can show live progress and a triage view.

## Impact

- **Backend** (`packages/backend/`): new `ds-from-project` workflow orchestrator, project-analysis
  and adoption modules, new `/api/*` endpoints with SSE progress, adoption-report model.
- **CLI** (`packages/cli/`): new `ds import project <path>` command (and `--json`/`--gate` support).
- **MCP tools** (`packages/mcp-server/src/mcp.ts`): new tools for project analysis / extraction / component
  adoption added to the tool surface.
- **Graph** (`@emdesign/graph`): adopted components and their inferred tokens are added to
  `graph.json` with provenance.
- **Frontend** (`packages/addon/`): new "From Existing Project" path in the System tab creator,
  progress view, and adoption-report triage UI.
- **Agent workspace** (`.claude/workflows/`): new DS-from-project workflow definition.
- **No breaking changes** to the existing design system format, token contract, or the
  `ds-from-prompt` / `ds-from-design-md` paths.
