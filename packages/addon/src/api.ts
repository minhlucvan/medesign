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
} from './constants';
import type { CommentTarget } from './channel';

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`medesign backend ${res.status}: ${await res.text()}`);
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
};
