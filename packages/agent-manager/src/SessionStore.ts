/**
 * File-backed session store for emdesign-managed sessions.
 * Persists session metadata under .emdesign/sessions/ — separate from the
 * existing state.json and claude-run's ~/.claude/ directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { RepoPaths } from '@emdesign/backend';
import type { EmSession } from './storage.js';

export class SessionStore {
  private sessions: Map<string, EmSession> = new Map();

  constructor(private paths: RepoPaths) {
    this.loadIndex();
  }

  // ── Paths ──────────────────────────────────────────────────────────

  private sessionsDir(): string {
    return path.join(this.paths.emdesignDir, 'sessions');
  }

  private indexFile(): string {
    return path.join(this.sessionsDir(), 'index.json');
  }

  private sessionFile(id: string): string {
    return path.join(this.sessionsDir(), `${id}.json`);
  }

  // ── Persistence ────────────────────────────────────────────────────

  private loadIndex(): void {
    try {
      const raw = fs.readFileSync(this.indexFile(), 'utf8');
      const list: Array<{ id: string }> = JSON.parse(raw);
      for (const entry of list) {
        try {
          const detail = JSON.parse(fs.readFileSync(this.sessionFile(entry.id), 'utf8'));
          this.sessions.set(entry.id, detail as EmSession);
        } catch { /* skip corrupt session file */ }
      }
    } catch { /* no sessions yet */ }
  }

  private persistIndex(): void {
    const dir = this.sessionsDir();
    fs.mkdirSync(dir, { recursive: true });
    const list = Array.from(this.sessions.values()).map(s => ({ id: s.id }));
    fs.writeFileSync(this.indexFile(), JSON.stringify(list, null, 2));
  }

  private persistSession(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    const dir = this.sessionsDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.sessionFile(id), JSON.stringify(session, null, 2));
  }

  // ── CRUD ───────────────────────────────────────────────────────────

  upsert(session: EmSession): void {
    this.sessions.set(session.id, session);
    this.persistSession(session.id);
    this.persistIndex();
  }

  get(id: string): EmSession | undefined {
    return this.sessions.get(id);
  }

  list(): EmSession[] {
    return Array.from(this.sessions.values());
  }

  delete(id: string): void {
    this.sessions.delete(id);
    this.persistIndex();
    try { fs.unlinkSync(this.sessionFile(id)); } catch { /* ok */ }
  }
}
