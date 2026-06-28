## ADDED Requirements

### Requirement: Targeted source file editing from fix candidates

The fix application engine SHALL receive a list of `FixCandidate` objects and apply them to the component's source file(s). Each edit SHALL be:

- **Targeted**: modifies only the specified line/region, not the whole file
- **Surgical**: uses regex or AST-aware matching to find the exact `oldValue` on the specified line
- **Revertible**: every edit is recorded in the session journal before being applied

#### Scenario: Single fix candidate applied
- **WHEN** the engine receives one `FixCandidate` with `file`, `line`, `oldValue`, `newValue`, `editType: "replace"`
- **THEN** it SHALL read the file
- **AND** locate `oldValue` on the specified line
- **AND** if found, replace it with `newValue`
- **AND** record the edit in the session journal
- **AND** write the file
- **AND** return `{ applied: true, file, line }`

#### Scenario: Multiple fix candidates applied in batch
- **WHEN** the engine receives 5 fix candidates for the same file
- **THEN** it SHALL apply each one in order (sorted by line, descending — bottom-up to preserve line numbers)
- **AND** record each edit in the session journal
- **AND** write the file once after all edits are applied
- **AND** return a batch result with per-edit status

#### Scenario: Fix candidate location not found
- **WHEN** the engine cannot find `oldValue` on the specified line
- **THEN** it SHALL try a fuzzy match (whitespace-normalized, quote-style tolerant)
- **AND** if fuzzy match succeeds, apply the edit and record with a `fuzzy: true` flag
- **AND** if fuzzy match also fails, record `{ applied: false, reason: "location_not_found" }` in the session journal
- **AND** continue with remaining edit candidates

### Requirement: Session journal

The fix engine SHALL maintain a session journal — a JSON file at a deterministic temp path (`/tmp/emdesign-wand-<sessionId>.json`). The journal SHALL record:

```typescript
interface SessionJournal {
  sessionId: string
  componentName: string
  timestamp: string                    // ISO 8601
  status: 'active' | 'rolled_back' | 'committed'
  edits: JournalEdit[]
  preFixScores: { composite: number, mustFix: number, tokens: number, visual: number }
  postFixScores?: { composite: number, mustFix: number, tokens: number, visual: number }
  gateResult?: 'pass' | 'rollback' | 'fail'
}

interface JournalEdit {
  file: string
  line: number
  oldText: string
  newText: string
  reason: string                       // what issue this fix addresses
  applied: boolean
  fuzzy: boolean                       // true if fuzzy-matched
  rolledBack: boolean                  // true if this edit was reverted
}
```

#### Scenario: Session journal created on fix start
- **WHEN** the fix engine begins applying edits
- **THEN** it SHALL create a new journal file at `/tmp/emdesign-wand-<sessionId>.json`
- **AND** record the pre-fix scores, component name, and timestamp
- **AND** set status to `active`

#### Scenario: Each edit recorded in journal
- **WHEN** each fix candidate is processed (success or failure)
- **THEN** a `JournalEdit` entry SHALL be appended to the journal
- **AND** the journal file SHALL be flushed to disk after each entry

### Requirement: Full rollback via journal replay

The engine SHALL support reverting all edits from a session by replaying the journal in reverse order. For each edit:

1. Read the file
2. Locate `newText` on the specified line
3. Replace with `oldText`
4. Mark the edit `rolledBack: true` in the journal
5. After all edits are reverted, set journal `status: "rolled_back"`

#### Scenario: Full rollback reverts all edits
- **WHEN** rollback is requested (either by gate failure or user action)
- **THEN** the engine SHALL read the session journal
- **AND** iterate edits in reverse order (last edit first)
- **AND** for each edit where `applied: true`, revert it
- **AND** mark each reverted edit as `rolledBack: true`
- **AND** set journal `status: "rolled_back"`
- **AND** write the final journal state

#### Scenario: Rollback is idempotent
- **WHEN** rollback is called twice on the same journal
- **THEN** the second call SHALL be a no-op (all edits already have `rolledBack: true`)
- **AND** return the existing journal as-is

### Requirement: Fix type constraints

The fix engine SHALL only auto-fix the following issue types. Any issue outside this list SHALL be reported as `fixable: false` and passed to `needsHuman`:

| Fix Type | What it changes | Example |
|----------|----------------|---------|
| `token-binding` | Replace raw CSS value with semantic token | `#3b82f6` → `var(--color-primary)` |
| `spacing` | Adjust padding/margin to nearest DS unit | `padding: 13px` → `padding: 12px` |
| `contrast` | Replace text/background color with accessible alternative | `color: #999` → `color: var(--color-text-secondary)` |
| `grid-alignment` | Snap margin/padding to grid | `margin-left: 17px` → `margin-left: 16px` |
| `border-radius` | Normalize to DS token | `border-radius: 5px` → `border-radius: var(--radius-md)` |
| `font-size` | Snap to DS type scale | `font-size: 15px` → `font-size: var(--text-sm)` |

#### Scenario: Unsupported fix type goes to needsHuman
- **WHEN** the aggregator produces an issue of type `overlap` (not in the auto-fix table)
- **THEN** the fix engine SHALL mark it as `fixable: false`
- **AND** include it in the `needsHuman` result field
- **AND** NOT attempt any edit for it

#### Scenario: Fix of same type applied to same line twice
- **WHEN** two fix candidates target the same file:line (e.g., both spacing and alignment agree)
- **THEN** the engine SHALL apply them in sequence (first one changes the value, second one changes the new value)
- **AND** record two separate journal entries
- **AND** on rollback, both edits are reverted in reverse order
