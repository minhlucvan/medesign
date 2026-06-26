# @medesign/plugin-api

The **medesign plugin contract** — the `MedesignPlugin` interface and hook types that framework,
styling, and library plugins implement.

## Role in the system

`plugin-api` is a leaf dependency consumed by the backend and every `@medesign/plugin-*`. It defines
the capability-typed interface for:

- **`codegenInstructions(ds)`** — stack-specific generation rules for the agent prompt
- **`lint(source, opts)`** — framework-specific consistency rules
- **`storyTemplate(name)`** — renderer-specific CSF story template
- **`graphParsers()`** — parsers that emit nodes/edges during graph build
- **`doctorRules()`** — production-readiness review rules
- **`renderedDoctorRules()`** — rendered-artifact lint rules (overlap, contrast, etc.)

## Related

- `@medesign/plugin-core` — always-on universal rules
- `@medesign/plugin-react` — React renderer plugin
- `@medesign/plugin-css` — CSS parsing and rules
- `@medesign/plugin-tailwindcss` — Tailwind CSS plugin
- `@medesign/plugin-shadcn` — shadcn/ui plugin
