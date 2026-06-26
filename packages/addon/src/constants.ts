export const ADDON_ID = 'medesign';
export const PANEL_ID = `${ADDON_ID}/panel`;
export const TAB_ID = `${ADDON_ID}/tab`;
export const DS_TAB_ID = `${ADDON_ID}/ds`;
export const CREATE_TAB_ID = `${ADDON_ID}/create`;
export const TOOL_ID = `${ADDON_ID}/tool`;

/** Each full-page tab owns a viewMode + route (so it's a top-level surface, not docked). */
export const VIEW_MODE_SYSTEM = 'medesign';
export const VIEW_MODE_DS = 'medesign-ds';
export const VIEW_MODE_CREATE = 'medesign-create';

/**
 * The medesign Studio backend HTTP bridge. The addon (browser) talks to the backend over
 * this API; the agent drives generation through the backend's MCP tools. They share one
 * state store, so the panel reflects whatever the agent is doing in real time.
 */
export const BACKEND_URL =
  (typeof process !== 'undefined' && process.env?.MEDESIGN_BACKEND_URL) ||
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
