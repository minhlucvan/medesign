# @medesign/plugin-core

**Universal stack-agnostic design-system rules** — the always-on default ruleset that every medesign
project runs. Provides production-readiness review (`doctorRules`) and rendered-artifact lint
(`renderedDoctorRules`).

## Role in the system

`plugin-core` is injected via `composeStack` and is always active. Its rules are framework-agnostic
and cover:

- **Doctor rules:** token-contract completeness, section depth, type-scale richness, component
  specifications with states, anti-slop, primitives presence
- **Rendered artifact lint:** overlap detection, contrast checks, spacing consistency, tap-target
  sizing, type-scale adherence, overflow detection

## Related

- `@medesign/plugin-api` — the plugin interface this implements
- `@medesign/dsr` — the rule engine this extends
- `@medesign/doctor` — consumes these rules in production-readiness reports
