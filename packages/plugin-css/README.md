# @medesign/plugin-css

The **CSS plugin** — owns CSS-to-graph parsing for medesign. Parses tokens, themes, and colors from
CSS source, emits new node types (`breakpoint`, `mediaQuery`, `cssVarGroup`, `contrastPair`), and
provides CSS-specific production-readiness doctor rules.

## Role in the system

`plugin-css` is the bridge between raw CSS and the design-system knowledge graph. It:

- Parses `tokens.css` and theme files into graph nodes and edges
- Extracts CSS custom property definitions and their values
- Detects media queries and breakpoints
- Computes contrast pairs for WCAG AA validation
- Contributes `css-theming-complete` and `css-contrast-aa` doctor rules

## Related

- `@medesign/plugin-api` — the plugin interface this implements
- `@medesign/graph` — the graph model these parsers emit into
- `@medesign/doctor` — consumes CSS doctor rules
