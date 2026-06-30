/**
 * `session list|show|logs` and `logs` — CLI session tracing and log query commands.
 *
 * Realizes the scenarios from the delta-spec `specs/cli-cmds.md`:
 * - "Session list shows sessions"
 * - "Session show with non-existent ID returns error"
 * - "Session logs --tail with empty session log"
 * - "Logs filtered by level"
 * - "Logs --level with invalid value"
 * - "Logs when .emdesign/logs/ does not exist"
 * - "Session show when file missing"
 *
 * RED — these tests fail until session.ts and the cli.ts registration land.
 * The import from ../session.js will fail because that file does not exist yet.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { resolveRepoPaths } from '@emdesign/backend';
import type { RepoPaths } from '@emdesign/backend';

// ── Modules under test ────────────────────────────────────────────────
// RED: these imports fail until session.ts is created.
import { cmdSession, cmdLogs } from '../session.js';

// ── Mocks for @emdesign/session ───────────────────────────────────────

const { mockGetSessions, mockGetConversation } = vi.hoisted(() => ({
  mockGetSessions: vi.fn(),
  mockGetConversation: vi.fn(),
}));

vi.mock('@emdesign/agent-manager', () => ({
  getSessions: mockGetSessions,
  getConversation: mockGetConversation,
}));

// ── Fixtures ──────────────────────────────────────────────────────────

const tmps: string[] = [];

function makeWorkspace(): string {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-session-ws-'));
  tmps.push(ws);
  fs.writeFileSync(
    path.join(ws, 'emdesign.config.json'),
    JSON.stringify({
      framework: 'react-tailwind',
      storybookUrl: 'http://localhost:6006',
      generatedDir: 'src/generated',
      componentsDir: 'src/components',
      designSystemsDir: 'design-systems',
      screenshotsDir: '__screenshots__',
    }),
  );
  return ws;
}

/** Sentinel thrown by mocked process.exit so tests can read the exit code. */
class ExitSignal extends Error {
  constructor(public code: number | undefined) {
    super(`process.exit(${code})`);
  }
}

let stdout = '';
let stderr = '';
let exitCode: number | undefined;
let stdoutSpy: ReturnType<typeof vi.spyOn>;
let stderrSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  stdout = '';
  stderr = '';
  exitCode = undefined;
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    stdout += String(chunk);
    return true;
  });
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
    stderr += String(chunk);
    return true;
  });
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    exitCode = code;
    throw new ExitSignal(code);
  }) as never);
});

afterEach(() => {
  stdoutSpy?.mockRestore();
  stderrSpy?.mockRestore();
  exitSpy?.mockRestore();
  vi.clearAllMocks();
  for (const d of tmps.splice(0)) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

// ================================================================
// Session list
// ================================================================

describe('session list', () => {
  it('shows sessions from storage — Session list shows sessions', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);

    mockGetSessions.mockResolvedValue([
      {
        id: 'ses_001',
        display: 'Design system setup',
        timestamp: Date.now() - 3_600_000,
        project: '/Users/user/project',
        projectName: 'project',
      },
      {
        id: 'ses_002',
        display: 'Create button component',
        timestamp: Date.now() - 7_200_000,
        project: '/Users/user/project',
        projectName: 'project',
      },
      {
        id: 'ses_003',
        display: 'Fix layout issue',
        timestamp: Date.now() - 10_800_000,
        project: '/Users/user/other',
        projectName: 'other',
      },
    ]);

    try {
      await cmdSession({ subcommand: 'list', args: ['--limit', '5'], limit: 5 }, paths);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    expect(mockGetSessions).toHaveBeenCalled();
    expect(stdout).toMatch(/ses_001/);
    expect(stdout).toMatch(/ses_002/);
    expect(stdout).toMatch(/ses_003/);
    expect(stdout).toMatch(/Design system setup/);
    expect(stdout).toMatch(/Create button component/);
    expect(stdout).toMatch(/Fix layout issue/);
  });
});

// ================================================================
// Session show
// ================================================================

describe('session show', () => {
  it('errors on non-existent ID — Session show with non-existent ID returns error', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);

    mockGetConversation.mockRejectedValue(new Error('session not found'));

    try {
      await cmdSession({ subcommand: 'show', args: ['non-existent-id'], id: 'non-existent-id' }, paths);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    expect(stderr).toMatch(/error/i);
    expect(stderr).toMatch(/not found/i);
    expect(exitCode).toBeDefined();
    expect(exitCode).not.toBe(0);
  });

  it('prints "Session not found" when file missing — Session show when file missing', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);

    mockGetConversation.mockResolvedValue([]);

    try {
      await cmdSession({ subcommand: 'show', args: ['non-existent'], id: 'non-existent' }, paths);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    expect(stdout).toMatch(/Session not found/i);
    // Not an error — just no data, so exit code should be 0
    expect(exitCode === undefined || exitCode === 0).toBe(true);
  });
});

// ================================================================
// Session logs
// ================================================================

describe('session logs', () => {
  it('does not crash on empty session log — Session logs --tail with empty session log', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);
    const sessionsDir = path.join(ws, '.emdesign', 'logs', 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(path.join(sessionsDir, 'some-id.ndjson'), '');

    let threw = false;
    try {
      await cmdSession({ subcommand: 'logs', args: ['some-id', '--tail'], id: 'some-id', tail: true }, paths);
    } catch (e) {
      if (e instanceof ExitSignal) {
        // process.exit was called — that's fine (not a crash)
      } else {
        threw = true;
      }
    }

    // The command should not throw an unhandled error
    expect(threw).toBe(false);
  });
});

// ================================================================
// Logs (global log query)
// ================================================================

describe('logs', () => {
  it('filters by level — Logs filtered by level', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);
    const logDir = path.join(paths.emdesignDir, 'logs');
    fs.mkdirSync(logDir, { recursive: true });

    const entries = [
      { timestamp: '2026-06-29T22:00:00.000Z', level: 'info', sessionId: 's1', workflowId: 'w1', message: 'started', stream: 'stdout', caller: 'main' },
      { timestamp: '2026-06-29T22:01:00.000Z', level: 'warn', sessionId: 's1', workflowId: 'w1', message: 'slow', stream: 'stdout', caller: 'main' },
      { timestamp: '2026-06-29T22:02:00.000Z', level: 'error', sessionId: 's1', workflowId: 'w1', message: 'failed', stream: 'stderr', caller: 'main' },
      { timestamp: '2026-06-29T22:03:00.000Z', level: 'info', sessionId: 's2', workflowId: 'w2', message: 'done', stream: 'stdout', caller: 'other' },
    ];
    fs.writeFileSync(
      path.join(logDir, 'global.ndjson'),
      entries.map(e => JSON.stringify(e)).join('\n') + '\n',
    );

    try {
      await cmdLogs({ level: 'error' }, paths);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    // Only "error" level entries should appear in stdout
    expect(stdout).toMatch(/failed/);
    expect(stdout).not.toMatch(/started/);
    expect(stdout).not.toMatch(/slow/);
    expect(stdout).not.toMatch(/done/);
  });

  it('rejects invalid level — Logs --level with invalid value', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);

    try {
      await cmdLogs({ level: 'invalid' }, paths);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    expect(stderr).toMatch(/debug|info|warn|error/);
    expect(exitCode).toBeDefined();
    expect(exitCode).not.toBe(0);
  });

  it('prints "No logs found" when log dir missing — Logs when .emdesign/logs/ does not exist', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);
    // Intentionally do NOT create .emdesign/logs/ — test the missing-directory path

    try {
      await cmdLogs({}, paths);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    expect(stdout).toMatch(/No logs found/i);
    expect(exitCode === undefined || exitCode === 0).toBe(true);
  });
});
