/**
 * Session lifecycle management.
 * Coordinates AgentRunner to spawn/manage Claude Code sessions.
 */
import path from 'node:path';
import { claudeAdapter } from '@emdesign/backend';
import { AgentRunner, type AgentHandle } from './AgentRunner.js';
import { SessionStore } from './SessionStore.js';
import { PlatformEventBus } from './hooks.js';
import type { RepoPaths } from '@emdesign/backend';
import type { EmSession, WorkflowType, SessionStatus } from './storage.js';
import type { SessionCreateOptions } from './types.js';

export class SessionManager {
  private activeHandles: Map<string, AgentHandle> = new Map();
  private runner: AgentRunner;
  private store: SessionStore;
  private paths: RepoPaths;
  private bus: PlatformEventBus;
  private seq = 0;

  constructor(store: SessionStore, bus: PlatformEventBus, paths: RepoPaths) {
    this.runner = new AgentRunner();
    this.store = store;
    this.bus = bus;
    this.paths = paths;
  }

  async create(opts: SessionCreateOptions): Promise<EmSession> {
    const id = `em_ses_${Date.now()}_${this.seq++}`;
    const now = new Date().toISOString();

    const session: EmSession = {
      id,
      display: opts.instruction ?? `${opts.type} session`,
      timestamp: Date.now(),
      project: this.paths.root,
      projectName: path.basename(this.paths.root),
      emdesignStatus: 'created',
      emdesignType: opts.type,
      scope: opts.scope,
      origin: opts.origin,
      elementContext: opts.elementContext,
    };

    this.store.upsert(session);
    this.bus.emit({ type: 'session:created', session });

    // Compose a workflow bootstrap prompt
    const workflowPrompt = this.buildWorkflowPrompt(opts);

    try {
      const handle = await this.runner.spawn({
        def: claudeAdapter,
        cwd: this.paths.root,
        prompt: workflowPrompt,
        model: opts.model,
        newSessionId: id,
        allowedDirs: [this.paths.root],
      });

      this.activeHandles.set(id, handle);

      // Subscribe to events
      handle.onLog((line, stream) => {
        this.bus.emit({ type: 'session:log', sessionId: id, line, stream });
        // Try to detect phase transitions from log output
        if (line.includes('[phase]')) {
          const phase = line.split('[phase]')[1]?.trim() ?? 'unknown';
          this.bus.emit({ type: 'session:status', sessionId: id, status: 'running', phase });
        }
      });

      // When process exits, update status
      handle.waitForExit().then(({ exitCode }) => {
        this.activeHandles.delete(id);
        const status: SessionStatus = exitCode === 0 ? 'completed' : 'failed';
        const updated = this.store.get(id);
        if (updated) {
          updated.emdesignStatus = status;
          updated.elapsedMs = Date.now() - updated.timestamp;
          this.store.upsert(updated);
        }
        this.bus.emit({
          type: 'session:completed',
          sessionId: id,
          error: exitCode !== 0 ? `exit code ${exitCode}` : undefined,
        });
      });

      // Update session with runtime info
      const running: EmSession = {
        ...session,
        emdesignStatus: 'running',
        pid: handle.pid,
        claudeSessionId: id,
      };
      this.store.upsert(running);
      this.bus.emit({ type: 'session:status', sessionId: id, status: 'running' });

      return running;
    } catch (err) {
      const failed: EmSession = {
        ...session,
        emdesignStatus: 'failed',
        error: (err as Error).message,
      };
      this.store.upsert(failed);
      return failed;
    }
  }

  async cancel(id: string): Promise<void> {
    const handle = this.activeHandles.get(id);
    if (handle) {
      await handle.cancel();
      this.activeHandles.delete(id);
    }
    const session = this.store.get(id);
    if (session) {
      session.emdesignStatus = 'cancelled';
      session.elapsedMs = Date.now() - session.timestamp;
      this.store.upsert(session);
    }
    this.bus.emit({ type: 'session:status', sessionId: id, status: 'cancelled' });
  }

  async resume(id: string): Promise<EmSession | null> {
    const session = this.store.get(id);
    if (!session || !session.claudeSessionId) return null;

    // Re-spawn with resumeSessionId
    const handle = await this.runner.spawn({
      def: claudeAdapter,
      cwd: this.paths.root,
      prompt: 'Resuming previous session...',
      model: undefined, // use existing
      resumeSessionId: session.claudeSessionId,
      allowedDirs: [this.paths.root],
    });

    this.activeHandles.set(id, handle);
    session.emdesignStatus = 'running';
    this.store.upsert(session);
    this.bus.emit({ type: 'session:status', sessionId: id, status: 'running' });

    return session;
  }

  get(id: string): EmSession | undefined {
    return this.store.get(id);
  }

  list(): EmSession[] {
    return this.store.list();
  }

  private buildWorkflowPrompt(opts: SessionCreateOptions): string {
    return `You are running an emdesign workflow. Your task is: ${opts.instruction ?? opts.type}.

You have access to the emdesign CLI. Use it to:
1. Get design context (emdesign design)
2. Create/edit components (emdesign serve at localhost:4321)
3. Run lint and visual tests (emdesign lint, emdesign visual-test)
4. Score and iterate

Follow the standard emdesign workflow: analyze → build → critique → gate.

Report your progress by logging [phase]: <phase-name> so the platform can track your progress.`;
  }
}
