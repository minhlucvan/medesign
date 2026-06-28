---
name: pipeline-loop
description: Automate the build-verify-capture cycle for multiple components. Use when you have several components to build, verify, and promote, or want continuous iteration until quality gates pass.
when: After the design system is stable and you need to produce multiple passing components efficiently.
workflow: pipeline
commands: [loop, generate --batch, capture --all, doctor all --gate, ds validate --strict]
---

# Pipeline & Automation Skill

## Purpose

Move from manual one-at-a-time component building to automated batch pipelines. The `loop` command implements a **double-loop architecture**: it alternates between building (generating code) and verifying (linting, rendering, gating) until the component passes — all without manual intervention.

## Workflow

```
1. Batch Generate  → generate --batch <manifest.json>
2. Loop Verify     → loop <component> [--max-iterations <n>]
3. Batch Capture   → capture --all [--baseline]
4. Validate DS     → ds validate --strict
5. Report          → doctor all --gate (final sign-off)
```

## Step-by-Step

### 1. Batch Generate

```bash
emdesign generate --batch manifest.json
```

The manifest is a JSON array of component specs:

```json
[
  { "name": "RevenueCard", "source": "import React from 'react'; ..." },
  { "name": "TransactionsTable", "source": "import React from 'react'; ..." }
]
```

Each component is generated in sequence and lint-checked automatically.

### 2. Double-Loop Verify

```bash
emdesign loop <component> [--max-iterations 5]
```

The loop runs this cycle:

```
┌──────────┐   ┌───────┐   ┌────────┐   ┌───────┐
│ Builder  │ → │ Lint  │ → │ Render │ → │ Gate  │
│ (agent)  │   │ (rule) │   │ (spatial)│  │ (score)│
└──────────┘   └───────┘   └────────┘   └───────┘
     ↑                             │
     └───── revise ────────────────┘
```

**Phase 1: Lint** — Fast token-rule compliance check. Blocks on P0 violations.

**Phase 2: Visual** — If Storybook is available, runs pixel-diff comparison.

**Phase 3: Gate** — Composite score check. If `mustFix === 0 && tokenScore >= 0.8`, passes.

Output: `SHIP` (pass) or `REVISE` (needs more work) after configured iterations.

### 3. Batch Capture

```bash
# Capture all components that pass
emdesign capture --all

# Capture with visual baseline seeding
emdesign capture --all --baseline
```

Iterates over all generated components, captures each one (promotes from `src/generated/` to `src/components/`).

### 4. Final Validation

```bash
emdesign ds validate --strict
```

After capture, validate the design system contract remains intact.

### 5. Full Gate

```bash
emdesign doctor all <component> --gate
```

Runs all verification kinds and exits with code 0 (ship) or 1 (revise).

## Batch vs Iterative

| Approach | When to Use |
|----------|-------------|
| `generate --batch` + `loop` per component | Components independent, each needs verification |
| `loop <component>` | Single component, iterate until gate passes |
| `capture --all` | Multiple components ready to promote |
| `doctor all --gate` | CI/CD or pre-commit hook |

## Command Reference

| Command | Purpose | Use Case |
|---------|---------|----------|
| `generate --batch <file>` | Generate multiple components from manifest | Bulk initial build |
| `loop <comp>` | Iterative build-verify cycle | Single component refinement |
| `capture --all` | Capture all generated components | Batch promotion |
| `doctor all --gate` | Full verification as CI gate | Pre-commit / CI |
| `ds validate --strict` | Token contract completeness | Post-capture validation |

## Common Pitfalls

- **Loop is not a replacement for human review** — it gates on deterministic metrics (lint score, mustFix count). Visual quality still needs human or vision-critic review.
- **Batch generate doesn't handle dependencies** — if Component A depends on Component B, generate B first. Batch processes in array order.
- **--max-iterations default is 10** — if a component doesn't pass by then, it's flagged for manual review. Don't increase this to infinity.
- **Capture --all overwrites** — if a component with the same name exists in `src/components/`, it's overwritten. Use version control.
