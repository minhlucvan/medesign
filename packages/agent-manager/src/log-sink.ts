/**
 * log-sink — Structured log persistence for PlatformEventBus.
 *
 * Subscribes to `session:log` events and persists each entry as NDJSON
 * to both `.emdesign/logs/global.ndjson` and `.emdesign/logs/sessions/<sessionId>.ndjson`.
 * Write failures are caught gracefully and logged via console.warn.
 */

import { PlatformEventBus } from './hooks.js';
import path from 'node:path';
import fs from 'node:fs';

export interface LogEntry {
  timestamp: string;
  level: string;
  sessionId: string;
  workflowId: string;
  message: string;
  stream: string;
  caller: string;
}

/**
 * Create a log sink that subscribes to `session:log` events on the given bus
 * and persists each entry as NDJSON to disk.
 *
 * @param bus      The PlatformEventBus to subscribe to
 * @param baseDir  The workspace root directory; `.emdesign/logs/` is created inside it
 */
export function createLogSink(bus: PlatformEventBus, baseDir: string): void {
  const logDir = path.join(baseDir, '.emdesign', 'logs');
  const sessionsDir = path.join(logDir, 'sessions');

  // Create log directories synchronously — errors are caught and warned
  try {
    fs.mkdirSync(sessionsDir, { recursive: true });
  } catch (err: any) {
    console.warn('[log-sink] Failed to create log directories:', err.message);
  }

  bus.on('session:log', (event) => {
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
      // line is not parseable JSON — use defaults (message stays as raw line)
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      sessionId: event.sessionId,
      workflowId,
      message,
      stream: event.stream,
      caller,
    };

    const line = JSON.stringify(entry) + '\n';

    // Append to global log file
    try {
      fs.appendFileSync(path.join(logDir, 'global.ndjson'), line);
    } catch (err: any) {
      console.warn('[log-sink] Failed to write to global.ndjson:', err.message);
    }

    // Append to per-session log file
    try {
      fs.appendFileSync(path.join(sessionsDir, `${event.sessionId}.ndjson`), line);
    } catch (err: any) {
      console.warn(`[log-sink] Failed to write to ${event.sessionId}.ndjson:`, err.message);
    }
  });
}
