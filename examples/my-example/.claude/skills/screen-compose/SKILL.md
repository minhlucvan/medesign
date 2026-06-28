---
name: screen-compose
description: Build screens and views by composing existing components and blueprints. Use when you need to turn a multi-component layout into a screen with routing.
when: After building the individual components for a page. Before creating the route and screen.
workflow: compose
commands: [compose, screen create, screen list, blueprint apply, blueprint list, scaffold --blocks]
---

# Screen & View Composition Skill

## Purpose

Assemble components into screens, screens into navigation structures. The CLI supports progressive composition: primitives → blueprints → views → screens, each level adding structure and routing.

## Composition Hierarchy

```
Primitives (Button, Card, Input, Table)  ← from design system code/
    ↓
Blueprints (stat-card, data-table, form-section)  ← pre-composed patterns
    ↓
Views (Dashboard, Reports, Settings)  ← composed via `compose` command
    ↓
Screens (DashboardPage, ReportsPage)  ← created via `screen create`
    ↓
Routes (/dashboard, /reports)  ← registered in screen metadata
```

## Step-by-Step

### 1. List Available Blueprints

```bash
emdesign ds blueprint list
emdesign ds blueprint list --category data,form,navigation
```

Blueprints are pre-designed composition patterns. Each lists the primitives it composes, its props, and its category.

### 2. Apply a Blueprint

```bash
emdesign ds blueprint apply <blueprint-id> <target-name>
```

Generates a component file that imports and composes the blueprint's primitives. For example:

```bash
emdesign ds blueprint apply stat-card RevenueCard
emdesign ds blueprint apply data-table TransactionsTable
```

Produces `src/generated/RevenueCard.tsx`, `src/generated/TransactionsTable.tsx`.

### 3. Compose into a View

```bash
emdesign compose <view-name> --components "RevenueCard,TransactionsTable" --layout grid
```

Generates a view component that arranges the given components in a layout:

| Layout | Behavior |
|--------|----------|
| `stack` | Vertical stack with `space-y-4` |
| `grid` | 2-column CSS grid with `gap-4` |
| `sidebar` | Fixed-width aside + flex-grow main area |

### 4. Create a Screen

```bash
emdesign screen create <name> --route <path> [--layout <layout>]
```

This is the highest level of composition. It creates:
- **`src/screens/<name>/<name>.tsx`** — screen component
- **`src/screens/<name>/<name>.stories.tsx`** — story for the screen
- **`src/screens/<name>/page.json`** — routing metadata (route, layout, creation timestamp)

Example:
```bash
emdesign screen create Dashboard --route /dashboard
```

### 5. List Screens

```bash
emdesign screen list
```

Shows all screens with their routes and layouts.

## Scaffolding Blocks

Before composing, ensure the design system has the needed primitives:

```bash
# List available building blocks
emdesign ds block list

# Scaffold specific blocks into the DS
emdesign ds scaffold <ds-id> --blocks Button,Card,Input,Select,Table,Tabs,Modal,Toast

# Filter by tags
emdesign ds block list --tags form,data,navigation
```

## Command Reference

| Command | Purpose |
|---------|---------|
| `ds blueprint list` | List all composition patterns |
| `ds blueprint apply <id> <name>` | Generate component from blueprint |
| `ds block list` | List building blocks |
| `ds scaffold <id> --blocks <list>` | Add specific primitives to DS |
| `compose <name> --components <list>` | Compose components into view |
| `screen create <name> --route <path>` | Create screen with routing |
| `screen list` | List all screens |

## Common Pitfalls

- **Build primitives first** — blueprints compose primitives. If a block doesn't exist in the DS, compose manually.
- **Screens need a layout** — `screen create` without `--layout` produces a minimal wrapper. For real apps, always specify a layout.
- **Blueprint code is starter code** — the generated component imports and renders all primitives but passes no props. After generation, edit the file to wire up props properly.
- **Don't nest screens** — each screen is a top-level route. Compose views inside a screen instead of nesting screen components.
