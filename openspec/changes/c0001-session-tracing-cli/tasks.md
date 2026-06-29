# Tasks — c0001-session-tracing-cli

## Unit 1: `log-sink.ts` — structured log persistence

- [x] Create `packages/session/src/log-sink.ts` with `createLogSink(bus, baseDir)`
- [x] Subscribe to `session:log` events, write NDJSON to `global.ndjson` and `sessions/<id>.ndjson`
- [x] Export `createLogSink` from `packages/session/src/index.ts`
- [x] Wire into HTTP bridge startup in `packages/backend/src/http.ts`

## Unit 2: CLI `session` and `logs` commands

- [x] Create `packages/cli/src/commands/session.ts` — `session list|show|logs`
- [x] Read `~/.claude/` JSONL via `@emdesign/session` `storage.ts`
- [x] Create `logs` subcommand — read `.emdesign/logs/` with level/session/time filters
- [x] Register commands in `packages/cli/src/cli.ts`

## Unit 3: CLI `intent` and `chat` commands

- [x] Create `packages/cli/src/commands/intent.ts` — `intent <type> <instruction>` via `POST /api/intent`
- [x] Implement `chat <message> --type` via `POST /api/chat/stream` with SSE streaming
- [x] Support `--wait` (blocking), `--interactive` (follow-up prompt), pipe mode
- [x] Register commands in `packages/cli/src/cli.ts`

## Unit 4: `--trace` global flag

- [ ] Parse `--trace` and `--log-level` in `packages/cli/src/cli.ts`
- [ ] When set, create `PlatformEventBus` + `log-sink.ts` for the command duration
- [ ] Integrate with `ds import awesome` and `ds customize` — create WorkflowSession, emit stages

## Unit 5: Docs / tests

- [ ] Update `docs/session-tracing.md` and `docs/cli-commands.md` if needed
- [ ] Run e2e test to verify no regressions: `node tests/e2e-import-flow.mjs`
