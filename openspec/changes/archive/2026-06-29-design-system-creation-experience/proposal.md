---
id: proposal
title: Design System Creation Experience
description: Better UI, agent-driven creation workflow, and agent-driven update workflow for design systems
---

## Why

The current design system creation flow is file-oriented and agent-unaware. Users pick a base or fill skeleton files, but there's no guided end-to-end journey from "I have an idea" → "here's a complete, tokenized, primitive-backed design system." The agent loop — emdesign's core differentiator — is absent from DS creation. The System tab shows existing systems and a catalog, but creating or updating one requires switching tabs, editing files manually, or writing a one-line text input.

## What Changes

From the user's perspective, it's a 2-phase flow:

**Phase 1 — Enter one thing, watch it build.**  
User picks from a gallery, types a prompt, or uploads DESIGN.md. Then they watch a progressive workflow generate DESIGN.md → tokens.css → primitives → graph → validate, with each artifact appearing in the preview panel as it completes. No waiting for a black box — the system assembles in front of them.

**Phase 2 — Refine from UI or chat.**  
The created system appears as a section-card dashboard (Branding, DESIGN.md, Colors, Typography, Spacing, Motion, Primitives). Each card has inline editing for quick tweaks AND a [Customize with AI] button that opens a scoped chat intent. User can edit a hex value directly or say "shift the accent warmer" — both work.

Three pillars behind the scenes:

**1. Better UI for the Design System tab** — Unified surface for creating and updating the project's single design system. System tab has 3 views: Design System (section-card dashboard), Catalog (vendor bases), Create New (3-path creator). The "+ Create" tab is simplified — DS creation lives entirely in the System tab.

**2. Workflow to create a design system** — Multi-stage agent workflow with progressive SSE feedback: analyze input → generate DESIGN.md → generate tokens.css → scaffold primitives → build graph → validate. Each stage pushes intermediate artifacts to the preview panel.

**3. Workflow to update a design system** — Scoped agent refinement per section card. User clicks [Customize with AI] on any card, the agent reads only that section's context, applies changes, and reports what was done. Pre-modification snapshots enable revert.

## Capabilities

### New Capabilities

- `ds-from-prompt`: Create a complete design system from a natural language prompt via agent workflow — agent generates DESIGN.md, tokens.css, and scaffolds primitives in a multi-stage loop
- `ds-from-design-md`: Upload or reference a DESIGN.md file; system auto-extracts branding, generates token contracts, and scaffolds primitives via an agent workflow
- `ds-customization-flow`: Visual multi-step guided customization with live preview when importing from vendor bases — identity, colors, typography, shape, review
- `ds-agent-refinement`: Conversational post-creation iteration — user requests changes to any aspect (tokens, primitives, visual style) and the agent executes them
- `ds-token-manager`: Visual token browser/editor and primitive scaffolding UI within the DS tab — no file editing required

### Modified Capabilities

- `design-surface-api`: The surface API should expose design system creation status and workflow progress so the frontend can show real-time agent progress during DS generation

## Impact

- **Frontend** (`packages/addon/`): Major changes to DesignSystemTab — the 3 creation paths, customization flow, token manager, refinement UI. CreateWizard loses its DS form.
- **Backend** (`packages/backend/`): New workflow endpoints for create/update, expanded customization API, SSE progress streaming
- **Agent system** (`.claude/workflows/`): New DS generation workflow and refinement handler
- **MCP tools**: New tools for prompt analysis, DESIGN.md generation, token generation, system refinement
- **No breaking changes** to existing design system file format or token contract
