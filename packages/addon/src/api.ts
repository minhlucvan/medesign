import {
  BACKEND_URL,
  type StudioState,
  type IntentType,
  type DesignSystemSummary,
  type DesignSystemDetail,
  type DesignSystemFull,
  type DesignSystemBase,
  type LogsResponse,
  type HealthInfo,
  type GraphStats,
  type SessionListResponse,
  type SessionSummary,
  type ServiceInfo,
  type PlatformState,
  type ServiceType,
} from './constants';
import type { CommentTarget } from './channel';

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`emdesign backend ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

const post = (path: string, body: unknown) => json(path, { method: 'POST', body: JSON.stringify(body) });

export interface IntentInput {
  type: IntentType;
  instruction: string;
  target?: CommentTarget;
  payload?: Record<string, unknown>;
}

export const api = {
  getState: () => json<StudioState>('/api/state'),
  submitIntent: (intent: IntentInput) => post('/api/intent', intent) as Promise<StudioState>,
  submitChangeRequest: (instruction: string) => post('/api/change-request', { instruction }) as Promise<StudioState>,
  capture: (name: string) => post('/api/capture', { name }) as Promise<{ ok: boolean; path: string }>,
  runVisualTest: (component: string) => post('/api/visual-test', { component }) as Promise<StudioState>,

  // design-system management
  listDesignSystems: () => json<{ active: string | null; systems: DesignSystemSummary[] }>('/api/design-systems'),
  getDesignSystem: (id: string) => json<DesignSystemDetail>(`/api/design-system/${id}`),
  getDesignSystemFull: (id: string) => json<DesignSystemFull>(`/api/design-system/${id}/full`),
  useDesignSystem: (id: string) => post('/api/use', { id }) as Promise<{ id: string; note: string }>,

  // create-wizard + system tab data
  listBases: () => json<{ bases: DesignSystemBase[] }>('/api/bases'),
  getLogs: () => json<LogsResponse>('/api/logs'),
  getHealth: () => json<HealthInfo>('/api/health'),
  getGraphStats: (id: string) => json<GraphStats>(`/api/graph/${id}/stats`),

  // element crop for a captured comment target
  elementCrop: (component: string, box: CommentTarget['box']) =>
    post('/api/element-crop', { component, box }) as Promise<{ url: string | null }>,

  // ── Session management ──────────────────────────────────────────────
  listSessions: () => json<SessionListResponse>('/api/sessions'),
  createSession: (body: { type: string; instruction?: string }) =>
    post('/api/sessions', body) as Promise<SessionSummary>,
  cancelSession: (id: string) =>
    post(`/api/sessions/${id}/cancel`, {}) as Promise<{ ok: boolean }>,
  getSessionConversation: (id: string) =>
    json<unknown[]>(`/api/sessions/${id}/conversation`),

  // ── Service management ──────────────────────────────────────────────
  listServices: () => json<Record<string, ServiceInfo>>('/api/services'),
  startService: (type: ServiceType) =>
    post(`/api/services/${type}/start`, {}) as Promise<ServiceInfo>,
  stopService: (type: ServiceType) =>
    post(`/api/services/${type}/stop`, {}) as Promise<{ ok: boolean }>,
  restartService: (type: ServiceType) =>
    post(`/api/services/${type}/restart`, {}) as Promise<ServiceInfo>,

  // ── Comment pins ────────────────────────────────────────────────────
  storeComment: (data: { storyId: string; selector: string; text?: string; tag?: string; component?: string; sessionId: string }) =>
    post('/api/comments', data) as Promise<{ ok: boolean; pin: unknown }>,
  getComments: (storyId: string) =>
    json<{ pins: Array<{ n: number; selector: string; text: string; tag?: string; component?: string; storyId: string; sessionId: string; createdAt: string }> }>(`/api/comments?storyId=${encodeURIComponent(storyId)}`),

  // ── Platform status ─────────────────────────────────────────────────
  getPlatformStatus: () => json<PlatformState>('/api/platform/status'),
};
