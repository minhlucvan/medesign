/**
 * `intent` and `chat` — CLI intent submission and agent chat commands with SSE streaming.
 *
 * Realizes the scenarios from the delta-spec `specs/cli-cmds.md`:
 * - "Submit intent creates state.json entry"
 * - "Intent with unknown type returns error"
 * - "Intent when backend is unreachable"
 * - "Chat streams events to stdout"
 * - "Chat --wait blocks until stream completes"
 * - "Chat --interactive prompts for follow-up"
 * - "Chat when backend is unreachable"
 * - "Chat when SSE stream drops mid-response"
 * - "Error resilience: Backend unreachable on intent and chat"
 *
 * RED — these tests fail until intent.ts and the cli.ts registration land.
 * The import from ../intent.js will fail because that file does not exist yet.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Readable } from 'node:stream';

import { resolveRepoPaths } from '@emdesign/backend';
import type { RepoPaths } from '@emdesign/backend';

// ── Modules under test ────────────────────────────────────────────────
// RED: these imports fail until intent.ts is created.
import { cmdIntent, cmdChat } from '../intent.js';

const SUPPORTED_TYPES = [
  'create-component',
  'change-request',
  'create-story',
  'create-view',
  'create-design-system',
  'update-design-system',
  'edit-text',
];

// ── Fixtures ──────────────────────────────────────────────────────────

const tmps: string[] = [];

function makeWorkspace(): string {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-intent-ws-'));
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
  vi.restoreAllMocks();
  for (const d of tmps.splice(0)) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

// ================================================================
// intent
// ================================================================

describe('intent', () => {
  it('submits intent and prints changeRequestId — Submit intent creates state.json entry', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);

    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ changeRequestId: 'cr_abc123' }),
    } as Response);

    try {
      await cmdIntent({
        type: 'create-component',
        instruction: 'Add a button',
        selector: '.hero',
      }, paths);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    // fetch was called with POST to /api/intent with the correct body
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toContain('/api/intent');
    expect(call[1]?.method ?? (call[1] as any)?.method).toBe('POST');
    const body = JSON.parse((call[1] as any)?.body ?? '{}');
    expect(body.type).toBe('create-component');
    expect(body.instruction).toBe('Add a button');
    expect(body.selector).toBe('.hero');

    // The changeRequestId is printed to stdout
    expect(stdout).toContain('cr_abc123');

    mockFetch.mockRestore();
  });

  it('rejects unknown intent type — Intent with unknown type returns error', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);

    try {
      await cmdIntent({
        type: 'invalid-type',
        instruction: 'Do something',
      }, paths);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    // Stderr lists supported types
    expect(stderr).toMatch(/create-component|change-request|create-story/);
    expect(exitCode).toBeDefined();
    expect(exitCode).not.toBe(0);
  });

  it('handles backend unreachable — Intent when backend is unreachable', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);

    const mockFetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fetch failed'));

    try {
      await cmdIntent({
        type: 'create-component',
        instruction: 'Button',
      }, paths);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    // Stderr contains a "not reachable" or connection error message
    expect(stderr).toMatch(/not reachable|unreachable|connection|refused/i);
    // Exits non-zero
    expect(exitCode).toBeDefined();
    expect(exitCode).not.toBe(0);

    mockFetch.mockRestore();
  });
});

// ================================================================
// chat
// ================================================================

describe('chat', () => {
  it('streams SSE events to stdout — Chat streams events to stdout', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);

    const events = [
      'data: {"type":"status","content":"Starting"}\n\n',
      'data: {"type":"progress","content":"Analyzing design"}\n\n',
      'data: {"type":"result","content":"Here is your hero card"}\n\n',
      'data: [DONE]\n\n',
    ];
    const streamBody = new Readable({
      read() {
        for (const ev of events) {
          this.push(ev);
        }
        this.push(null);
      },
    });

    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: streamBody,
    } as unknown as Response);

    try {
      await cmdChat({
        message: 'Create a hero card',
        type: 'create-component',
      }, paths);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    // fetch was called with POST to /api/chat/stream
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toContain('/api/chat/stream');
    const body = JSON.parse((call[1] as any)?.body ?? '{}');
    expect(body.message).toBe('Create a hero card');
    expect(body.type).toBe('create-component');

    // SSE events appear on stdout
    expect(stdout).toContain('Starting');
    expect(stdout).toContain('Analyzing design');
    expect(stdout).toContain('Here is your hero card');

    mockFetch.mockRestore();
  });

  it('blocks until stream ends with --wait — Chat --wait blocks until stream completes', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);

    const events = [
      'data: {"type":"progress","content":"Step 1"}\n\n',
      'data: {"type":"progress","content":"Step 2"}\n\n',
      'data: {"type":"result","content":"Done"}\n\n',
      'data: [DONE]\n\n',
    ];
    const streamBody = new Readable({
      read() {
        for (const ev of events) {
          this.push(ev);
        }
        this.push(null);
      },
    });

    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: streamBody,
    } as unknown as Response);

    try {
      await cmdChat({
        message: 'Create a hero card',
        type: 'create-component',
        wait: true,
      }, paths);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    // All events printed before the handler resolves
    expect(stdout).toContain('Step 1');
    expect(stdout).toContain('Step 2');
    expect(stdout).toContain('Done');
    // Exit code 0
    expect(exitCode === undefined || exitCode === 0).toBe(true);

    mockFetch.mockRestore();
  });

  it('prompts for follow-up with --interactive — Chat --interactive prompts for follow-up', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);

    // First SSE stream
    const firstEvents = [
      'data: {"type":"result","content":"Initial response"}\n\n',
      'data: [DONE]\n\n',
    ];
    const firstStream = new Readable({
      read() {
        for (const ev of firstEvents) {
          this.push(ev);
        }
        this.push(null);
      },
    });

    // Second SSE stream (follow-up)
    const secondEvents = [
      'data: {"type":"result","content":"Follow-up response"}\n\n',
      'data: [DONE]\n\n',
    ];
    const secondStream = new Readable({
      read() {
        for (const ev of secondEvents) {
          this.push(ev);
        }
        this.push(null);
      },
    });

    let callCount = 0;
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: true, body: firstStream } as unknown as Response;
      }
      return { ok: true, body: secondStream } as unknown as Response;
    });

    // Mock readline to simulate user entering a follow-up message
    const mockCreateInterface = vi.spyOn(await import('node:readline'), 'createInterface').mockReturnValue({
      question: vi.fn((_query: string, cb: (answer: string) => void) => {
        cb('Make it blue');
      }),
      close: vi.fn(),
    } as any);

    try {
      await cmdChat({
        message: 'Create a hero card',
        type: 'create-component',
        interactive: true,
      }, paths);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    // Two SSE requests were made
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse((mockFetch.mock.calls[1][1] as any)?.body ?? '{}');
    expect(secondCallBody.message).toBe('Make it blue');

    // Both responses appear on stdout
    expect(stdout).toContain('Initial response');
    expect(stdout).toContain('Follow-up response');

    mockFetch.mockRestore();
    mockCreateInterface.mockRestore();
  });

  it('handles backend unreachable — Chat when backend is unreachable', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);

    const mockFetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fetch failed'));

    try {
      await cmdChat({
        message: 'Hello',
        type: 'change-request',
      }, paths);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    // Stderr contains a connection error message
    expect(stderr).toMatch(/not reachable|unreachable|connection|refused|error/i);
    // Exits non-zero
    expect(exitCode).toBeDefined();
    expect(exitCode).not.toBe(0);

    mockFetch.mockRestore();
  });

  it('handles SSE stream drop mid-response — Chat when SSE stream drops mid-response', async () => {
    const ws = makeWorkspace();
    const paths = resolveRepoPaths(ws);

    // Stream that emits partial events then ends prematurely (simulates a drop)
    const dropStream = new Readable({
      read() {
        this.push('data: {"type":"progress","content":"Partial data"}\n\n');
        // Emit an error on the stream to simulate connection drop
        this.destroy(new Error('Connection reset'));
      },
    });

    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: dropStream,
    } as unknown as Response);

    try {
      await cmdChat({
        message: 'Create something',
        type: 'create-component',
      }, paths);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    // Error is printed to stderr
    expect(stderr).toMatch(/error|dropped|reset|disconnect|stream|unexpected/i);
    // Exits non-zero
    expect(exitCode).toBeDefined();
    expect(exitCode).not.toBe(0);

    mockFetch.mockRestore();
  });
});
