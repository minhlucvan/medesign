/**
 * Core types for session and process management.
 */
import type { StudioState, Store } from '@emdesign/backend';
import type { EmSession, WorkflowType, SessionStatus } from './storage.js';
import type { AgentHandle } from './AgentRunner.js';

// ── Service Types ──────────────────────────────────────────────────

export type ServiceType = 'storybook' | 'http-bridge' | 'backend';
export type ServiceStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'crashed';

export interface ServiceInfo {
  type: ServiceType;
  status: ServiceStatus;
  pid?: number;
  port?: number;
  startedAt?: string;
  restartCount: number;
  command?: string;
}

export interface HealthCheckResult {
  ok: boolean;
  at: string;
  statusCode?: number;
  error?: string;
  latencyMs?: number;
}

// ── Session Create Options ─────────────────────────────────────────

export interface SessionCreateOptions {
  type: WorkflowType;
  workflow: string;
  args: Record<string, unknown>;
  model?: string;
  resumeSessionId?: string;
  instruction?: string;
  /** Conversation scope: 'global' or 'story:<storyId>' */
  scope?: string;
  /** Conversation origin: 'chat' or 'comment' */
  origin?: 'chat' | 'comment';
  /** Element context from a comment submission */
  elementContext?: {
    selector: string;
    tag: string;
    text?: string;
    component?: string;
    box?: { x: number; y: number; width: number; height: number };
  };
}

// ── Platform State ─────────────────────────────────────────────────

export interface PlatformState {
  claudeSessions: EmSession[];
  emdesignSessions: EmSession[];
  services: Record<ServiceType, ServiceInfo>;
  studio: StudioState;
}

// ── Orchestrator Interface ─────────────────────────────────────────

export interface PlatformOrchestrator {
  // Read-side
  getClaudeSessions(): Promise<EmSession[]>;
  getConversation(sessionId: string): Promise<any[]>;
  getProjects(): Promise<string[]>;

  // Write-side session management
  createSession(opts: SessionCreateOptions): Promise<EmSession>;
  cancelSession(id: string): Promise<void>;
  resumeSession(id: string): Promise<void>;
  getSession(id: string): EmSession | undefined;
  listSessions(): EmSession[];

  // Service management
  startService(type: ServiceType): Promise<ServiceInfo>;
  stopService(type: ServiceType): Promise<void>;
  restartService(type: ServiceType): Promise<ServiceInfo>;
  getService(type: ServiceType): ServiceInfo;
  listServices(): Record<ServiceType, ServiceInfo>;

  // Platform state
  getState(): PlatformState;

  // Events
  on(event: string, handler: (e: any) => void): () => void;

  // Access to underlying managers
  getStore(): Store;
}
