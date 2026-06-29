# ADDED Requirements

## ADDED Requirements

### Requirement: `emdesign intent` — submit a design intent
The `emdesign intent` command SHALL submit a design intent to the backend via `POST /api/intent`. It SHALL write the intent to `.emdesign/state.json` in the same format used by the Storybook toolbar and CreateWizard UI. The command SHALL accept `<type>` and `<instruction>` positional arguments. Supported type values SHALL be: `create-component`, `change-request`, `create-story`, `create-view`, `create-design-system`, `update-design-system`, `edit-text`.

```
emdesign intent <type> <instruction> [--selector <css>] [--json] [--trace]
```

#### Scenario: Submit intent creates state.json entry
- **WHEN** the user runs `emdesign intent create-component "Add a button" --selector ".hero"`
- **THEN** a POST request is sent to `/api/intent` with body containing type `create-component`, instruction `"Add a button"`, and selector `".hero"`
- **THEN** the response contains a `changeRequestId`
- **THEN** `.emdesign/state.json` contains the entry with status `pending`

#### Scenario: Intent with unknown type returns error
- **WHEN** the user runs `emdesign intent invalid-type "Do something"`
- **THEN** the command exits with a non-zero exit code
- **THEN** an error message is printed to stderr listing supported types

#### Scenario: Intent when backend is unreachable
- **WHEN** the user runs `emdesign intent create-component "Add a button"` and the backend is not running
- **THEN** the command prints an error to stderr such as "Error: backend not reachable at http://localhost:4321"
- **THEN** the command exits with a non-zero exit code
- **THEN** no entry is written to `.emdesign/state.json`

### Requirement: `emdesign chat` — agent chat session
The `emdesign chat` command SHALL connect to the `POST /api/chat/stream` SSE endpoint and stream agent responses to stdout. The command SHALL accept a `<message>` positional argument and a `--type` flag specifying the intent type. Without `--wait`, the command SHALL print each SSE event to stdout as it arrives and exit immediately when the stream ends. When `--wait` is set, the command SHALL block until the SSE stream completes, printing each event to stdout as it arrives. When `--interactive` is set, the command SHALL prompt for a follow-up message after the initial response is complete.

```
emdesign chat <message> --type <intent-type> [--wait] [--interactive] [--trace]
```

#### Scenario: Chat streams events to stdout
- **WHEN** the user runs `emdesign chat "Create a hero card" --type create-component`
- **THEN** a POST request is sent to `/api/chat/stream` with body containing `{ message: "Create a hero card", type: "create-component" }`
- **THEN** SSE events are printed to stdout as they arrive
- **THEN** the command exits when the SSE stream ends

#### Scenario: Chat --wait blocks until stream completes
- **WHEN** the user runs `emdesign chat "Create a hero card" --type create-component --wait`
- **THEN** a POST request is sent to `/api/chat/stream`
- **THEN** the command blocks until the SSE stream ends
- **THEN** each SSE event is printed to stdout as it arrives
- **THEN** the command exits with exit code 0

#### Scenario: Chat --interactive prompts for follow-up
- **WHEN** the user runs `emdesign chat "Create a hero card" --type create-component --interactive`
- **THEN** after the initial SSE stream completes, the user is prompted for a follow-up message
- **THEN** the follow-up message is sent as a new SSE request

#### Scenario: Chat when backend is unreachable
- **WHEN** the user runs `emdesign chat "Create a hero card" --type create-component` and the backend is not running
- **THEN** the command prints an error to stderr such as "Error: backend not reachable at http://localhost:4321"
- **THEN** the command exits with a non-zero exit code

#### Scenario: Chat when SSE stream drops mid-response
- **WHEN** the SSE connection drops before the stream ends
- **THEN** the command prints an error to stderr
- **THEN** the command exits with a non-zero exit code

### Requirement: `emdesign session` — inspect Claude sessions
The `emdesign session` command SHALL read Claude's `~/.claude/` JSONL session storage via the `@emdesign/session` package. The `list` subcommand SHALL display sessions with optional `--limit N`, `--project <path>`, and `--failed` filters. The `show <id>` subcommand SHALL display the full details of a single session. The `logs <id>` subcommand SHALL display logs for a session with optional `--tail` (follow mode) and `--format text|json` flags.

```
emdesign session list [--limit N] [--project <path>] [--failed]
emdesign session show <id>
emdesign session logs <id> [--tail] [--format text|json]
```

#### Scenario: Session list shows sessions
- **WHEN** the user runs `emdesign session list --limit 5`
- **THEN** the command reads `~/.claude/` JSONL files via `@emdesign/session`
- **THEN** the command prints up to 5 sessions to stdout in a formatted table

#### Scenario: Session show with non-existent ID returns error
- **WHEN** the user runs `emdesign session show non-existent-id`
- **THEN** the command prints an error to stderr such as "Error: session not found"
- **THEN** the command exits with a non-zero exit code

#### Scenario: Session logs --tail with empty session log
- **WHEN** the user runs `emdesign session logs some-id --tail` and the session has no log entries
- **THEN** the command prints nothing (or an empty output) and waits for new entries
- **THEN** the command does not crash

### Requirement: `emdesign logs` — query trace logs
The `emdesign logs` command SHALL read structured logs from `.emdesign/logs/`. It SHALL support filtering by `--level` (debug|info|warn|error), `--session <id>`, `--since <iso>`, and `--until <iso>` timestamps. The `--follow` flag SHALL tail new entries as they arrive. The `--format json` flag SHALL output raw NDJSON rather than formatted text.

```
emdesign logs [--level debug|info|warn|error] [--session <id>]
              [--since <iso>] [--until <iso>] [--follow] [--format json]
```

#### Scenario: Logs filtered by level
- **WHEN** the user runs `emdesign logs --level error`
- **THEN** only entries with level `error` from `.emdesign/logs/` are printed
- **THEN** entries with level `info` or `warn` are excluded

#### Scenario: Logs --level with invalid value
- **WHEN** the user runs `emdesign logs --level invalid`
- **THEN** the command prints an error to stderr listing valid level values (debug, info, warn, error)
- **THEN** the command exits with a non-zero exit code

#### Scenario: Logs when .emdesign/logs/ does not exist
- **WHEN** the user runs `emdesign logs` and `.emdesign/logs/` does not exist
- **THEN** the command prints a message such as "No logs found"
- **THEN** the command exits with exit code 0 (no error — just no data)

### Requirement: `--trace` global flag
The `--trace` flag SHALL be composable with all CLI commands. When `--trace` is set, the command SHALL create a `PlatformEventBus` for the command duration and wire `log-sink.ts` to persist `session:log` events. The `PlatformEventBus` creation and log-sink wiring SHALL be independent of any Claude session creation — they are both enabled by `--trace` but are not coupled. When `--trace` is combined with `ds import awesome` or `ds customize`, the command SHALL additionally wrap the operation in a `WorkflowSession` with named stages and print progress to stderr.

#### Scenario: --trace enables event bus and log sink
- **WHEN** the user runs `emdesign intent create-component "Button" --trace`
- **THEN** a `PlatformEventBus` is created for the command duration
- **THEN** `log-sink.ts` is wired as a subscriber to persist `session:log` events
- **THEN** entries are written to `.emdesign/logs/global.ndjson`

#### Scenario: --trace with ds import creates WorkflowSession
- **WHEN** the user runs `emdesign ds import awesome --trace`
- **THEN** a `WorkflowSession` is created with named stages
- **THEN** progress is printed to stderr as each stage completes
- **THEN** log entries are persisted via `log-sink.ts`

### Requirement: Error resilience for HTTP commands
All commands that make HTTP requests (`intent`, `chat`) SHALL handle backend errors gracefully. Network errors, HTTP errors (4xx, 5xx), and connection refused errors SHALL produce a user-visible error message on stderr and a non-zero exit code. No unhandled exception SHALL propagate.

#### Scenario: Backend unreachable on intent
- **WHEN** the backend is not running and the user runs `emdesign intent create-component "Button"`
- **THEN** the error is caught and a message is printed to stderr
- **THEN** the command exits with a non-zero exit code

#### Scenario: Backend unreachable on chat
- **WHEN** the backend is not running and the user runs `emdesign chat "Hello" --type change-request`
- **THEN** the error is caught and a message is printed to stderr
- **THEN** the command exits with a non-zero exit code

### Requirement: Session and logs commands work without a backend
The `session` and `logs` commands SHALL operate without a running backend by reading local files directly using the `@emdesign/session` package. If `.emdesign/logs/` does not exist for `logs`, or the session file is not found for `session show`, the command SHALL print an appropriate message and exit with exit code 0 for missing data (not an error).

#### Scenario: Session show when file missing
- **WHEN** the user runs `emdesign session show non-existent` and the session file does not exist in `~/.claude/`
- **THEN** the command prints "Session not found" to stdout
- **THEN** the command exits with exit code 0
