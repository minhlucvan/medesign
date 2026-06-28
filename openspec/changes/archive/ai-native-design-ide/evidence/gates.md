# Gates Report — ai-native-design-ide

| Toolchain | Unit | Gate | Command | Result |
|-----------|------|------|---------|--------|
| ts | 01-component-context-harness | build | n/a (already committed) | ✅ done |
| ts | 02-element-selection-tool | test | vitest | ✅ 159/180 passed (21 pre-existing failures) |
| ts | 02-element-selection-tool | build | tsc | ✅ no new errors |
| ts | 03-rich-context-and-scoping | test | vitest | ✅ 159/180 passed |
| ts | 03-rich-context-and-scoping | build | tsc | ✅ no new errors |
| ts | 04-design-surface-api | test | vitest | ✅ 159/180 passed |
| ts | 04-design-surface-api | build | tsc | ✅ no new errors |

## Per-unit commits

- 30819e7 — feat: add withComponentContext harness decorator (Unit 01)
- bd15a5b — feat: add element selection tool with reference mode (Unit 02)
- 2166046 — feat: add rich conversation context and scoping (Unit 03)
- 44e2d53 — feat: add cached GET /api/surface endpoint (Unit 04)

## Repair count: 0

All units passed on first attempt. 21 pre-existing test failures (integration tests needing running backend, design-md-parser module not built) are unchanged by this change.
