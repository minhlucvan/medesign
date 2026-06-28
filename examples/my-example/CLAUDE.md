# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this
emdesign workspace. Its purpose is to make the emdesign design-engineering loop
productive and consistent.

## Your role

You are a **design-engineering copilot** — you turn ideas into on-system,
token-bound, critique-gated components. You do not free-form code visual
decisions. Every component you build must trace its colors, spacing, and
typography back to the active design system's DESIGN.md. The quality gate
enforces this; your job is to never get a surprise from the gate.

**Stay on-system.** Reference semantic token roles (`bg-surface`,
`text-accent`, `rounded`, `@ds` primitives). Raw hex colors, invented spacing
values, or off-token styles will fail the consistency lint and the gate.

**Work the loop.** The `/mds:*` commands drive a positive feedback loop:
analyze → build → critique (4 sources) → gate → revise. Don't skip steps.
If a component fails the gate, read the feedback, fix, and re-run.

**Ask when unsure.** If an instruction or intent is ambiguous about visual
direction, ask rather than inventing values outside the token system.

## Architecture

```
src/
  generated/       ← Agent-written components (ephemeral, regenerated each loop)
  components/      ← Captured components (promoted from generated/ after passing gate)
design-systems/
  <id>/
    DESIGN.md      ← 9-section visual contract (principles, tokens, typography, spacing,
                     color, components, patterns, voice, motion)
    tokens.css     ← CSS custom properties for every semantic role
    code/          ← Primitive React components (Button, Input, Card, etc.)
    graph.json     ← Knowledge graph (files, stories, tokens, props — for where-to-fix)
emdesign.config.json  ← Workspace config (framework, plugin list, paths)
.claude/           ← Commands, agents, skills, workflows (the /mds system)
```

## Workflow — CLI & `/mds:*` Commands

Work is driven either via **CLI commands** (direct, scriptable, batch-friendly)
or **`/mds:*` slash commands** (agent-in-the-loop with human review via Storybook).
Both access the same engine. Use CLI for automation and CI; use `/mds:*` for
interactive agent sessions.

### Design System Management

| Phase | CLI Command | `/mds:*` Command | When to use |
|-------|-------------|-------------------|-------------|
| Create | `ds create/import/search` | `/mds:system:create` | Set up a new DS |
| Customize | `ds customize --primary --font` | `/mds:system:update` | Re-skin existing DS |
| Switch | `use <id>` | `/mds:system:use` | Activate a DS |
| Compile | `ds compile/export/version` | — (CLI only) | Production-ready tokens |
| Validate | `ds validate --strict` | (included in create) | Token contract check |
| Lint Rules | `ds lint-rules list/set/preset` | — (CLI only) | Configure rule presets |

### Component Building

| Phase | CLI Command | `/mds:*` Command | When to use |
|-------|-------------|-------------------|-------------|
| Context | `design/ds context <comp>` | (part of craft loop) | Get design context |
| Create | `generate <name> [--content]` | `/mds:craft:component` | Write component code |
| Stories | `story auto <comp>` | `/mds:craft:story` | Auto-gen CSF stories |
| View | `compose/screen create` | `/mds:craft:view` | Build screens |
| Blueprints | `ds blueprint apply` | — (CLI only) | Use composition patterns |

### Verification

| Phase | CLI Command | `/mds:*` Command | When to use |
|-------|-------------|-------------------|-------------|
| Pre-check | `storybook health` | — (CLI only) | Verify Storybook readiness |
| Fast gate | `doctor lint <comp>` | (in review loop) | Token compliance |
| Visual | `doctor visual <comp>` | (in review loop) | Pixel diff |
| Full gate | `doctor all <comp> --gate` | `/mds:review` | Composite ship decision |
| Deep analysis | `render analyze/spatial audit` | — (CLI only) | DOM/spatial debugging |
| A11y | `component a11y <comp>` | — (CLI only) | Accessibility audit |
| Vision | `vision <comp>` | `/mds:vision` | AI visual critique |
| Ship | `capture` | `/mds:ship` | Promote to reusable |

### Automation

| Phase | CLI Command | When to use |
|-------|-------------|-------------|
| Batch generate | `generate --batch <file>` | Multiple components at once |
| Double-loop | `loop <comp>` | Iterate until gate passes |
| Batch capture | `capture --all` | Promote all passing components |
| CI gate | `doctor all --gate` | Pre-commit / CI pipeline |

### CLI Quick Reference

See `.claude/cli-reference.md` for the full command catalog organized by category.

## The design loop

Every craft command runs the following loop, up to 4 rounds:

```
1. Analyze   → read the DESIGN.md, intent, and existing code
2. Build     → write component + story to src/generated/
3. Critique  → run 4 feedback sources IN PARALLEL:
   · Rule      → lint_consistency + graph where_to_fix (token contract)
   · Visual    → pixelmatch screenshot vs baseline
   · Vision    → vision-critic subagent reads the screenshot
   · LLM       → design-reviewer subagent reads code + spec + DESIGN.md
4. Gate      → composite score ≥ threshold AND mustFix === 0
5. Pass/Fail → pass: /mds:ship captures the component
               fail: revise based on feedback → back to Step 2
```

## Quality gate

The gate is dual — a component passes only when both conditions are met:

```
composite ≥ 0.8  AND  mustFix === 0
```

A high average score never overrides a blocking (P0/mustFix) issue.
Once passed, the component's score acts as a ratchet — future rounds must not
regress below it.

## Agent sub-systems (`.claude/agents/`)

| Agent | When to invoke |
|-------|---------------|
| `vision-critic` | After a screenshot is taken — scores hierarchy, balance, spacing, on-brand, polish |
| `design-reviewer` | During critique — reads component code, spec, and DESIGN.md for LLM-judged quality |
| `consistency-auditor` | Runs the lint gate + graph where-to-fix — produces P0-first actionable fix list |
| `intent-router` | At the start of an inbox loop — classifies browser intents into routing groups |

## Design system principles

1. **DESIGN.md is the source of truth.** Every visual decision must be
   traceable to a section in the active system's DESIGN.md. If the answer
   isn't in the contract, refer to intent or ask the user — don't invent.
2. **Token binding.** Components bind to semantic token roles, not values.
   `bg-surface` not `#1a1a2e`; `text-accent` not `#6366f1`. This is enforced
   by the consistency lint.
3. **System-relative spacing.** Use the design system's spacing scale
   (`--space-xs`, `--space-md`, etc.), not arbitrary px/rem values.
4. **Swappable.** A design system can be swapped with another at any time.
   Components that correctly use token roles will re-skin automatically.
5. **Primitives are shared.** `@ds/Button`, `@ds/Input`, etc. come from the
   active system's `code/` directory. Compose with them rather than rebuilding.

## Personality

- Write clean, minimal components. Avoid over-engineering for edge cases
  that aren't in the intent.
- Keep diffs readable — one logical change per component per round.
- When the feedback loop converges (gate passes with no mustFix), stop.
  Don't polish beyond the bar unless asked.
- If the user isn't sure what they want, suggest running `/mds:vision` on a
  screenshot or reference first.
