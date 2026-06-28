---
name: ds-lint-rules
description: Manage per-design-system lint rule presets, severities, and exemptions. Use when a design system needs different lint strictness (e.g. fintech needs strict contrast, editorial relaxes accent-overuse).
when: After creating or importing a design system, before building components against it.
workflow: configure
commands: [ds lint-rules list, ds lint-rules set, ds lint-rules preset, ds conflicts]
---

# Design System Lint Rules Skill

## Purpose

Each design system category needs different lint rules. A fintech dashboard should fail on insufficient contrast; an editorial site might relax accent-overuse. This skill teaches you to configure the right rule set for your design system's purpose.

## Built-In Rule Presets

| Preset | Best For | Rules | When to Use |
|--------|----------|-------|-------------|
| `editorial` | Content-heavy, serif-led | off-token-color, accent-overuse, filler-copy, sans-display | Default — editorial/creative |
| `product` | UI apps, dashboards | off-token-color, accent-overuse, emoji-icon, invented-metric | Standard UI applications |
| `fintech` | Financial, data-dense | + strict-contrast, mono-data-values, no-decorative-accent | Banking, trading, data dashboards |
| `minimal` | Clean, restrained | —accent-overuse, —external-image, + strict-spacing | Minimal/brand-focused |
| `brutalist` | Bold, experimental | —accent-overuse (exempted), + no-focus-ring | Experimental/artistic |
| `a11y-strict` | Accessibility-first | All rules at P0, +contrast-min-7-1, +focus-visible-required | Public sector, regulated |

## Workflow

```
1. List current rules  → ds lint-rules list <id>
2. Assess fit          → does the preset match the DS category?
3. Apply preset        → ds lint-rules preset <id> <preset>
4. Adjust rules        → ds lint-rules set <id> <rule> <severity>
5. Verify conflicts    → ds conflicts <id>
```

## Step-by-Step

### 1. List Active Rules

```bash
emdesign ds lint-rules list <id>
```

Shows: preset name, applies list (active rules), exemptions list (disabled rules).

### 2. Apply a Preset

```bash
emdesign ds lint-rules preset atelier product
```

Changes the system to the `product` preset. Presets define:
- **applies** — which rules are active and at what default severity
- **exemptions** — which rules are excluded

### 3. Set Individual Rule Severity

```bash
# Make a rule blocking (P0)
emdesign ds lint-rules set atelier accent-overuse P0

# Disable a rule entirely
emdesign ds lint-rules set atelier accent-overuse off

# Lower severity (P1, P2)
emdesign ds lint-rules set atelier accent-overuse P1
```

### 4. Check Conflicts

```bash
emdesign ds conflicts <id>
```

Lists orphan or unused tokens — tokens declared but not referenced by any primitive.

## Understanding Rule Severities

| Severity | Meaning | Gate Impact |
|----------|---------|-------------|
| **P0** | Blocking — must fix before ship | `mustFix` counter increments, gate fails |
| **P1** | Warning — should fix | Increases composite score requirement |
| **P2** | Advisory — informational | No gate impact |
| **off** | Disabled — not checked | Rule is exempted |

## Command Reference

| Command | Purpose |
|---------|---------|
| `ds lint-rules list <id>` | Show all active rules and exemptions |
| `ds lint-rules preset <id> <preset>` | Apply a named preset |
| `ds lint-rules set <id> <rule> <severity>` | Change rule severity |
| `ds conflicts <id>` | List token conflicts/orphans |

## Common Pitfalls

- **Preset overrides all manual changes** — calling `preset` replaces the entire applies/exemptions lists. Set individual rules AFTER applying the preset, not before.
- **Exemptions are rule-specific** — setting a rule to `off` adds it to `exemptions`, which is a different list from `applies`. It's removed from checking entirely.
- **`fintech` and `a11y-strict` are demanding** — they add contrast and accessibility rules that may fail on many existing components. Only apply if the design system was built for it.
- **Check conflicts after major preset changes** — changing presets can surface token orphans. Run `ds conflicts` to verify.
