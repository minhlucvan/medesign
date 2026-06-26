import React, { useEffect, useState, useCallback } from 'react';
import { addons } from '@storybook/manager-api';
import { api } from './api';
import {
  useStudioState, Page, PageTitle, Sub, Section, SectionTitle, Row, Stack, Muted, Pill, Mono, ErrorBanner,
} from './ui';
import { EVT_CHARTER_RESULT } from './charters/channel';
import type { HealthInfo, LogsResponse, GraphStats, ServiceInfo, ServiceType, ServiceStatus } from './constants';
import type { CharterResultPayload } from './charters/channel';

/** The "emdesign" tab: a system/status/logs dashboard — health, activity feed, evidence logs, graph. */
export function SystemTab() {
  const { state, error } = useStudioState(2000);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [logs, setLogs] = useState<LogsResponse | null>(null);
  const [graph, setGraph] = useState<GraphStats | null>(null);
  const [services, setServices] = useState<Record<string, ServiceInfo> | null>(null);
  const [charterResult, setCharterResult] = useState<CharterResultPayload | null>(null);

  // Listen for charter evaluation results from the preview iframe
  useEffect(() => {
    const channel = addons.getChannel();
    const handler = (payload: CharterResultPayload) => setCharterResult(payload);
    channel.on(EVT_CHARTER_RESULT, handler);
    return () => { channel.off(EVT_CHARTER_RESULT, handler); };
  }, []);

  const loadServices = useCallback(async () => {
    try { setServices(await api.listServices()); } catch { /* not available */ }
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const h = await api.getHealth();
        if (!alive) return;
        setHealth(h);
        const [l, g] = await Promise.all([
          api.getLogs().catch(() => null),
          h.activeDesignSystem ? api.getGraphStats(h.activeDesignSystem).catch(() => null) : Promise.resolve(null),
        ]);
        if (!alive) return;
        setLogs(l);
        setGraph(g);
      } catch { /* backend down — useStudioState surfaces the error */ }
    };
    tick();
    loadServices();
    const t = setInterval(tick, 3000);
    const svc = setInterval(loadServices, 5000);
    return () => { alive = false; clearInterval(t); clearInterval(svc); };
  }, [loadServices]);

  if (error) return <Page><ErrorBanner error={error} /></Page>;

  return (
    <Page>
      <PageTitle>emdesign</PageTitle>
      <Sub>system status · activity · logs</Sub>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <Stack gap={12}>
          <Section>
            <SectionTitle>Status</SectionTitle>
            <Stack gap={6}>
              <Row gap={8}><Pill tone={health?.ok ? 'ok' : 'bad'}>{health?.ok ? 'backend up' : 'down'}</Pill><Muted>v{health?.version ?? '—'}</Muted></Row>
              <Row gap={8} wrap><Muted>active system</Muted><strong>{health?.activeDesignSystem ?? '—'}</strong></Row>
              <Row gap={8} wrap><Muted>component</Muted><strong>{health?.currentComponent ?? 'none'}</strong></Row>
              <Row gap={8}><Muted>lint</Muted>{state?.lintPassing == null ? <Muted>—</Muted> : <Pill tone={state.lintPassing ? 'ok' : 'bad'}>{state.lintPassing ? 'passing' : 'P0s'}</Pill>}</Row>
{charterResult && (
  <Row gap={8}>
    <Muted>charters</Muted>
    <Pill tone={charterResult.allPass ? 'ok' : 'bad'}>{charterResult.failed} fail / {charterResult.passed} pass</Pill>
  </Row>
)}
            </Stack>
          </Section>

          <Section>
            <SectionTitle>Graph</SectionTitle>
            {graph ? (
              <Stack gap={3}>
                <Row gap={8}><Muted>{graph.id}</Muted><Pill>{graph.stats.nodes ?? 0} nodes</Pill><Pill>{graph.stats.edges ?? 0} edges</Pill></Row>
                <Muted>{Object.entries(graph.stats).filter(([k]) => k.startsWith('node:')).map(([k, v]) => `${k.slice(5)} ${v}`).join(' · ') || '—'}</Muted>
              </Stack>
            ) : <Muted>no graph (build with <code>emdesign graph build</code>)</Muted>}
          </Section>

          <Section>
            <SectionTitle>Info</SectionTitle>
            <Stack gap={3}>
              <Muted>backend · {api ? 'http://localhost:4321' : ''}</Muted>
              <Muted>root · {health?.paths?.root ?? '—'}</Muted>
              <Muted>design systems · {health?.paths?.designSystems?.split('/').slice(-2).join('/') ?? '—'}</Muted>
              <Muted>generated · {health?.paths?.generated?.split('/').slice(-2).join('/') ?? '—'}</Muted>
            </Stack>
          </Section>
        </Stack>

        <Stack gap={12}>
          <ActivitySection state={state} />
          <Section>
            <SectionTitle>Logs · recent rounds</SectionTitle>
            {logs?.rounds?.length ? (
              <Stack gap={6}>
                {logs.rounds.map((r, i) => (
                  <Row key={`${r.slug}-${r.round}-${i}`} gap={8}>
                    <Pill tone={r.decision === 'ship' ? 'ok' : 'warn'}>{r.decision || '—'}</Pill>
                    <Muted style={{ flex: 1 }}><strong>{r.slug}</strong> · round {r.round} · composite {r.composite?.toFixed?.(2) ?? r.composite}{r.mustFix ? ` · ${r.mustFix} must-fix` : ''}</Muted>
                  </Row>
                ))}
              </Stack>
            ) : <Muted>no evidence yet (run a craft loop)</Muted>}
          </Section>
        </Stack>
      </div>

      {/* Services section — moved from standalone Services tab */}
      <Section style={{ marginTop: 16 }}>
        <SectionTitle>Services</SectionTitle>
        <Stack gap={6}>
          {services ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(Object.entries(services) as [ServiceType, ServiceInfo][]).map(([type, info]) => (
                <ServiceBadge key={type} type={type} info={info} onRefresh={loadServices} />
              ))}
            </div>
          ) : (
            <Muted>services unavailable (run with platform manager)</Muted>
          )}
        </Stack>
      </Section>
    </Page>
  );
}

const SERVICE_LABELS: Record<ServiceType, string> = {
  storybook: 'Storybook',
  'http-bridge': 'HTTP Bridge',
  'mcp-server': 'MCP Server',
  backend: 'Backend',
};

function serviceTone(status: ServiceStatus): 'ok' | 'bad' | 'warn' | 'muted' {
  switch (status) {
    case 'running': return 'ok';
    case 'starting': return 'warn';
    case 'stopping': return 'warn';
    case 'error':
    case 'crashed': return 'bad';
    case 'stopped': return 'muted';
  }
}

function ServiceBadge({ type, info, onRefresh }: { type: ServiceType; info: ServiceInfo; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setBusy(true);
    try {
      if (action === 'start') await api.startService(type);
      else if (action === 'stop') await api.stopService(type);
      else await api.restartService(type);
      await new Promise(r => setTimeout(r, 500)); // let status propagate
      onRefresh();
    } catch { /* ignore */ }
    setBusy(false);
  };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      borderRadius: 6,
      background: '#1a1a2e',
      border: '1px solid #2a2a3e',
      fontSize: 12,
    }}>
      <Pill tone={serviceTone(info.status)}>{info.status}</Pill>
      <strong style={{ color: '#ccc' }}>{SERVICE_LABELS[type]}</strong>
      {info.port && <Muted>:{info.port}</Muted>}
      <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
        {info.status === 'running' ? (
          <button onClick={() => handleAction('stop')} disabled={busy}
            style={{ background: 'none', border: '1px solid #555', color: '#f88', borderRadius: 3, padding: '1px 6px', cursor: 'pointer', fontSize: 10 }}>
            stop
          </button>
        ) : (
          <button onClick={() => handleAction('start')} disabled={busy}
            style={{ background: 'none', border: '1px solid #555', color: '#8f8', borderRadius: 3, padding: '1px 6px', cursor: 'pointer', fontSize: 10 }}>
            start
          </button>
        )}
        {info.status === 'running' && (
          <button onClick={() => handleAction('restart')} disabled={busy}
            style={{ background: 'none', border: '1px solid #555', color: '#ccc', borderRadius: 3, padding: '1px 6px', cursor: 'pointer', fontSize: 10 }}>
            restart
          </button>
        )}
      </div>
    </div>
  );
}

function ActivitySection({ state }: { state: ReturnType<typeof useStudioState>['state'] }) {
  const intents = state?.changeRequests ?? [];
  return (
    <Section>
      <SectionTitle>Activity · queue</SectionTitle>
      <Stack gap={6}>
        {intents.length === 0 && <Muted>nothing queued</Muted>}
        {intents.slice().reverse().map((cr) => (
          <Row key={cr.id} gap={8}>
            <Pill tone={cr.status === 'done' ? 'ok' : cr.status === 'error' ? 'bad' : cr.status === 'in_progress' ? 'warn' : 'muted'}>{cr.status}</Pill>
            <Muted style={{ flex: 1 }}><strong>{cr.type ?? 'change-request'}</strong>: {cr.instruction}{cr.target?.tag ? ` · ${cr.target.tag}` : ''}</Muted>
          </Row>
        ))}
      </Stack>
      {intents.some((cr) => cr.note) && (
        <Mono style={{ marginTop: 8, maxHeight: 120 }}>{intents.filter((cr) => cr.note).slice(-6).map((cr) => `${cr.id} → ${cr.note}`).join('\n')}</Mono>
      )}
    </Section>
  );
}
