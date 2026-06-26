import fs from 'node:fs';
import { ensureDir, type RepoPaths } from './paths.js';

export type ChangeRequestStatus = 'queued' | 'in_progress' | 'done' | 'error';

/** The kinds of work the browser can request; the agent routes each via /mds:inbox. */
export type IntentType =
  | 'change-request'
  | 'comment'
  | 'edit-text'
  | 'create-component'
  | 'create-story'
  | 'create-view'
  | 'create-design-system'
  | 'update-design-system';

/** A pointed-at element captured by the preview overlay (for `comment` intents). */
export interface CommentTarget {
  selector: string;
  box?: { x: number; y: number; width: number; height: number };
  text?: string;
  tag?: string;
  classes?: string;
  storyId?: string;
  component?: string;
  cropUrl?: string;
}

/** A unit of work in the queue (a "change request" is just type `change-request`). */
export interface ChangeRequest {
  id: string;
  /** Defaults to `change-request` for back-compat. */
  type?: IntentType;
  instruction: string;
  status: ChangeRequestStatus;
  createdAt: string;
  /** For `comment` intents: the pointed-at element. */
  target?: CommentTarget;
  /** Type-specific extras (e.g. { id, name, mode } for create-design-system). */
  payload?: Record<string, unknown>;
  /** Set by the agent when it finishes acting on this request. */
  note?: string;
}

export interface DiffResult {
  status: 'pass' | 'changed' | 'new' | 'error';
  baselinePng?: string;
  actualPng?: string;
  diffPng?: string;
  changedPixels?: number;
}

/**
 * The single source of truth shared between the MCP tools (driven by the agent) and the
 * HTTP bridge (read by the Storybook addon panel). Persisted as plain JSON in the repo so
 * the loop survives restarts and is inspectable/diffable.
 */
export interface Critique {
  scores: Record<string, number>;
  composite: number;
  decision: string;
  mustFix: number;
}

export interface StudioState {
  activeDesignSystem: string | null;
  currentComponent: string | null;
  changeRequests: ChangeRequest[];
  lastDiff: DiffResult | null;
  lintPassing: boolean | null;
  /** Latest combined critique (the four feedback scores + gate decision) for the panel. */
  lastCritique: Critique | null;
}

const EMPTY: StudioState = {
  activeDesignSystem: null,
  currentComponent: null,
  changeRequests: [],
  lastDiff: null,
  lintPassing: null,
  lastCritique: null,
};

export class Store {
  private state: StudioState;
  private seq = 0;
  private mtimeMs = 0;

  constructor(private paths: RepoPaths) {
    this.state = this.load();
  }

  private load(): StudioState {
    try {
      const raw = fs.readFileSync(this.paths.stateFile, 'utf8');
      this.mtimeMs = fs.statSync(this.paths.stateFile).mtimeMs;
      return { ...EMPTY, ...JSON.parse(raw) };
    } catch {
      return { ...EMPTY };
    }
  }

  private persist(): void {
    ensureDir(this.paths.medesignDir);
    fs.writeFileSync(this.paths.stateFile, JSON.stringify(this.state, null, 2));
    try { this.mtimeMs = fs.statSync(this.paths.stateFile).mtimeMs; } catch { /* ignore */ }
  }

  get(): StudioState {
    // Cross-process sync: the MCP agent (a separate process) and the HTTP bridge share this file.
    // If it changed underneath us (agent drained an intent, edited a component), reload so the panel reflects it.
    try {
      const m = fs.statSync(this.paths.stateFile).mtimeMs;
      if (m > this.mtimeMs) this.state = this.load();
    } catch { /* no file yet */ }
    return this.state;
  }

  update(patch: Partial<StudioState>): StudioState {
    this.state = { ...this.state, ...patch };
    this.persist();
    return this.state;
  }

  /** Enqueue a typed intent (the general queue primitive). */
  enqueueIntent(intent: { type?: IntentType; instruction: string; target?: CommentTarget; payload?: Record<string, unknown> }): ChangeRequest {
    const cr: ChangeRequest = {
      id: `cr_${Date.now()}_${this.seq++}`,
      type: intent.type ?? 'change-request',
      instruction: intent.instruction,
      status: 'queued',
      createdAt: new Date().toISOString(),
      ...(intent.target ? { target: intent.target } : {}),
      ...(intent.payload ? { payload: intent.payload } : {}),
    };
    this.state.changeRequests = [...this.state.changeRequests, cr];
    this.persist();
    return cr;
  }

  /** Back-compat shim: a plain free-text change request. */
  enqueueChangeRequest(instruction: string): ChangeRequest {
    return this.enqueueIntent({ type: 'change-request', instruction });
  }

  setChangeRequestStatus(id: string, status: ChangeRequestStatus, note?: string): void {
    this.state.changeRequests = this.state.changeRequests.map((cr) =>
      cr.id === id ? { ...cr, status, ...(note ? { note } : {}) } : cr,
    );
    this.persist();
  }

  /** The next request the agent should act on, if any. */
  nextQueued(): ChangeRequest | undefined {
    return this.state.changeRequests.find((cr) => cr.status === 'queued');
  }
}
