/**
 * Enhanced agent process spawner — extracted and extended from
 * packages/backend/src/harness/driver.ts.
 *
 * Unlike the one-shot runAgent(), AgentRunner keeps stdin open, returns
 * an AgentHandle for long-lived process management, supports follow-up
 * prompts, cancellation, and event subscriptions.
 */
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Writable } from 'node:stream';
import type { MinimalAgentDef } from '@emdesign/backend';

const pexecFile = promisify(execFile);


export interface AgentRunnerOptions {
  def: MinimalAgentDef;
  cwd: string;
  prompt: string;
  model?: string;
  newSessionId?: string;
  resumeSessionId?: string;
  allowedDirs?: string[];
  signal?: AbortSignal;
  /** Permission mode for the agent (default: 'bypassPermissions'). */
  permissionMode?: string;
}

export interface AgentHandle {
  sessionId: string;
  pid: number;
  /** Write a follow-up prompt to the running agent's stdin. */
  sendPrompt(prompt: string): Promise<void>;
  /** Write raw JSON to stdin (for tool_result injection, etc.). */
  sendRaw(data: object): Promise<void>;
  /** Kill the process (SIGTERM → SIGKILL after timeout). */
  cancel(): Promise<void>;
  /** Subscribe to stream-json events from stdout. */
  onEvent(handler: (event: { type: string; [key: string]: unknown }) => void): () => void;
  /** Subscribe to raw stdout/stderr lines. */
  onLog(handler: (line: string, stream: 'stdout' | 'stderr') => void): () => void;
  /** Wait for the process to exit and get accumulated text. */
  waitForExit(): Promise<{ text: string; exitCode: number | null }>;
}

function buildChildEnv(binDir: string | null): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const sep = path.delimiter;
  const nodeDir = path.dirname(process.execPath);
  const toolchain = [
    path.join(os.homedir(), '.bun', 'bin'),
    path.join(os.homedir(), '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ];
  const prepend = [nodeDir, ...(binDir ? [binDir] : [])];
  env.PATH = [...prepend, env.PATH ?? '', ...toolchain].filter(Boolean).join(sep);
  return env;
}

async function resolveExecutable(def: MinimalAgentDef): Promise<string | null> {
  const which = process.platform === 'win32' ? 'where' : 'which';
  for (const bin of [def.bin, ...(def.fallbackBins ?? [])]) {
    try {
      const { stdout } = await pexecFile(which, [bin]);
      const p = stdout.split('\n')[0]?.trim();
      if (p) return p;
    } catch { /* not found, try next */ }
  }
  return null;
}

export class AgentRunner {
  async spawn(opts: AgentRunnerOptions): Promise<AgentHandle> {
    const { def } = opts;
    const binPath = await resolveExecutable(def);
    if (!binPath) throw new Error(`Agent '${def.id}' not found on PATH (${[def.bin, ...(def.fallbackBins ?? [])].join(', ')}).`);

    // Probe capabilities
    const capabilities: Record<string, boolean> = {};
    if (def.helpArgs && def.capabilityFlags) {
      try {
        const { stdout, stderr } = await pexecFile(binPath, def.helpArgs, { cwd: os.tmpdir() });
        const help = `${stdout}\n${stderr}`;
        for (const [flag, bit] of Object.entries(def.capabilityFlags)) {
          capabilities[bit] = help.includes(flag);
        }
      } catch { /* probe failed */ }
    }


    const args = def.buildArgs({
      model: opts.model,
      extraAllowedDirs: opts.allowedDirs,
      resumeSessionId: opts.resumeSessionId,
      newSessionId: opts.newSessionId,
      capabilities,
      permissionMode: opts.permissionMode,
    });

    const child = spawn(binPath, args, {
      cwd: opts.cwd,
      env: buildChildEnv(path.dirname(binPath)),
      stdio: ['pipe', 'pipe', 'pipe'],
      signal: opts.signal,
    });

    const sessionId = opts.newSessionId ?? opts.resumeSessionId ?? `ses_${Date.now()}`;

    // Deliver initial prompt
    if (def.promptInputFormat === 'stream-json') {
      const msg = { type: 'user', message: { role: 'user', content: [{ type: 'text', text: opts.prompt }] } };
      child.stdin!.write(JSON.stringify(msg) + '\n');
    } else {
      child.stdin!.write(opts.prompt);
    }

    // Don't close stdin — keep it open for follow-up prompts

    // Event subscriptions
    const eventHandlers = new Set<(event: any) => void>();
    const logHandlers = new Set<(line: string, stream: 'stdout' | 'stderr') => void>();

    let text = '';
    let buf = '';

    child.stdout!.setEncoding('utf8');
    child.stdout!.on('data', (chunk: string) => {
      buf += chunk;
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        for (const handler of logHandlers) handler(line, 'stdout');
        try {
          const ev = JSON.parse(line) as any;
          for (const handler of eventHandlers) handler(ev);
          if (ev.type === 'assistant' && ev.message?.content) {
            for (const block of ev.message.content) {
              if (block.type === 'text' && block.text) text += block.text;
            }
          }
        } catch { /* non-JSON line */ }
      }
    });

    child.stderr!.setEncoding('utf8');
    child.stderr!.on('data', (chunk: string) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        for (const handler of logHandlers) handler(line, 'stderr');
      }
    });

    let exitResolve: ((result: { text: string; exitCode: number | null }) => void) | null = null;
    const exitPromise = new Promise<{ text: string; exitCode: number | null }>((resolve) => {
      exitResolve = resolve;
    });

    child.on('close', (code) => {
      if (exitResolve) exitResolve({ text, exitCode: code });
    });
    child.on('error', (err) => {
      if (exitResolve) exitResolve({ text: text + `\n[Agent error: ${err.message}]`, exitCode: null });
    });

    const handle: AgentHandle = {
      sessionId,
      pid: child.pid!,
      sendPrompt: async (prompt: string) => {
        const msg = { type: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] } };
        child.stdin!.write(JSON.stringify(msg) + '\n');
      },
      sendRaw: async (data: object) => {
        child.stdin!.write(JSON.stringify(data) + '\n');
      },
      cancel: async () => {
        return new Promise((resolve) => {
          child.kill('SIGTERM');
          setTimeout(() => {
            if (child.killed) return resolve();
            child.kill('SIGKILL');
            resolve();
          }, 5000);
        });
      },
      onEvent: (handler) => {
        eventHandlers.add(handler);
        return () => eventHandlers.delete(handler);
      },
      onLog: (handler) => {
        logHandlers.add(handler);
        return () => logHandlers.delete(handler);
      },
      waitForExit: async () => exitPromise,
    };

    return handle;
  }
}
