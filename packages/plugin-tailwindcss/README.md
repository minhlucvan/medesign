# @medesign/plugin-tailwindcss

The **Tailwind CSS plugin** — the styling adapter that maps Tailwind CSS classes to design-system
token roles, parses `tailwind.config.js` into the knowledge graph, handles theming, and emits
Tailwind config from the token contract.

## Role in the system

`plugin-tailwindcss` is medesign's styling-layer `FrameworkAdapter`. It:

- Maps semantic Tailwind classes (`bg-surface`, `text-accent`, `rounded`) to token roles
- Parses `tailwind.config.js` theme extensions into graph nodes
- Generates Tailwind config that binds the active design system's CSS custom properties
- Contributes `tailwind-token-binding` doctor rule (primitives bind to token roles)

## Related

- `@medesign/plugin-api` — the plugin interface this implements
- `@medesign/plugin-react` — typically stacks with React for component generation
- `@medesign/plugin-shadcn` — stacks on Tailwind for component-catalog guidance
