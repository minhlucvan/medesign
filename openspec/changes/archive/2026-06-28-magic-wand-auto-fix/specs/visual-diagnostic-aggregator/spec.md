## ADDED Requirements

### Requirement: Unified issue collection from multiple diagnostic sources

The visual diagnostic aggregator SHALL collect outputs from all diagnostic probes (render analyze, spatial audit, a11y audit, doctor lint, optional vision) and merge them into a single, deduplicated, priority-ordered issue list.

Each issue SHALL have the following shape:

```typescript
interface DiagnosticIssue {
  id: string                        // stable hash of (source + file + line + type)
  source: 'render' | 'spatial' | 'a11y' | 'lint' | 'vision'
  priority: 'P0' | 'P1' | 'P2'     // severity
  type: 'contrast' | 'spacing' | 'alignment' | 'token' | 'grid' | 'overlap' | 'polish' | 'a11y'
  message: string                   // human-readable description
  file: string                      // source file path
  line: number                      // approximate line number
  fixable: boolean                  // whether the fix engine can auto-fix this
  fixCandidate?: FixCandidate       // the proposed fix (if fixable)
}
```

#### Scenario: Aggregator receives probes and produces merged list
- **WHEN** render analyze, spatial audit, a11y, doctor lint all complete
- **THEN** the aggregator SHALL parse each probe's JSON output
- **AND** extract relevant issues with priority, type, and location
- **AND** deduplicate by `(source + file + line + type)` hash
- **AND** sort by priority (P0 first, then P1, then P2)
- **AND** return the merged list sorted by priority then by type

#### Scenario: Vision findings merge at correct priority
- **WHEN** vision critique results are available
- **THEN** vision findings SHALL be merged into the same list at their declared priority level
- **AND** vision findings with `fixable: true` SHALL include a `fixCandidate` with the proposed change

### Requirement: Priority assignment rules

The aggregator SHALL assign priorities deterministically based on issue type and severity:

| Priority | Types | Examples |
|----------|-------|---------|
| **P0** | contrast, a11y-critical, spacing (gaps > 200% of intended) | Color contrast ratio < 3:1, elements overlapped by > 5px, missing focus indicator |
| **P1** | alignment, grid, token, spacing (minor), a11y-serious | Off-grid by 2-4px, raw hex value where token exists, missing aria-label |
| **P2** | polish, a11y-moderate, spacing (cosmetic) | Slightly inconsistent border-radius, font-size off by 1px, unnecessary wrapper |

#### Scenario: Contrast violations are P0
- **WHEN** the aggregator receives a contrast violation (e.g., `color: #999 on background: #fff` with ratio < 3:1)
- **THEN** it SHALL assign priority P0
- **AND** set `fixable: true`
- **AND** include a fix candidate with the nearest accessible color token

#### Scenario: Grid alignment violations are P1
- **WHEN** the aggregator receives a grid alignment violation (element off-grid by 2px)
- **THEN** it SHALL assign priority P1
- **AND** set `fixable: true`
- **AND** include a fix candidate with the corrected margin/padding value

#### Scenario: Overlapping elements are P0
- **WHEN** spatial audit reports an overlap of > 5px between two elements
- **THEN** it SHALL assign priority P0
- **AND** set `fixable: false` (overlaps often require structural changes beyond simple value fix)

### Requirement: Fix candidate generation rules

For each `fixable: true` issue, the aggregator SHALL generate a `FixCandidate`:

```typescript
interface FixCandidate {
  type: string              // type of fix
  file: string              // source file
  line: number              // line number
  oldValue: string          // the current (problematic) value
  newValue: string          // the replacement value
  editType: 'replace' | 'insert' | 'delete'
  confidence: number        // 0-1 confidence score
}
```

The aggregator SHALL generate fix candidates using these strategies:
- **token binding**: look up the raw value in the design system's token map → replace with the semantic token CSS variable
- **spacing**: round the current value to the nearest design system spacing unit
- **contrast**: find the nearest accessible color token (WCAG AA 4.5:1) from the DS palette
- **alignment**: adjust margin/padding to snap to the grid
- **polish**: normalize border-radius, font-size to the DS type scale

#### Scenario: Token binding fix candidate
- **WHEN** a lint finding reports raw color `#3b82f6` used where a token exists
- **THEN** the aggregator SHALL query the DS token map
- **AND** if `--color-primary` maps to `#3b82f6`, generate candidate `{ oldValue: "#3b82f6", newValue: "var(--color-primary)", editType: "replace", confidence: 0.95 }`

#### Scenario: Spacing fix candidate snaps to grid
- **WHEN** a spatial issue reports `padding: 13px` on a 4px grid
- **THEN** the aggregator SHALL round to the nearest grid unit: `padding: 12px`
- **AND** generate candidate with `confidence: 0.85`
