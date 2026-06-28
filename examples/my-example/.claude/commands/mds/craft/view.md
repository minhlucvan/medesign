---
name: "MDS: Craft View"
description: Build a large, complex page by progressive decomposition — entry-workflow routes to screen-compose for reuse analysis, blueprint application, and component composition.
category: Craft
tags: [craft, view, page, screen-compose, blueprint]
---

# MDS: Craft View

Build a full page by progressive decomposition. Routes through the **entry-workflow** which classifies
it as `compose` and delegates to the **screen-compose** workflow.

**Input**: a page name and sections (components/blueprints to compose).
Example: `/mds:craft:view Dashboard "main dashboard with stats, chart, and table"`

## Workflow

1. **Decompose.** Break the page into sections. For each section, check if a component exists
   (`explore components`) or a blueprint matches (`ds blueprint list`).
2. **Execute:** `Workflow({ name: 'entry-workflow', args: { type: 'compose', target: name, payload: { sections, layout } } })`
   - The **screen-compose** workflow:
     - **Reuse analysis**: existing components → pass through; blueprints → `ds blueprint apply`; new → `component-new`
     - **Build missing**: apply blueprints → build new components
     - **Compose**: `compose <name> --components "A,B,C" --layout <type>`
     - **Verify**: `render analyze` → `doctor all` on each new component
3. **Review.** Check the composed page renders correctly.

## Skill

Invoke the **`page-architect`** skill for detailed view decomposition guidance.

## Common Intents Routed Here

| Intent Example | Entry-Workflow Route | Layer |
|----------------|---------------------|-------|
| "Build a dashboard page" | `type: compose` → `screen-compose` | Screen |
| "Create a landing page" | `type: compose` → `screen-compose` | Screen |
| "Compose a settings view" | `type: compose` → `screen-compose` | Screen |
