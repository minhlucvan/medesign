/**
 * CLI trace flag integration — RED step tests.
 *
 * Tests for the `--trace` global flag: PlatformEventBus creation, log-sink wiring,
 * WorkflowSession integration for ds commands, log-level filtering.
 *
 * These tests import from ../lib/trace.js which does NOT exist yet — they will
 * FAIL on RED (expected). On GREEN trace.ts is created and the assertions run.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PlatformEventBus } from '@emdesign/agent-manager';

// ── Fixtures ─────────────────────────────────────────────────────────────

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'cli-trace-test-'));
}

// ── Scenario 1: --trace enables event bus and log sink ────────────────────

describe('--trace enables event bus and log sink', () => {
  it('creates a PlatformEventBus and wires log-sink to persist entries to .emdesign/logs/global.ndjson', async () => {
    // RED: ../lib/trace.ts does not exist yet — this dynamic import will fail
    const { createTraceContext } = await import('../lib/trace.js');

    const baseDir = tempDir();
    try {
      const ctx = createTraceContext(baseDir);

      // Assert a PlatformEventBus instance is created
      expect(ctx.bus).toBeInstanceOf(PlatformEventBus);
      expect(typeof ctx.teardown).toBe('function');

      // Emit a session:log event
      ctx.bus.emit({
        type: 'session:log',
        sessionId: 'cli_test_trace',
        line: JSON.stringify({
          level: 'info',
          message: 'test log entry from --trace',
          workflowId: 'trace-test',
          stream: 'stdout',
          caller: 'createTraceContext',
        }),
        stream: 'stdout',
      });

      // Assert .emdesign/logs/global.ndjson exists and has entries
      const logFile = join(baseDir, '.emdesign', 'logs', 'global.ndjson');
      expect(existsSync(logFile)).toBe(true);

      const content = readFileSync(logFile, 'utf-8').trim();
      const lines = content.split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThanOrEqual(1);

      const entry = JSON.parse(lines[0]);
      expect(entry.sessionId).toBe('cli_test_trace');
      expect(entry.level).toBe('info');
      expect(entry.message).toBe('test log entry from --trace');
      expect(entry.workflowId).toBe('trace-test');
      expect(entry.stream).toBe('stdout');
      expect(entry.caller).toBe('createTraceContext');
      expect(entry.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    } finally {
      rmSync(baseDir, { recursive: true, force: true });
    }
  });
});

// ── Scenario 2: --trace with ds import creates WorkflowSession ────────────

describe('--trace with ds import creates WorkflowSession', () => {
  it('creates a WorkflowSession with named stages and prints progress to stderr', async () => {
    // RED: ../lib/trace.ts does not exist yet — this dynamic import will fail
    const { createTraceContext, withWorkflowSession } = await import('../lib/trace.js');

    const baseDir = tempDir();
    try {
      const ctx = createTraceContext(baseDir);
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true as any);

      // Mock the import function to verify it's called within the workflow
      const importer = vi.fn().mockResolvedValue({ ok: true, note: 'imported' });

      // Simulate the ds import awesome workflow with named stages
      const stages = ['fetch', 'parse', 'apply', 'compile'];
      await withWorkflowSession(ctx.bus, 'import-awesome', stages, async (emitStage) => {
        emitStage('fetch', 'Fetching design system from awesome registry...');
        await importer();
        emitStage('parse', 'Parsing design tokens...');
        emitStage('apply', 'Applying token overrides...');
        emitStage('compile', 'Compiling output...');
      });

      // Assert progress was printed to stderr as each stage completes
      expect(stderrSpy).toHaveBeenCalled();
      const allStderr = stderrSpy.mock.calls.map(c => String(c[0])).join('');
      expect(allStderr).toContain('fetch');
      expect(allStderr).toContain('parse');
      expect(allStderr).toContain('apply');
      expect(allStderr).toContain('compile');

      // Assert log entries were persisted via log-sink
      const logFile = join(baseDir, '.emdesign', 'logs', 'global.ndjson');
      expect(existsSync(logFile)).toBe(true);
      const logContent = readFileSync(logFile, 'utf-8');
      expect(logContent).toContain('fetch');
      expect(logContent).toContain('compile');

      // Assert the import function was actually called
      expect(importer).toHaveBeenCalledOnce();

      stderrSpy.mockRestore();
    } finally {
      rmSync(baseDir, { recursive: true, force: true });
    }
  });
});

// ── Scenario 3: --trace does not break commands without HTTP ──────────────

describe('--trace does not break commands without HTTP', () => {
  it('allows local-only commands to run successfully with --trace (no backend dependency)', async () => {
    // RED: ../lib/trace.ts does not exist yet — this dynamic import will fail
    const { createTraceContext } = await import('../lib/trace.js');

    const baseDir = tempDir();
    try {
      // Create trace context — this should work without any backend running
      const ctx = createTraceContext(baseDir);

      expect(ctx.bus).toBeInstanceOf(PlatformEventBus);

      // Emit events that a local-only command (e.g. session list) would produce
      ctx.bus.emit({
        type: 'session:log',
        sessionId: 'cli_local_cmd',
        line: JSON.stringify({
          level: 'info',
          message: 'local command completed successfully',
          workflowId: 'local-cmd',
          stream: 'stdout',
          caller: 'localCommand',
        }),
        stream: 'stdout',
      });

      // Log entries should still be persisted — no backend errors
      const logFile = join(baseDir, '.emdesign', 'logs', 'global.ndjson');
      expect(existsSync(logFile)).toBe(true);
      const lines = readFileSync(logFile, 'utf-8').trim().split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThanOrEqual(1);

      const entry = JSON.parse(lines[0]);
      expect(entry.message).toBe('local command completed successfully');
    } finally {
      rmSync(baseDir, { recursive: true, force: true });
    }
  });
});

// ── Scenario 4: --log-level filtering ────────────────────────────────────

describe('--log-level filtering', () => {
  it('only persists events at or above the specified log level', async () => {
    // RED: ../lib/trace.ts does not exist yet — this dynamic import will fail
    const { createTraceContext } = await import('../lib/trace.js');

    const baseDir = tempDir();
    try {
      // Create trace context with logLevel filter set to 'warn'
      const ctx = createTraceContext(baseDir, { logLevel: 'warn' });

      expect(ctx.bus).toBeInstanceOf(PlatformEventBus);

      // Emit an info-level event (should be filtered out)
      ctx.bus.emit({
        type: 'session:log',
        sessionId: 'test',
        line: JSON.stringify({
          level: 'info',
          message: 'info message — should be filtered',
          workflowId: 'log-level-test',
          stream: 'stdout',
          caller: 'logLevelTest',
        }),
        stream: 'stdout',
      });

      // Emit a warn-level event (should be persisted)
      ctx.bus.emit({
        type: 'session:log',
        sessionId: 'test',
        line: JSON.stringify({
          level: 'warn',
          message: 'warn message — should appear',
          workflowId: 'log-level-test',
          stream: 'stdout',
          caller: 'logLevelTest',
        }),
        stream: 'stdout',
      });

      // Emit an error-level event (should be persisted)
      ctx.bus.emit({
        type: 'session:log',
        sessionId: 'test',
        line: JSON.stringify({
          level: 'error',
          message: 'error message — should appear',
          workflowId: 'log-level-test',
          stream: 'stderr',
          caller: 'logLevelTest',
        }),
        stream: 'stderr',
      });

      const logFile = join(baseDir, '.emdesign', 'logs', 'global.ndjson');
      expect(existsSync(logFile)).toBe(true);
      const lines = readFileSync(logFile, 'utf-8').trim().split('\n').filter(Boolean);

      // Should only contain warn and error events (no info)
      const levels = lines.map(l => JSON.parse(l).level);
      expect(levels).not.toContain('info');
      expect(levels).toContain('warn');
      expect(levels).toContain('error');

      // Only 2 entries should be persisted (warn + error)
      expect(levels.length).toBe(2);
    } finally {
      rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it('defaults to info level when --log-level is not specified', async () => {
    const { createTraceContext } = await import('../lib/trace.js');

    const baseDir = tempDir();
    try {
      // No logLevel option — should default to 'info'
      const ctx = createTraceContext(baseDir);

      // Emit a debug event (should be filtered by default)
      ctx.bus.emit({
        type: 'session:log',
        sessionId: 'test',
        line: JSON.stringify({
          level: 'debug',
          message: 'debug message — should be filtered by default',
          workflowId: 'default-level-test',
          stream: 'stdout',
          caller: 'defaultLevelTest',
        }),
        stream: 'stdout',
      });

      // Emit an info event (should be persisted by default)
      ctx.bus.emit({
        type: 'session:log',
        sessionId: 'test',
        line: JSON.stringify({
          level: 'info',
          message: 'info message — should appear by default',
          workflowId: 'default-level-test',
          stream: 'stdout',
          caller: 'defaultLevelTest',
        }),
        stream: 'stdout',
      });

      const logFile = join(baseDir, '.emdesign', 'logs', 'global.ndjson');
      expect(existsSync(logFile)).toBe(true);
      const lines = readFileSync(logFile, 'utf-8').trim().split('\n').filter(Boolean);

      // Default filter is info, so debug should be filtered, info should appear
      const levels = lines.map(l => JSON.parse(l).level);
      expect(levels).not.toContain('debug');
      expect(levels).toContain('info');
    } finally {
      rmSync(baseDir, { recursive: true, force: true });
    }
  });
});
