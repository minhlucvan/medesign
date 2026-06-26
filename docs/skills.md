# Skills protocol

A **skill** is a reusable recipe for producing a kind of UI (a pricing section, a dashboard, an
onboarding flow). It's agent-agnostic: the same `SKILL.md` renders against any adapter. Adapted from
open-design's Skills (`skills/<name>/SKILL.md`), specialized for medesign's **code-first, component**
output instead of one-off HTML.

## Folder

```
skills/<id>/
  SKILL.md          frontmatter + workflow (this doc)
  assets/           optional supporting files
  references/       optional reference material / exemplars
```

## SKILL.md frontmatter

```yaml
---
name: web-section
description: Generate a polished marketing/web section as a reusable React component.
trigger: ["section", "hero", "pricing", "features", "CTA"]
mode: component            # component | flow | page
scenario: marketing        # marketing | product | dashboard | docs
platform: web
example_prompt: "a pricing section with three tiers, highlight the middle one"
---
```

| Field | Meaning |
|---|---|
| `name` | skill id (folder name) |
| `description` | one line; used for selection |
| `trigger` | phrases that suggest this skill |
| `mode` | output shape — `component` (one reusable component), `flow`, or `page` |
| `scenario` / `platform` | context that tunes the workflow |
| `example_prompt` | a canonical request |

## Workflow (markdown body)

Numbered steps the agent follows. A skill **binds the active design system** (it does not define its own
styling) and **emits a component + CSF story**. Steps should reference medesign's MCP tools.

## Composition

At generation time the prompt = the active design system's `DESIGN.md` + `tokens.css` + primitives
(via `get_design_context`) **+** the selected skill's workflow **+** the user's request. The design
system governs *how it looks*; the skill governs *what to build and the steps*; the consistency lint +
visual test verify the result. See [`architecture.md`](./architecture.md).
