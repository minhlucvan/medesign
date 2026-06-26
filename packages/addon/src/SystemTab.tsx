import React, { useEffect, useState } from 'react';
import { api } from './api';
import {
  useStudioState, Page, PageTitle, Sub, Grid2, Section, SectionTitle, Row, Stack, Muted, Pill, Mono, ErrorBanner,
} from './ui';
import type { HealthInfo, LogsResponse, GraphStats } from './constants';

/** The "medesign" tab: a system/status/logs dashboard — health, activity feed, evidence logs, graph. */
export function SystemTab() {
  const { state, error } = useStudioState(2000);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [logs, setLogs] = useState<LogsResponse | null>(null);
  const [graph, setGraph] = useState<GraphStats | null>(null);

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
    const t = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (error) return <Page><ErrorBanner error={error} /></Page>;

  return (
    <Page>
      <PageTitle>medesign</PageTitle>
      <Sub>system status · activity · logs</Sub>
      <Grid2>
        <Stack gap={12}>
          <Section>
            <SectionTitle>Status</SectionTitle>
            <Stack gap={6}>
              <Row gap={8}><Pill tone={health?.ok ? 'ok' : 'bad'}>{health?.ok ? 'backend up' : 'down'}</Pill><Muted>v{health?.version ?? '—'}</Muted></Row>
              <Row gap={8} wrap><Muted>active system</Muted><strong>{health?.activeDesignSystem ?? '—'}</strong></Row>
              <Row gap={8} wrap><Muted>component</Muted><strong>{health?.currentComponent ?? 'none'}</strong></Row>
              <Row gap={8}><Muted>lint</Muted>{state?.lintPassing == null ? <Muted>—</Muted> : <Pill tone={state.lintPassing ? 'ok' : 'bad'}>{state.lintPassing ? 'passing' : 'P0s'}</Pill>}</Row>
            </Stack>
          </Section>

          <Section>
            <SectionTitle>Graph</SectionTitle>
            {graph ? (
              <Stack gap={3}>
                <Row gap={8}><Muted>{graph.id}</Muted><Pill>{graph.stats.nodes ?? 0} nodes</Pill><Pill>{graph.stats.edges ?? 0} edges</Pill></Row>
                <Muted>{Object.entries(graph.stats).filter(([k]) => k.startsWith('node:')).map(([k, v]) => `${k.slice(5)} ${v}`).join(' · ') || '—'}</Muted>
              </Stack>
            ) : <Muted>no graph (build with <code>medesign graph build</code>)</Muted>}
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
      </Grid2>
    </Page>
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
