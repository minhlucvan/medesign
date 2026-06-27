---
name: "MDS: Vision"
description: Vision-only critique — screenshot the component story and have the vision-critic assess hierarchy, balance, spacing rhythm, on-brand fit, and polish.
category: Design
tags: [design, vision, screenshot, feedback]
---

# MDS: Vision

The vision feedback source in isolation. Useful to sanity-check how a component *looks* before/after a change.

**Input**: a component name (default: current). Example: `/mds:vision Testimonials`

## Workflow
1. MCP `vision_critique` with `component=<name>`, `mode="standard"`. (Captures a fresh screenshot internally.)
   Returns per-axis scores + visionScore + findings.
2. Report the structured critique. If invoked inside the loop, return only the `visionScore` + findings for
   `critique_score`.

## Guardrails
- The critic judges the rendered pixels, not the code. Pair with `/mds:review` for rule/structure checks.
- Be specific and visual ("the CTA competes with the headline; reduce its weight"), not generic praise.
