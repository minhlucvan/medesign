# Plank — emdesign Blank Project

> Scaffolded by `emdesign init react-tailwind` — a blank, ready-to-go workspace.

This is what a freshly initialized emdesign project looks like. No custom
design system has been created yet, and no components have been generated.

## What's here

```
├── .claude/              # Agent commands, skills, workflows (the /mds system)
├── .storybook/           # Storybook config (main.ts, preview.tsx)
├── design-systems/
│   └── atelier/          # Starter design system (seeded by init)
├── src/
│   ├── generated/        # Agent writes here (empty until you run /mds:craft:component)
│   ├── components/       # Captured components (empty until you run /mds:ship)
│   ├── active-design-system.css
│   └── index.css
├── CLAUDE.md             # Agent workspace instructions
├── emdesign.config.json  # Project config
├── package.json
├── tailwind.config.js
└── postcss.config.js
```

## Next steps

```bash
npm i                    # Install dependencies
npx storybook dev -p 6006  # Start Storybook
npx tsx path/to/cli.ts serve  # Start emdesign backend
# In Claude Code: /mds:craft:component "a hero section"
```
