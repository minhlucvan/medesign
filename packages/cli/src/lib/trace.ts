/**
 * trace — CLI trace context and WorkflowSession helpers.
 *
 * Provides `createTraceContext` (PlatformEventBus + log-sink with level filtering)
 * and `withWorkflowSession` (named stages with stderr progress + event emission).
 * Used by the `--trace` / `--log-level` CLI flags.
 */

import { PlatformEventBus } from '@emdesign/agent-manager';
import path from 'node:path';
import fs from 'node:fs';

// ── Log level ordering (lowest → highest) ──────────────────────────────────

const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface TraceContext {
  bus: PlatformEventBus;
  teardown: () => void;
}

export interface TraceOptions {
  logLevel?: string;
}

export type EmitStage = (name: string, message: string) => void;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a `PlatformEventBus` and wire a log sink for the command duration.
 * When `logLevel` is set, only events at or above that level are persisted.
 *
 * @param baseDir  Workspace root directory; `.emdesign/logs/` is created inside it.
 * @param opts     Optional log level filter (default: 'info').
 */
export function createTraceContext(baseDir: string, opts?: TraceOptions): TraceContext {
  const bus = new PlatformEventBus();
  const logLevel = opts?.logLevel ?? 'info';
  const minLevel = LOG_LEVELS[logLevel] ?? LOG_LEVELS.info;

  const logDir = path.join(baseDir, '.emdesign', 'logs');
  const sessionsDir = path.join(logDir, 'sessions');

  // Create log directories — failures are caught silently
  try {
    fs.mkdirSync(sessionsDir, { recursive: true });
  } catch {
    // Directory may already exist or is unwritable — handled per-write
  }

  const unsubscribe = bus.on('session:log', (event) => {
    // Parse the line as JSON to extract metadata fields
    let level = 'info';
    let message: string = event.line;
    let workflowId = '';
    let caller = '';

    try {
      const parsed = JSON.parse(event.line);
      level = typeof parsed.level === 'string' ? parsed.level : 'info';
      message = typeof parsed.message === 'string' ? parsed.message : event.line;
      workflowId = typeof parsed.workflowId === 'string' ? parsed.workflowId : '';
      caller = typeof parsed.caller === 'string' ? parsed.caller : '';
    } catch {
      // Line is not parseable JSON — use defaults (message stays as raw line)
    }

    // Filter by minimum log level
    if ((LOG_LEVELS[level] ?? LOG_LEVELS.info) < minLevel) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      sessionId: event.sessionId,
      workflowId,
      message,
      stream: event.stream,
      caller,
    };

    const line = JSON.stringify(entry) + '\n';

    try {
      fs.appendFileSync(path.join(logDir, 'global.ndjson'), line);
    } catch {
      // Write failure — silently ignore
    }

    try {
      fs.appendFileSync(path.join(sessionsDir, `${event.sessionId}.ndjson`), line);
    } catch {
      // Write failure — silently ignore
    }
  });

  return {
    bus,
    teardown: () => {
      unsubscribe();
    },
  };
}

/**
 * Execute a callback within a simulated WorkflowSession, providing an
 * `emitStage` function that prints stage progress to stderr and emits
 * `session:log` events on the bus.
 *
 * @param bus       The PlatformEventBus to emit events on.
 * @param workflowId  Identifier for the workflow (e.g. "import-awesome").
 * @param stages      Array of stage names (e.g. ["fetch", "parse", …]).
 * @param callback    Async function receiving `emitStage`.
 */
export async function withWorkflowSession(
  bus: PlatformEventBus,
  workflowId: string,
  stages: string[],
  callback: (emitStage: EmitStage) => Promise<void>,
): Promise<void> {
  const sessionId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const emitStage: EmitStage = (name, msg) => {
    const stageMsg = `${name}: ${msg}`;
    process.stderr.write(`  ${stageMsg}\n`);

    bus.emit({
      type: 'session:log',
      sessionId,
      line: JSON.stringify({
        level: 'info',
        message: `Stage: ${name} — ${msg}`,
        workflowId,
        stream: 'stdout',
        caller: 'withWorkflowSession',
      }),
      stream: 'stdout',
    });
  };

  await callback(emitStage);
}
