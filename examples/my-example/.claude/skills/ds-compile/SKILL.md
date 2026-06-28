---
name: ds-compile
description: Compile a design system's tokens into TypeScript types and a consumable npm package. Use when the design system is stable and ready for production consumption by other packages/screens.
when: After creating or customizing a design system, before building components that consume its tokens programmatically.
workflow: compile
commands: [ds compile, ds export, ds validate --strict, ds version, ds changelog]
---

# Design System Compilation Skill

## Purpose

Transform a design system's `tokens.css` into **typed, importable, versioned artifacts** that other code can consume safely. Agents importing from `@ds/Token.ColorSurface` can't invent raw hex values — the type system enforces token roles.

## Workflow

```
1. Validate  → ds validate --strict (ensure token contract is complete)
2. Compile   → ds compile → generates TypeScript + CSS
3. Export    → ds export → packages as npm-ready directory
4. Version   → ds version bump (major/minor/patch)
5. Changelog → ds changelog --snapshot (record the release)
```

## Step-by-Step

### 1. Validate — "Is the token contract complete?"

```bash
emdesign ds validate <id> --strict
```

Fails if any required token role is missing. Output shows `declared count / missing roles`.

**Before compiling:** Always run `--strict` mode. A missing role now means broken types downstream.

### 2. Compile — "Generate TypeScript types"

```bash
emdesign ds compile <id> [--out <dir>]
```

Reads `tokens.css`, parses all `--token-name: value` pairs, groups by category (color, type, spacing, size, shadow, radius, font), and generates:

- **`tokens.ts`** — typed export constants:
  ```typescript
  export const Token = { ColorSurface: '--color-surface' as const } as const;
  export type TokenKey = keyof typeof Token;
  ```
- **`types.ts`** — category-specific union types:
  ```typescript
  export const colorTokens = ['--color-surface', ...] as const;
  export type ColorToken = (typeof colorTokens)[number];
  ```

**When to use:** After every significant token change. Keep compiled types in sync with source.

### 3. Export — "Make it consumable"

```bash
emdesign ds export <id> [--out <dir>]
```

Writes `tokens.ts`, `types.ts`, `tokens.css`, and a `package.json` to the output directory (default: `design-systems/<id>/dist/`).

The package.json is a minimal npm-ready manifest:
```json
{ "name": "@design-system/<id>", "version": "0.1.0", "main": "tokens.ts" }
```

### 4. Version Bump — "Track changes"

```bash
emdesign ds version <id> <major|minor|patch>
```

Updates the `version` field in `manifest.json`. Follows semver:
- **patch** — token value fix, new optional token
- **minor** — new required token, new primitive
- **major** — breaking token rename, removed token

### 5. Changelog — "Record what changed"

```bash
emdesign ds changelog <id> --snapshot
```

Takes a snapshot of the current state and appends to version history.

## Command Reference

| Command | Purpose | Speed |
|---------|---------|-------|
| `ds validate <id> --strict` | Token contract check (strict) | ~50ms |
| `ds compile <id>` | Generate TypeScript + CSS | ~100ms |
| `ds export <id>` | Package as npm-ready directory | ~100ms |
| `ds version <id> <bump>` | Semantic version bump | ~50ms |
| `ds changelog <id>` | Show or create changelog | ~50ms |

## Common Pitfalls

- **Don't compile before the DS is stable** — premature compilation means regenerating types on every change.
- **--strict is the minimum** — always use it before compilation. Non-strict validation can pass but produce incomplete types.
- **Compiled output is disposable** — it lives in `dist/`, is gitignored, and is always regenerated from source. Never edit compiled files directly.
- **Version bump is for consumers** — bump only when other packages depend on the DS. Don't bump on every edit.
