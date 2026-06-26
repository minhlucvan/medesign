export const ADDON_ID = 'emdesign';
export const PANEL_ID = `${ADDON_ID}/panel`;
export const TAB_ID = `${ADDON_ID}/tab`;
export const DS_TAB_ID = `${ADDON_ID}/ds`;
export const CREATE_TAB_ID = `${ADDON_ID}/create`;
export const TOOL_ID = `${ADDON_ID}/tool`;
export const SESSIONS_TAB_ID = `${ADDON_ID}/sessions`;
export const SERVICES_TAB_ID = `${ADDON_ID}/services`;

/** Each full-page tab owns a viewMode + route (so it's a top-level surface, not docked). */
export const VIEW_MODE_SYSTEM = 'emdesign';
export const VIEW_MODE_DS = 'emdesign-ds';
export const VIEW_MODE_CREATE = 'emdesign-create';
export const VIEW_MODE_SESSIONS = 'emdesign-sessions';
export const VIEW_MODE_SERVICES = 'emdesign-services';

/**
 * The emdesign Studio backend HTTP bridge. The addon (browser) talks to the backend over
 * this API; the agent drives generation through the backend's MCP tools. They share one
 * state store, so the panel reflects whatever the agent is doing in real time.
 */
export const BACKEND_URL =
  (typeof process !== 'undefined' && process.env?.EMDESIGN_BACKEND_URL) ||
  'http://localhost:4321';

export type IntentType =
  | 'change-request'
  | 'comment'
  | 'edit-text'
  | 'create-component'
  | 'create-story'
  | 'create-view'
  | 'create-design-system'
  | 'update-design-system';

// ── Chat mode definitions for the New Conversation picker ──────────────

export type ChatStartMode =
  | 'chat'
  | 'update-story'
  | 'new-story'
  | 'new-component'
  | 'change-request';

export interface ChatModeOption {
  id: ChatStartMode;
  label: string;
  description: string;
  intentType: IntentType | null;
  icon: string;
}

export const CHAT_MODES: ChatModeOption[] = [
  { id: 'chat',           label: 'Chat',            description: 'Free-form conversation',               intentType: null,                  icon: '💬' },
  { id: 'change-request', label: 'Change Request',  description: 'Request a design change',             intentType: 'change-request',      icon: '✏️' },
  { id: 'new-component',  label: 'New Component',   description: 'Scaffold a new React component',      intentType: 'create-component',    icon: '🧩' },
  { id: 'new-story',      label: 'New Story',       description: 'Create a new story for a component',  intentType: 'create-story',        icon: '📖' },
  { id: 'update-story',   label: 'Update Story',    description: 'Request changes to an existing story',intentType: 'change-request',      icon: '🔄' },
];

export type ChangeRequest = {
  id: string;
  type?: IntentType;
  instruction: string;
  status: 'queued' | 'in_progress' | 'done' | 'error';
  createdAt: string;
  target?: import('./channel').CommentTarget;
  payload?: Record<string, unknown>;
  note?: string;
};

export type DesignSystemSummary = { id: string; name: string };
export type DesignSystemDetail = {
  id: string;
  name: string;
  tokens: Array<{ role: string; kind: string; value: string }>;
  components: string[];
  sections: string[];
  validation: { ok: boolean; diagnostics: unknown[] };
  conflicts: number;
};

export type DiffResult = {
  status: 'pass' | 'changed' | 'new' | 'error';
  baselinePng?: string;
  actualPng?: string;
  diffPng?: string;
  changedPixels?: number;
};

export type Critique = {
  scores: Partial<Record<'visual' | 'tokens' | 'vision' | 'llm' | 'a11y', number>>;
  composite: number;
  decision: string;
  mustFix: number;
};

export type StudioState = {
  activeDesignSystem: string | null;
  currentComponent: string | null;
  changeRequests: ChangeRequest[];
  lastDiff: DiffResult | null;
  lintPassing: boolean | null;
  lastCritique: Critique | null;
};

export type Diagnostic = {
  ruleId: string;
  severity: 'P0' | 'P1' | 'P2';
  message: string;
  scope?: string;
  target?: string;
  where?: { file: string; line?: number };
  fix?: string;
};

export type Conflict = {
  kind: string;
  severity: 'P0' | 'P1' | 'P2';
  message: string;
  subjects: string[];
};

/** Rich detail for the Design System tab (/api/design-system/:id/full). */
export type DesignSystemFull = {
  id: string;
  name: string;
  tokens: Array<{ role: string; kind: string; value: string }>;
  components: string[];
  sections: string[];
  validation: { ok: boolean; diagnostics: Diagnostic[] };
  conflicts: Conflict[];
  manifest: Record<string, unknown> | null;
  designMd: string;
  tokensCss: string;
};

/** A prebuilt base the Create wizard can clone (/api/bases). */
export type DesignSystemBase = {
  id: string;
  ref: string;
  name: string;
  category?: string;
  surface?: string;
  description?: string;
  source?: { type: string; skill?: string; upstream?: string; license?: string };
};

export type EvidenceRound = {
  slug: string;
  round: number;
  scores: Record<string, number>;
  mustFix: number;
  composite: number;
  decision: string;
  mtime: number;
};

export type LogsResponse = { rounds: EvidenceRound[]; activity: ChangeRequest[] };

export type HealthInfo = {
  ok: boolean;
  name: string;
  version: string;
  activeDesignSystem: string | null;
  currentComponent: string | null;
  lintPassing: boolean | null;
  paths: { root: string; designSystems: string; generated: string };
};

export type GraphStats = { id: string; stats: Record<string, number> };

// ── Session / Service types ────────────────────────────────────────

export type SessionStatus = 'created' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type ServiceStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'crashed';
export type ServiceType = 'storybook' | 'http-bridge' | 'mcp-server' | 'backend';

export interface SessionSummary {
  id: string;
  display: string;
  timestamp: number;
  project: string;
  projectName: string;
  emdesignStatus?: SessionStatus;
  emdesignType?: string;
  currentPhase?: string;
  currentRound?: number;
  intentsProcessed?: number;
  elapsedMs?: number;
}

export interface ServiceInfo {
  type: ServiceType;
  status: ServiceStatus;
  pid?: number;
  port?: number;
  startedAt?: string;
  restartCount: number;
}

export interface PlatformState {
  claudeSessions: SessionSummary[];
  emdesignSessions: SessionSummary[];
  services: Record<ServiceType, ServiceInfo>;
}

export interface SessionListResponse {
  claudeSessions: SessionSummary[];
  emdesignSessions: SessionSummary[];
}
