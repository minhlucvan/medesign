/**
 * FromProjectCreator — the System-tab "From Existing Project" creator path.
 *
 * Unit 06 of `ds-from-existing-project`. Implementation-only (no spec
 * contract): a display client over the read-only `design-surface-api`. It
 * collects a project-path / current-workspace input, starts the adoption flow,
 * then subscribes to the workflow SSE to render live stage progress with the
 * intermediate artifacts as they arrive.
 */

import React, { useEffect, useRef, useState } from 'react';
import { getWorkflowStreamUrl } from '../api';

export type ProjectStageStatus = 'started' | 'completed' | 'failed';

export interface ProjectStageArtifact {
  label: string;
  value: string;
}

export interface ProjectStageEvent {
  name: string;
  status: ProjectStageStatus;
  artifact?: ProjectStageArtifact;
  reason?: string;
}

export interface StartAdoptionArgs {
  projectPath: string;
  useCurrentWorkspace: boolean;
}

export interface StartAdoptionResult {
  sessionId: string;
}

export interface FromProjectCreatorProps {
  /** Starts the adoption flow; resolves to the workflow session id. */
  start: (args: StartAdoptionArgs) => Promise<StartAdoptionResult>;
  /**
   * Live stage events. When provided (e.g. in tests, or hoisted by a parent)
   * these are rendered directly; otherwise they accumulate from the SSE stream.
   */
  stages?: ProjectStageEvent[];
}

const statusIcon: Record<ProjectStageStatus, string> = {
  started: '↻',
  completed: '✓',
  failed: '✗',
};

function StageProgress({ stages }: { stages: ProjectStageEvent[] }) {
  if (stages.length === 0) return null;
  return (
    <div data-testid="stage-progress" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
      {stages.map((s, i) => (
        <div
          key={`${s.name}-${i}`}
          data-testid="stage-item"
          data-stage={s.name}
          data-status={s.status}
          style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0' }}
        >
          <span>
            <span aria-hidden style={{ width: 16, display: 'inline-block' }}>{statusIcon[s.status]}</span>
            {s.name}
          </span>
          {s.artifact && (
            <span data-testid="stage-artifact" style={{ fontSize: 12, opacity: 0.8 }}>
              {s.artifact.label}: {s.artifact.value}
            </span>
          )}
          {s.status === 'failed' && s.reason && (
            <span data-testid="stage-reason" style={{ fontSize: 12, color: '#e03' }}>{s.reason}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function FromProjectCreator({ start, stages }: FromProjectCreatorProps) {
  const [projectPath, setProjectPath] = useState('');
  const [useCurrentWorkspace, setUseCurrentWorkspace] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [liveStages, setLiveStages] = useState<ProjectStageEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const handleStart = async () => {
    const path = projectPath.trim();
    if (!useCurrentWorkspace && !path) return;
    try {
      const result = await start({ projectPath: path, useCurrentWorkspace });
      if (result?.sessionId) setSessionId(result.sessionId);
    } catch {
      /* parent surfaces errors */
    }
  };

  // Subscribe to the workflow SSE once a session is running. Guarded so the
  // component is safe in environments without EventSource (jsdom/tests).
  useEffect(() => {
    if (!sessionId || typeof EventSource === 'undefined') return;
    const url = getWorkflowStreamUrl(sessionId);
    if (!url) return;
    const es = new EventSource(url);
    esRef.current = es;
    es.addEventListener('stage', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ProjectStageEvent;
        setLiveStages((prev) => [...prev, data]);
      } catch {
        /* ignore malformed */
      }
    });
    es.addEventListener('done', () => es.close());
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [sessionId]);

  const shown = stages ?? liveStages;
  const canStart = useCurrentWorkspace || projectPath.trim().length > 0;

  return (
    <div data-testid="from-project-creator" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 600 }}>From Existing Project</div>
      <input
        data-testid="project-path-input"
        type="text"
        value={projectPath}
        disabled={useCurrentWorkspace}
        placeholder="/path/to/project"
        onChange={(e) => setProjectPath(e.target.value)}
      />
      <button
        data-testid="use-current-workspace"
        type="button"
        aria-pressed={useCurrentWorkspace}
        onClick={() => setUseCurrentWorkspace((v) => !v)}
      >
        Use current workspace{useCurrentWorkspace ? ' ✓' : ''}
      </button>
      <button
        data-testid="start-adoption"
        type="button"
        disabled={!canStart}
        onClick={handleStart}
      >
        Start adoption
      </button>
      <StageProgress stages={shown} />
    </div>
  );
}

export default FromProjectCreator;
