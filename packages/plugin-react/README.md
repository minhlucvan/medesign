# @medesign/plugin-react

The **React renderer plugin** — the framework adapter that teaches medesign how to generate, lint,
and parse React components with TypeScript and CSF stories.

## Role in the system

`plugin-react` is one of medesign's `FrameworkAdapter` implementations. It:

- Generates `.tsx` component code from design intents
- Generates CSF (Component Story Format) `.stories.tsx` files for Storybook
- Provides React-specific consistency lint rules (JSX structure, hook patterns)
- Code-parses `.tsx` files into the knowledge graph via `ts-morph`

## Usage

React is the default and most mature framework adapter. Generated components land as `.tsx` files
with associated `.stories.tsx` stories.

## Related

- `@medesign/plugin-api` — the plugin interface this implements
- `@medesign/plugin-tailwindcss` — typically stacks with React for styling
- `@medesign/plugin-shadcn` — stacks on React + Tailwind for component-catalog guidance
- `docs/workspace.md` — FrameworkAdapter documentation
