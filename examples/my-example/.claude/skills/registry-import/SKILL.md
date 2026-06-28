---
name: registry-import
description: Discover, import, and customize design systems from remote sources — awesome-design-md (74 brands), vendor bases (13 systems), and git repositories.
when: Starting a new project that needs a foundation design system, or exploring what's available before creating one from scratch.
workflow: system-setup
commands: [ds search, ds info, ds import awesome, ds import git, ds import vendor, ds customize --brand]
---

# Registry & Import Skill

## Purpose

The emdesign CLI has a **design system registry** — like npm for design systems. You can search across 74 awesome-design-md brands, 13 vendored bases, and any git repository, then import and customize with your brand's colors and fonts.

## Registry Sources

| Source | Count | Content | Fetch Method |
|--------|-------|---------|-------------|
| Vendor (`_vendor/open-design/`) | 13 | Full DS (DESIGN.md + tokens.css + code/) | Local filesystem |
| Awesome-design-md (GitHub) | 74 | DESIGN.md only (YAML frontmatter) | GitHub raw fetch |
| Git repositories | ∞ | DESIGN.md + tokens.css + manifest | Shallow clone |
| Local (`design-systems/`) | varies | Full DS | Already installed |

## Workflow

```
1. Search   → ds search <query> to find matching systems
2. Inspect  → ds info <id> to see details
3. Import   → ds import <source> <id> to bring it in
4. Validate → ds validate <id> to check contract completeness
5. Customize → ds customize <id> --primary --font --spacing to match brand
```

## Step-by-Step

### 1. Search — "What's available?"

```bash
# List all available systems
emdesign ds search

# Search by keyword
emdesign ds search "fintech"
emdesign ds search "editorial"
emdesign ds search "modern dashboard"

# From a specific source
emdesign ds list --installed   # local only
```

Results show: id, category, source path, and token count.

### 2. Inspect — "What's in it?"

```bash
emdesign ds info <id>
```

Shows detailed information: version, category, description, token count, missing roles, primitives list, lint preset, and available blueprints.

### 3. Import — "Bring it in"

```bash
# From awesome-design-md (74 brands)
emdesign ds import awesome linear --name "MyLinear"
emdesign ds import awesome stripe --name "MyFintech"

# From a vendored base
emdesign ds import vendor brutalist --name "MyBrutalist"
emdesign ds import vendor after-hours --name "MyEditorial"

# From a git repository
emdesign ds import git https://github.com/org/ds-repo --name "CustomDS"
emdesign ds import git https://github.com/org/ds-repo --path my-ds --ref develop
```

Each import produces a complete design system from the source material. For `awesome` imports, the CLI:
1. Fetches the brand's DESIGN.md from GitHub
2. Parses YAML frontmatter to extract colors, fonts, spacing
3. Generates `tokens.css` from frontmatter values
4. Writes manifest.json with source attribution
5. Scaffolds default primitives from atelier

### 4. Validate

```bash
emdesign ds validate <id> --strict
```

After import, always validate. For awesome-design-md imports, some tokens may be missing if the frontmatter was sparse — fill them in manually.

### 5. Customize — "Make it yours"

```bash
# Quick customization
emdesign ds customize <id> --name "My Brand" --color "#6366f1" --font "Inter"

# Brand-aware customization (V3)
emdesign ds customize <id> --brand "MyApp" --primary "#7c3aed" --secondary "#0f172a"
emdesign ds customize <id> --body-font "Inter" --spacing 4
```

Customization clones the base system and applies token-level changes. The `--brand` flag exposes a richer set of customization parameters.

## Command Reference

| Command | Purpose |
|---------|---------|
| `ds search <query>` | Search across all registry sources |
| `ds info <id>` | Show detailed system info |
| `ds import awesome <brand>` | Import from awesome-design-md |
| `ds import git <url> [--path]` | Import from git repository |
| `ds import vendor <id>` | Import from vendored bases |
| `ds customize <id> --color --font` | Quick re-skin |
| `ds customize <id> --brand <name>` | Brand-aware customization |
| `ds validate <id> --strict` | Post-import validation |

## Common Pitfalls

- **awesome-design-md imports are DESIGN.md-only** — they have no `tokens.css` or `code/` directory. The CLI generates a `tokens.css` from YAML frontmatter, which may be incomplete. Always validate and fill gaps.
- **Git imports need public repos** — private repos are accessed via standard git auth (SSH keys, etc.), but the CLI doesn't handle auth prompts. Configure git credentials beforehand.
- **Customize clones** — `ds customize` creates a NEW design system (it clones the base). The original is untouched.
- **Search requires GitHub API access** — awesome-design-md results depend on GitHub raw content being reachable. If behind a firewall, use `ds list --installed` instead.
