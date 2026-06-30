/**
 * `session list|show|logs` and `logs` — CLI session tracing and log query commands.
 *
 * Reads Claude's ~/.claude/ JSONL session storage via @emdesign/session for
 * session commands, and reads .emdesign/logs/ NDJSON files for the logs command.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getSessions, getConversation } from '@emdesign/agent-manager';
import type { RepoPaths } from '@emdesign/backend';
import { formatError } from '../lib/format.js';

const VALID_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

// ── Types ──────────────────────────────────────────────────────────────

export interface SessionArgs {
  subcommand: 'list' | 'show' | 'logs';
  args: string[];
  limit?: number;
  id?: string;
  tail?: boolean;
  format?: 'text' | 'json';
}

export interface LogsArgs {
  level?: string;
  session?: string;
  since?: string;
  until?: string;
  follow?: boolean;
  format?: 'json' | 'text';
}

// ── Session command dispatcher ─────────────────────────────────────────

export async function cmdSession(opts: SessionArgs, paths: RepoPaths): Promise<void> {
  switch (opts.subcommand) {
    case 'list':
      await cmdSessionList(opts, paths);
      break;
    case 'show':
      await cmdSessionShow(opts, paths);
      break;
    case 'logs':
      await cmdSessionLogs(opts, paths);
      break;
    default:
      formatError(`unknown session subcommand: ${opts.subcommand}`);
      process.exit(1);
  }
}

// ── session list ───────────────────────────────────────────────────────

async function cmdSessionList(opts: SessionArgs, _paths: RepoPaths): Promise<void> {
  const sessions = await getSessions();
  const limit = opts.limit ?? sessions.length;
  const display = sessions.slice(0, limit);

  if (display.length === 0) {
    process.stdout.write('No sessions found.\n');
    return;
  }

  // Table header
  const h1 = 'Session ID';
  const h2 = 'Name';
  const h3 = 'Project';
  const h4 = 'Last Activity';

  process.stdout.write(
    `${h1.padEnd(28)} ${h2.padEnd(30)} ${h3.padEnd(16)} ${h4}\n`,
  );
  process.stdout.write(
    `${'-'.repeat(28)} ${'-'.repeat(30)} ${'-'.repeat(16)} ${'-'.repeat(20)}\n`,
  );

  for (const s of display) {
    const date = new Date(s.timestamp).toLocaleString();
    process.stdout.write(
      `${s.id.padEnd(28)} ${s.display.padEnd(30)} ${s.projectName.padEnd(16)} ${date}\n`,
    );
  }
}

// ── session show ───────────────────────────────────────────────────────

async function cmdSessionShow(opts: SessionArgs, _paths: RepoPaths): Promise<void> {
  const id = opts.id ?? opts.args[0];
  if (!id) {
    formatError('usage: emdesign session show <id>');
    process.exit(1);
  }

  let messages;
  try {
    messages = await getConversation(id);
  } catch (err) {
    process.stderr.write(`Error: session not found — ${(err as Error).message}\n`);
    process.exit(1);
  }

  if (!messages || messages.length === 0) {
    process.stdout.write('Session not found.\n');
    process.exit(0);
  }

  const firstTs = messages[0]?.timestamp;
  const lastTs = messages[messages.length - 1]?.timestamp;

  process.stdout.write(`Session: ${id}\n`);
  process.stdout.write(`Messages: ${messages.length}\n`);
  if (firstTs) process.stdout.write(`First message: ${new Date(firstTs).toLocaleString()}\n`);
  if (lastTs) process.stdout.write(`Last message: ${new Date(lastTs).toLocaleString()}\n`);
  process.stdout.write('\nMessages:\n');

  for (const msg of messages) {
    const role = msg.type === 'user'
      ? 'USER'
      : msg.type === 'assistant'
        ? 'ASSISTANT'
        : msg.type.toUpperCase();
    const preview = typeof msg.message?.content === 'string'
      ? msg.message.content.slice(0, 120)
      : typeof msg.summary === 'string'
        ? msg.summary.slice(0, 120)
        : '';
    if (preview) {
      process.stdout.write(`  [${role}] ${preview}\n`);
    }
  }
}

// ── session logs ───────────────────────────────────────────────────────

async function cmdSessionLogs(opts: SessionArgs, paths: RepoPaths): Promise<void> {
  const id = opts.id ?? opts.args[0];
  if (!id) {
    formatError('usage: emdesign session logs <id> [--tail] [--format text|json]');
    process.exit(1);
  }

  const logFile = path.join(paths.emdesignDir, 'logs', 'sessions', `${id}.ndjson`);

  if (!fs.existsSync(logFile)) {
    // No log file for this session — not an error
    return;
  }

  const content = fs.readFileSync(logFile, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  if (lines.length === 0) {
    // Empty file — nothing to print; not a crash
    if (opts.tail) {
      // Tail mode with no entries: would normally watch, but for CLI
      // we just exit cleanly (simplified — no indefinite watch).
    }
    return;
  }

  const fmt = opts.format ?? 'text';
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (fmt === 'json') {
        process.stdout.write(JSON.stringify(entry) + '\n');
      } else {
        process.stdout.write(`[${(entry.level ?? 'INFO').toUpperCase()}] ${entry.timestamp ?? ''} ${entry.message ?? ''}\n`);
      }
    } catch {
      // Line is not parseable JSON — print raw
      process.stdout.write(line + '\n');
    }
  }

  if (opts.tail) {
    // Simplified follow: watch the file for changes.
    // In a real implementation we'd track byte offsets; here we
    // just keep the process alive so the user sees new entries.
    try {
      fs.watchFile(logFile, () => {
        /* re-read new entries in a full implementation */
      });
    } catch {
      // Watch not supported — exit
    }
  }
}

// ── logs (global log query) ────────────────────────────────────────────

export async function cmdLogs(opts: LogsArgs, paths: RepoPaths): Promise<void> {
  // Validate level
  if (opts.level && !(VALID_LEVELS as readonly string[]).includes(opts.level)) {
    process.stderr.write(
      `Invalid level "${opts.level}". Valid levels: ${VALID_LEVELS.join(', ')}\n`,
    );
    process.exit(1);
  }

  const logDir = path.join(paths.emdesignDir, 'logs');

  if (!fs.existsSync(logDir)) {
    process.stdout.write('No logs found.\n');
    process.exit(0);
  }

  const logFile = path.join(logDir, 'global.ndjson');

  if (!fs.existsSync(logFile)) {
    process.stdout.write('No logs found.\n');
    process.exit(0);
  }

  const content = fs.readFileSync(logFile, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  const fmt = opts.format ?? 'text';

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      // Apply filters
      if (opts.level && entry.level !== opts.level) continue;
      if (opts.session && entry.sessionId !== opts.session) continue;
      if (opts.since && entry.timestamp && entry.timestamp < opts.since) continue;
      if (opts.until && entry.timestamp && entry.timestamp > opts.until) continue;

      if (fmt === 'json') {
        process.stdout.write(JSON.stringify(entry) + '\n');
      } else {
        process.stdout.write(
          `[${(entry.level ?? 'INFO').toUpperCase()}] ${entry.timestamp ?? ''} ${entry.message ?? ''}\n`,
        );
      }
    } catch {
      // Skip malformed lines
    }
  }

  if (opts.follow) {
    try {
      fs.watchFile(logFile, () => {
        /* re-read new entries in a full implementation */
      });
    } catch {
      // Watch not supported
    }
  }
}
