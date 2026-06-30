/**
 * Service lifecycle manager.
 * Starts/stops/monitors child processes for Storybook, HTTP bridge, MCP server.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import type { RepoPaths, Store } from '@emdesign/backend';


import { PlatformEventBus } from './hooks.js';
import type { ServiceType, ServiceStatus, ServiceInfo, HealthCheckResult } from './types.js';

export class ProcessManager {
  private services: Map<ServiceType, { process: ChildProcess | null; info: ServiceInfo }> = new Map();
  private bus: PlatformEventBus;
  private paths: RepoPaths;
  private store: Store;
  private healthInterval: ReturnType<typeof setInterval> | null = null;

  constructor(bus: PlatformEventBus, paths: RepoPaths, store: Store) {
    this.bus = bus;
    this.paths = paths;
    this.store = store;

    // Initialize all services as stopped
    for (const type of ['storybook', 'http-bridge', 'backend'] as ServiceType[]) {
      this.services.set(type, {
        process: null,
        info: { type, status: 'stopped', restartCount: 0 },
      });
    }
  }

  private setStatus(type: ServiceType, status: ServiceStatus, extra?: Partial<ServiceInfo>): void {
    const entry = this.services.get(type);
    if (!entry) return;
    entry.info = { ...entry.info, ...extra, status };
    this.bus.emit({ type: 'service:status', service: type, status, info: extra });
  }

  async start(type: ServiceType): Promise<ServiceInfo> {
    const entry = this.services.get(type);
    if (entry?.info.status === 'running') return entry.info;

    this.setStatus(type, 'starting');

    try {
      switch (type) {
        case 'storybook':
          return await this.startStorybook();
        case 'http-bridge':
          return await this.startHttpBridge();
        case 'backend':
          return await this.startBackend();
      }
    } catch (err) {
      this.setStatus(type, 'error', {});
      console.error(`[emdesign/session] Failed to start ${type}:`, err);
      return this.services.get(type)!.info;
    }
  }

  private async startStorybook(): Promise<ServiceInfo> {
    // Detect workspace directory for Storybook
    const wsReact = path.resolve(this.paths.root, 'apps/workspace-react');
    const cwd = fs.existsSync(wsReact) ? wsReact : this.paths.root;

    const port = 6006;
    const child = spawn('npx', ['storybook', 'dev', '-p', String(port)], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    child.stdout?.on('data', (data: Buffer) => {
      const log = data.toString();
      if (log.includes('Storybook started') || log.includes('Local:')) {
        this.setStatus('storybook', 'running', { pid: child.pid, port });
      }
    });

    child.on('exit', (code) => {
      if (this.services.get('storybook')?.info.status === 'running') {
        this.setStatus('storybook', 'crashed', {});
      }
    });

    const entry = this.services.get('storybook')!;
    entry.process = child;
    entry.info = {
      type: 'storybook',
      status: 'starting',
      pid: child.pid,
      port,
      startedAt: new Date().toISOString(),
      restartCount: entry.info.restartCount,
    };
    return entry.info;
  }

  private async startHttpBridge(): Promise<ServiceInfo> {
    const { startHttpBridge } = await import('@emdesign/backend');
    const port = Number(process.env.EMDESIGN_PORT ?? 4321);

    const server = await startHttpBridge(this.store, this.paths, port);

    this.setStatus('http-bridge', 'running', { port, pid: process.pid });
    return this.services.get('http-bridge')!.info;
  }

  private async startBackend(): Promise<ServiceInfo> {
    // Start all services
    await Promise.all([
      this.start('http-bridge'),
      this.start('storybook'),
    ]);
    this.setStatus('backend', 'running');
    return this.services.get('backend')!.info;
  }

  async stop(type: ServiceType): Promise<void> {
    const entry = this.services.get(type);
    if (!entry?.process) {
      this.setStatus(type, 'stopped');
      return;
    }

    this.setStatus(type, 'stopping');
    entry.process.kill('SIGTERM');

    // Wait briefly for graceful shutdown
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (entry.process?.killed === false) {
          entry.process?.kill('SIGKILL');
        }
        resolve();
      }, 3000);

      entry.process?.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    entry.process = null;
    this.setStatus(type, 'stopped');
  }

  async restart(type: ServiceType): Promise<ServiceInfo> {
    await this.stop(type);
    return this.start(type);
  }

  async healthCheck(type: ServiceType): Promise<HealthCheckResult> {
    const entry = this.services.get(type);
    const at = new Date().toISOString();

    if (!entry || entry.info.status !== 'running') {
      return { ok: false, at, error: 'not running' };
    }

    switch (type) {
      case 'http-bridge': {
        const port = entry.info.port ?? 4321;
        try {
          const start = Date.now();
          const res = await fetch(`http://localhost:${port}/api/health`, {
            signal: AbortSignal.timeout(2000),
          });
          return { ok: res.ok, at, statusCode: res.status, latencyMs: Date.now() - start };
        } catch (err) {
          return { ok: false, at, error: (err as Error).message };
        }
      }
      case 'storybook': {
        try {
          const start = Date.now();
          const res = await fetch(`http://localhost:${entry.info.port ?? 6006}`, {
            signal: AbortSignal.timeout(2000),
          });
          return { ok: res.ok, at, statusCode: res.status, latencyMs: Date.now() - start };
        } catch {
          // Process-based check
          return { ok: entry.process !== null && !entry.process.killed, at };
        }
      }
      default:
        return { ok: entry.process !== null && !entry.process.killed, at };
    }
  }

  startHealthChecks(intervalMs = 10000): void {
    if (this.healthInterval) clearInterval(this.healthInterval);

    this.healthInterval = setInterval(async () => {
      for (const [type, entry] of this.services) {
        if (entry.info.status === 'running') {
          const result = await this.healthCheck(type);
          if (!result.ok) {
            console.error(`[emdesign/session] Health check failed for ${type}: ${result.error}`);
            this.setStatus(type, 'error');
            // Auto-restart with backoff
            if (entry.info.restartCount < 3) {
              setTimeout(() => this.start(type), entry.info.restartCount * 5000);
            }
          }
        }
      }
    }, intervalMs);
  }

  stopHealthChecks(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  get(type: ServiceType): ServiceInfo {
    return this.services.get(type)?.info ?? { type, status: 'stopped', restartCount: 0 };
  }

  list(): Record<ServiceType, ServiceInfo> {
    const result: any = {};
    for (const [type, entry] of this.services) {
      result[type] = entry.info;
    }
    return result as Record<ServiceType, ServiceInfo>;
  }

  /** Graceful shutdown of all managed processes */
  async shutdown(): Promise<void> {
    this.stopHealthChecks();
    await Promise.all(
      Array.from(this.services.keys()).map((type) => this.stop(type).catch(() => {}))
    );
  }
}
