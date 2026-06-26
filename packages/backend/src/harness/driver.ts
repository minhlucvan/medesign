import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { MinimalAgentDef } from './types.js';

const pexecFile = promisify(execFile);

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface RunAgentInput {
  def: MinimalAgentDef;
  cwd: string;
  /** Composed prompt (DESIGN.md + skill + current component + instruction). */
  prompt: string;
  model?: string | null;
  resumeSessionId?: string | null;
  newSessionId?: string;
  allowedDirs?: string[];
  /** MCP servers written to `.mcp.json` so the agent can call medesign's tools. */
  mcpServers?: Record<string, McpServerConfig>;
  signal?: AbortSignal;
}

export interface RunAgentResult {
  text: string;
  events: unknown[];
  exitCode: number | null;
}

/** Build a child PATH so GUI-launched/sandboxed parents can still find the agent + toolchains. */
function buildChildEnv(binDir: string | null): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const sep = path.delimiter;
  const nodeDir = path.dirname(process.execPath);
  const toolchain = [
    path.join(os.homedir(), '.bun', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ];
  const prepend = [nodeDir, ...(binDir ? [binDir] : [])];
  env.PATH = [...prepend, env.PATH ?? '', ...toolchain].filter(Boolean).join(sep);
  return env;
}

/** Resolve the agent binary (bin, then fallbackBins). Returns absolute path or null. */
export async function resolveExecutable(def: MinimalAgentDef): Promise<string | null> {
  const which = process.platform === 'win32' ? 'where' : 'which';
  for (const bin of [def.bin, ...(def.fallbackBins ?? [])]) {
    try {
      const { stdout } = await pexecFile(which, [bin]);
      const p = stdout.split('\n')[0]?.trim();
      if (p) return p;
    } catch {
      /* not found, try next */
    }
  }
  return null;
}

/** Probe `<bin> <helpArgs>` and set capability bits for each flag substring found. */
export async function probeCapabilities(def: MinimalAgentDef, binPath: string): Promise<Record<string, boolean>> {
  const caps: Record<string, boolean> = {};
  if (!def.helpArgs || !def.capabilityFlags) return caps;
  try {
    // Probe in tmpdir so we never touch the project or trigger stray installs.
    const { stdout, stderr } = await pexecFile(binPath, def.helpArgs, { cwd: os.tmpdir() });
    const help = `${stdout}\n${stderr}`;
    for (const [flag, bit] of Object.entries(def.capabilityFlags)) {
      caps[bit] = help.includes(flag);
    }
  } catch {
    /* probe failed — leave caps unset (buildArgs treats them as absent) */
  }
  return caps;
}

/** Write `.mcp.json` into cwd so a `claude-mcp-json` agent auto-loads medesign's tools. */
export async function writeMcpJson(cwd: string, servers: Record<string, McpServerConfig>): Promise<void> {
  const file = path.join(cwd, '.mcp.json');
  await fsp.writeFile(file, JSON.stringify({ mcpServers: servers }, null, 2));
}

/**
 * Spawn the agent, stream the prompt in via stdin (stream-json user message), and parse
 * the stdout stream-json events. Resolves when the agent emits its terminal `result` event.
 */
export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const { def } = input;
  const binPath = await resolveExecutable(def);
  if (!binPath) throw new Error(`Agent '${def.id}' not found on PATH (${[def.bin, ...(def.fallbackBins ?? [])].join(', ')}).`);

  const capabilities = await probeCapabilities(def, binPath);

  if (def.mcpConfigStrategy === 'claude-mcp-json' && input.mcpServers) {
    await writeMcpJson(input.cwd, input.mcpServers);
  }

  const args = def.buildArgs({
    model: input.model,
    extraAllowedDirs: input.allowedDirs,
    resumeSessionId: input.resumeSessionId,
    newSessionId: input.newSessionId,
    capabilities,
  });

  const child = spawn(binPath, args, {
    cwd: input.cwd,
    env: buildChildEnv(path.dirname(binPath)),
    stdio: ['pipe', 'pipe', 'pipe'],
    signal: input.signal,
  });

  // Deliver the prompt as a stream-json Anthropic user message; keep stdin open for follow-ups.
  if (def.promptInputFormat === 'stream-json') {
    const msg = { type: 'user', message: { role: 'user', content: [{ type: 'text', text: input.prompt }] } };
    child.stdin.write(JSON.stringify(msg) + '\n');
  } else {
    child.stdin.write(input.prompt);
  }
  child.stdin.end();

  const events: unknown[] = [];
  let text = '';
  let buf = '';

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const ev = JSON.parse(line) as { type?: string; message?: { content?: Array<{ type?: string; text?: string }> } };
        events.push(ev);
        if (ev.type === 'assistant' && ev.message?.content) {
          for (const block of ev.message.content) {
            if (block.type === 'text' && block.text) text += block.text;
          }
        }
      } catch {
        /* non-JSON line (e.g. log noise) — ignore */
      }
    }
  });

  return new Promise<RunAgentResult>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve({ text, events, exitCode: code }));
  });
}
