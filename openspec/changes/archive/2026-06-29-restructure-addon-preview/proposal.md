---
id: proposal
title: Restructure Addon Preview
description: Extract monolithic preview.tsx into isolated tool modules, DOM utilities, and a backend service layer
---

## Why

The `@emdesign/addon` preview overlay (`preview.tsx`) has grown into a 447-line monolithic component that mixes DOM event handling, tool-specific business logic (comment, copy, reference, text-edit, wand, place), inline popup rendering, and state management in one file. The manager-side `Tool.tsx` similarly couples toolbar UI with backend API orchestration. This makes it hard to add new tools, debug tool-specific issues, test individual behaviors, or customize the addon for different Storybook setups. A production-ready open-source addon needs clear separation of concerns, extensible tool architecture, and testable units.

## Requirements

- The addon overlay SHALL separate DOM event handling, tool-specific business logic, inline popup rendering, and state management into dedicated modules
- The toolbar SHALL delegate all backend API orchestration to a dedicated service module
- Each tool SHALL be extractable to its own module under `src/tools/<tool-name>/` with a shared `ToolDefinition` interface
- Tool registration SHALL be pluggable — adding a new tool SHALL require adding a module, not modifying a switch statement
- The overlay rendering SHALL be separated from tool logic — `ToolOverlay` becomes a thin orchestrator
- DOM utility functions SHALL be extracted to a shared `dom-utils` module as standalone, testable pure functions
- `ChatModeController` SHALL separate CSS injection from chat UI mounting
- Each extracted module SHALL have unit tests; each tool SHALL have at least one integration test

## What Changes

- **Extract each tool into its own module** under `src/tools/<tool-name>/` with a shared `ToolBase` contract — each tool owns its event handling, overlay rendering, and data construction
- **Separate overlay rendering from tool logic** — `ToolOverlay` becomes a thin orchestrator; tools register handlers for events and render their own visual indicators
- **Extract a standalone DOM utility layer** — `cssPath`, `buildTarget`, `describe`, computed-style helpers move to `src/dom-utils/`
- **Split `Tool.tsx` backend integration** — extract API orchestration (session creation, intent submission, comment persistence) into a dedicated `src/hooks/useToolBackend.ts` or `src/services/toolBackend.ts`
- **Make tool registration pluggable** — tools declare their mode key, hint text, icon, and event handlers so adding a new tool means adding a module, not modifying a switch
- **Simplify `ChatModeController`** — separate CSS injection from chat UI mounting; make the chat toggle behavior an exported hook
- **Establish clear file boundaries**: overlay orchestrator → tool modules → DOM utilities → backend service → renderers
- **Add unit tests for each extracted tool and utility function**

## Capabilities

### New Capabilities
- `tool-architecture`: Extensible tool framework with registration API, shared event pipeline, and per-tool lifecycle hooks
- `tool-comment`: Comment tool (re-extracted to new architecture)
- `tool-copy`: Copy element identifier tool
- `tool-reference`: Element reference tool
- `tool-text-edit`: Inline text editing tool
- `tool-wand`: Auto-fix wand tool
- `tool-place`: Component placement tool
- `dom-utils`: Shared DOM utilities (cssPath, buildTarget, describe, computedStyles)
- `toolbar-backend`: Backend API orchestration for tool events
- `chat-controller`: Chat mode controller extracted as hook + CSS service

### Modified Capabilities
- *(none — the existing addon doesn't have spec-tracked capabilities for the overlay)*

## Impact

- `packages/addon/src/preview.tsx` — major restructure (will become thin orchestrator or be replaced)
- `packages/addon/src/Tool.tsx` — split UI from backend logic
- `packages/addon/src/ChatModeController.tsx` — extract CSS service
- `packages/addon/src/channel.ts` — may gain tool registration types (no breaking changes to event contracts)
- New directories: `src/tools/`, `src/dom-utils/`, `src/services/`, `src/hooks/`
- No changes to the backend API or event channel contracts — this is purely a frontend architecture restructure
