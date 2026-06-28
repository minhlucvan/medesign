---
name: "MDS: Vision"
description: Vision-only critique — screenshot the component story and have the vision-critic assess hierarchy, balance, spacing rhythm, on-brand fit, and polish.
category: Design
tags: [design, vision, screenshot, feedback]
---

# MDS: Vision

The vision feedback source in isolation. Useful to sanity-check how a component *looks* before/after a change.
Uses the CLI `vision` command directly.

**Input**: a component name. Example: `/mds:vision Testimonials`

## Workflow

1. **Run vision critique:**
   ```bash
   emdesign vision <name> [--mode standard|compare] [--provider claude|gemini|minimax]
   ```
   - Captures a fresh Playwright screenshot
   - Sends to the vision AI provider for 5-axis scoring:
     - **Hierarchy** — visual weight distribution
     - **Balance** — left/right, top/bottom equilibrium
     - **Spacing** — rhythm and density
     - **On-brand** — fit with design system
     - **Polish** — overall refinement
2. **Report.** Present the per-axis scores + overall vision score + specific findings.

## When to Use

- **After** `/mds:review` (deterministic checks pass), to get a human-like quality assessment
- **Before/after** a change to measure visual improvement
- **In isolation** when the component looks wrong but all deterministic checks pass

## CLI Reference

```bash
# Standard critique
emdesign vision StatsCard

# Compare against a reference screenshot
emdesign vision StatsCard --mode compare --reference ./before.png

# Use a specific AI provider
emdesign vision StatsCard --provider gemini
```

## Common Intents Routed Here

| Intent Example | Action |
|----------------|--------|
| "How does StatsCard look?" | `emdesign vision StatsCard` |
| "Compare before and after" | `emdesign vision --mode compare` |

## Guardrails
- The critic judges the rendered pixels, not the code. Pair with `/mds:review` for rule/structure checks.
- Be specific and visual in findings, not generic praise.
