/**
 * Log-sink — unit tests.
 *
 * These tests verify the log persistence contract from specs/logging.md:
 * - Every session:log event persists to both global.ndjson and sessions/<id>.ndjson
 * - Each entry is valid NDJSON with the required fields
 * - Write failures are caught gracefully (no crash)
 * - createLogSink is exported from @emdesign/session
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PlatformEventBus } from '../hooks.js';
import { createLogSink } from '../log-sink.js';

describe('createLogSink', () => {
  let bus: PlatformEventBus;
  let baseDir: string;
  let logDir: string;
  let sessionsDir: string;

  beforeEach(() => {
    bus = new PlatformEventBus();
    baseDir = mkdtempSync(join(tmpdir(), 'log-sink-test-'));
    logDir = join(baseDir, '.emdesign', 'logs');
    sessionsDir = join(logDir, 'sessions');
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('persists log event to both global and session files', () => {
    createLogSink(bus, baseDir);

    bus.emit({
      type: 'session:log',
      sessionId: 'em_ses_1234',
      line: JSON.stringify({
        level: 'info',
        message: 'Stage: fetch — done',
        workflowId: 'import-abc',
        stream: 'stdout',
        caller: 'importAwesomeDesign',
      }),
      stream: 'stdout',
    });

    // Allow async file writes to settle
    expect(existsSync(join(logDir, 'global.ndjson'))).toBe(true);
    expect(existsSync(join(sessionsDir, 'em_ses_1234.ndjson'))).toBe(true);

    const globalLines = readFileSync(join(logDir, 'global.ndjson'), 'utf-8')
      .trim()
      .split('\n')
      .filter(Boolean);
    const sessionLines = readFileSync(join(sessionsDir, 'em_ses_1234.ndjson'), 'utf-8')
      .trim()
      .split('\n')
      .filter(Boolean);

    expect(globalLines.length).toBeGreaterThanOrEqual(1);
    expect(sessionLines.length).toBeGreaterThanOrEqual(1);

    const globalEntry = JSON.parse(globalLines[0]);
    const sessionEntry = JSON.parse(sessionLines[0]);

    expect(globalEntry.sessionId).toBe('em_ses_1234');
    expect(globalEntry.level).toBe('info');
    expect(globalEntry.message).toBe('Stage: fetch — done');
    expect(globalEntry.workflowId).toBe('import-abc');

    expect(sessionEntry.sessionId).toBe('em_ses_1234');
    expect(sessionEntry.level).toBe('info');
    expect(sessionEntry.message).toBe('Stage: fetch — done');
    expect(sessionEntry.workflowId).toBe('import-abc');

    // Both entries are equal aside from timestamp
    expect(sessionEntry.sessionId).toBe(globalEntry.sessionId);
    expect(sessionEntry.level).toBe(globalEntry.level);
    expect(sessionEntry.message).toBe(globalEntry.message);
    expect(sessionEntry.workflowId).toBe(globalEntry.workflowId);
  });

  it('writes log entry matching NDJSON format with all required fields', () => {
    createLogSink(bus, baseDir);

    bus.emit({
      type: 'session:log',
      sessionId: 'em_ses_1234',
      line: JSON.stringify({
        level: 'info',
        message: 'Stage: fetch — done',
        workflowId: 'import-abc',
        stream: 'stdout',
        caller: 'importAwesomeDesign',
      }),
      stream: 'stdout',
    });

    const globalPath = join(logDir, 'global.ndjson');
    expect(existsSync(globalPath)).toBe(true);

    const raw = readFileSync(globalPath, 'utf-8').trim();
    const lines = raw.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(1);

    // Each line MUST be valid JSON parseable as a single object
    const entry = JSON.parse(lines[0]);

    // REQUIRED fields per spec
    expect(entry).toHaveProperty('timestamp');
    expect(typeof entry.timestamp).toBe('string');
    expect(entry.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO 8601 prefix
    );

    expect(entry.level).toBe('info');
    expect(entry.sessionId).toBe('em_ses_1234');
    expect(entry.workflowId).toBe('import-abc');
    expect(entry.message).toBe('Stage: fetch — done');
    expect(entry.stream).toBe('stdout');
    expect(entry.caller).toBe('importAwesomeDesign');
  });

  it('catches write failures gracefully without crashing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Use a non-writable path: /dev/null/ on macOS is not a directory,
    // so mkdir will throw. Also try a readonly mount.
    createLogSink(bus, '/dev/null/not-writable');

    expect(() => {
      bus.emit({
        type: 'session:log',
        sessionId: 'em_ses_crash_test',
        line: JSON.stringify({ level: 'info', message: 'should not crash', workflowId: 'test', stream: 'stdout', caller: 'test' }),
        stream: 'stdout',
      });
    }).not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
  });

  it('defaults level to info when line is not parseable JSON', () => {
    createLogSink(bus, baseDir);

    // Emit with garbage line that can't be parsed
    bus.emit({
      type: 'session:log',
      sessionId: 'em_ses_unparseable',
      line: 'not-json-at-all',
      stream: 'stdout',
    });

    const globalPath = join(logDir, 'global.ndjson');
    expect(existsSync(globalPath)).toBe(true);

    const raw = readFileSync(globalPath, 'utf-8').trim();
    const lines = raw.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(1);

    const entry = JSON.parse(lines[0]);
    // level should default to "info" when the line is not parseable
    expect(entry.level).toBe('info');
    expect(entry.sessionId).toBe('em_ses_unparseable');
    expect(entry.message).toBe('not-json-at-all');
  });
});

describe('createLogSink export', () => {
  it('is exported from @emdesign/session (or the source module)', async () => {
    // Dynamic import — will resolve once log-sink.ts exists
    // For the Red step this will fail with MODULE_NOT_FOUND
    const mod = await import('../log-sink.js');
    expect(typeof mod.createLogSink).toBe('function');
  });
});
