# ADDED Requirements

## ADDED Requirements

### Requirement: `log-sink.ts` persists session:log events to disk
The implementation MUST create a new file at `packages/session/src/log-sink.ts` that subscribes to `PlatformEventBus` `session:log` events and persists them to disk as NDJSON. Every `session:log` event SHALL produce two writes: one to `.emdesign/logs/global.ndjson` (all entries from all sessions) and one to `.emdesign/logs/sessions/<sessionId>.ndjson` (per-session filtered view).

```
bus.on('session:log', (event) => {
  appendLog('__global__', entry);
  appendLog(event.sessionId, entry);
});
```

#### Scenario: Log event is persisted to both global and session files
- **WHEN** a `session:log` event is emitted with `{ sessionId: "em_ses_1234", level: "info", message: "Stage: fetch — done", workflowId: "import-abc" }`
- **THEN** an NDJSON entry is appended to `.emdesign/logs/global.ndjson`
- **THEN** an NDJSON entry is appended to `.emdesign/logs/sessions/em_ses_1234.ndjson`
- **THEN** both entries contain the same `sessionId`, `level`, `message`, and `workflowId` fields

### Requirement: Log entry format
Each log entry SHALL be a single JSON object on one line (NDJSON format) with the following fields: `timestamp` (ISO 8601 string), `level` (one of debug|info|warn|error), `sessionId` (string), `workflowId` (string), `message` (string), `stream` (string, e.g. "stdout"), and `caller` (string naming the source function).

```json
{
  "timestamp": "2026-06-29T22:30:00.000Z",
  "level": "info",
  "sessionId": "em_ses_1234",
  "workflowId": "import-abc",
  "message": "Stage: fetch — done",
  "stream": "stdout",
  "caller": "importAwesomeDesign"
}
```

#### Scenario: Log entry matches NDJSON format
- **WHEN** a `session:log` event is emitted with level `info`, sessionId `em_ses_1234`, workflowId `import-abc`, message `"Stage: fetch — done"`, stream `"stdout"`, caller `"importAwesomeDesign"`
- **THEN** the written line is valid NDJSON parseable as a single JSON object
- **THEN** the parsed object has `timestamp` matching ISO 8601 format
- **THEN** the parsed object has `level` equal to `"info"`
- **THEN** the parsed object has `sessionId` equal to `"em_ses_1234"`
- **THEN** the parsed object has `workflowId` equal to `"import-abc"`
- **THEN** the parsed object has `stream` equal to `"stdout"`
- **THEN** the parsed object has `caller` equal to `"importAwesomeDesign"`

### Requirement: `createLogSink` export
The `log-sink.ts` module SHALL export a `createLogSink(bus, baseDir)` function. The `createLogSink` function SHALL be exported from `@emdesign/session` via `packages/session/src/index.ts`. It SHALL be wired into the HTTP bridge startup in `packages/backend/src/http.ts` alongside the existing `attachWebSocket` call.

#### Scenario: createLogSink is exported from @emdesign/session
- **WHEN** another module imports `createLogSink` from `@emdesign/session`
- **THEN** the import resolves to the exported function from `packages/session/src/log-sink.ts`

#### Scenario: log-sink is wired into HTTP bridge startup
- **WHEN** the HTTP bridge starts up in `packages/backend/src/http.ts`
- **THEN** `createLogSink` is called with the shared `PlatformEventBus` instance and the `.emdesign/logs/` base directory
- **THEN** all `session:log` events emitted during the server's lifetime are persisted to disk

### Requirement: Log sink does not throw on write failure
The log sink SHALL handle write failures gracefully. If the `.emdesign/logs/` directory cannot be created, or a write to a log file fails (e.g. disk full, permission denied), the log sink SHALL catch the error and emit a warning. It SHALL NOT crash the host process.

#### Scenario: Log directory write failure is caught
- **WHEN** a `session:log` event is emitted but the `.emdesign/logs/` directory is not writable
- **THEN** the error is caught by the log sink
- **THEN** a warning is emitted (e.g. via `console.warn`)
- **THEN** the host process continues running
