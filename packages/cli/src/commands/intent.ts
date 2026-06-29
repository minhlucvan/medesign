/**
 * `intent` and `chat` — CLI intent submission and agent chat commands with SSE streaming.
 *
 * Submits design intents via POST /api/intent and streams agent chat responses
 * via POST /api/chat/stream (SSE).
 */

import type { RepoPaths } from '@emdesign/backend';

const PORT = Number(process.env.EMDESIGN_PORT ?? 4321);
const BASE_URL = `http://localhost:${PORT}`;

const SUPPORTED_TYPES = [
  'create-component',
  'change-request',
  'create-story',
  'create-view',
  'create-design-system',
  'update-design-system',
  'edit-text',
] as const;

// ── Types ──────────────────────────────────────────────────────────────

export interface IntentArgs {
  type: string;
  instruction: string;
  selector?: string;
}

export interface ChatArgs {
  message: string;
  type: string;
  wait?: boolean;
  interactive?: boolean;
}

// ── Intent handler ─────────────────────────────────────────────────────

export async function cmdIntent(opts: IntentArgs, _paths: RepoPaths): Promise<void> {
  // Validate intent type
  if (!(SUPPORTED_TYPES as readonly string[]).includes(opts.type)) {
    process.stderr.write(
      `Error: unknown intent type "${opts.type}". Supported types: ${SUPPORTED_TYPES.join(', ')}\n`,
    );
    process.exit(1);
  }

  // POST to /api/intent
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: opts.type,
        instruction: opts.instruction,
        ...(opts.selector != null ? { selector: opts.selector } : {}),
      }),
    });
  } catch {
    process.stderr.write(`Error: backend not reachable at ${BASE_URL}\n`);
    process.exit(1);
  }

  if (!res.ok) {
    process.stderr.write(`Error: backend returned ${res.status}\n`);
    process.exit(1);
  }

  const data = (await res.json()) as { changeRequestId: string };
  process.stdout.write(`${data.changeRequestId}\n`);
}

// ── Chat handler ───────────────────────────────────────────────────────

export async function cmdChat(opts: ChatArgs, _paths: RepoPaths): Promise<void> {
  await makeChatRequest(opts.message, opts.type, opts.interactive ?? false);
}

async function makeChatRequest(
  message: string,
  type: string,
  interactive: boolean,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, type }),
    });
  } catch {
    process.stderr.write(`Error: backend not reachable at ${BASE_URL}\n`);
    process.exit(1);
  }

  if (!res.ok) {
    process.stderr.write(`Error: backend returned ${res.status}\n`);
    process.exit(1);
  }

  const body = res.body;
  if (!body) {
    process.stderr.write('Error: no response body\n');
    process.exit(1);
  }

  try {
    await readSSE(body);
  } catch (err) {
    process.stderr.write(`Error: stream error — ${(err as Error).message}\n`);
    process.exit(1);
  }

  // Interactive mode: prompt for follow-up after stream completes
  if (interactive) {
    const rlMod = await import('node:readline');
    const rl = rlMod.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const followUp = await new Promise<string>((resolve) => {
      rl.question('Follow-up: ', (answer: string) => {
        resolve(answer);
      });
    });
    rl.close();
    if (followUp) {
      await makeChatRequest(followUp, type, false);
    }
  }
}

// ── SSE stream reader ──────────────────────────────────────────────────

async function readSSE(
  body: ReadableStream<Uint8Array> | { on(event: string, cb: (...args: any[]) => void): void },
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let buffer = '';

    function flush() {
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of raw.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;
            process.stdout.write(data + '\n');
          }
        }
      }
    }

    if (typeof (body as any).getReader === 'function') {
      // Web ReadableStream (from real Node.js fetch)
      const reader = (body as ReadableStream<Uint8Array>).getReader()!;
      const decoder = new TextDecoder();
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            flush();
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      })();
    } else {
      // Node.js Readable stream (used in test mocks)
      const stream = body as any;
      stream.on('data', (chunk: any) => {
        buffer += String(chunk);
        flush();
      });
      stream.on('end', () => resolve());
      stream.on('error', (err: Error) => reject(err));
    }
  });
}
