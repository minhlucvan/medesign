# @medesign/plugin-shadcn

The **shadcn/ui plugin** — adds component-catalog codegen guidance and lint rules for shadcn/ui
components. Stacks on `@medesign/plugin-react` + `@medesign/plugin-tailwindcss`.

## Role in the system

`plugin-shadcn` extends medesign with awareness of the shadcn/ui component library. It provides:

- Codegen guidance for shadcn/ui component patterns in agent prompts
- Lint rules that ensure shadcn/ui components are used on-system (token roles, not raw values)
- Component-catalog integration for the knowledge graph

## Related

- `@medesign/plugin-api` — the plugin interface this implements
- `@medesign/plugin-react` — the React framework adapter it extends
- `@medesign/plugin-tailwindcss` — the Tailwind styling adapter it extends
