import React, { useCallback, useEffect, useState } from 'react';
import { useStorybookApi } from '@storybook/manager-api';
import { styled } from '@storybook/theming';
import { api } from './api';
import {
  useStudioState, Page, Wrap, PageTitle, Sub, Section, SectionTitle, Row, Stack, Muted, Btn, Input, Pill, Chip, Swatch, Mono, sevTone, ErrorBanner,
} from './ui';
import { VIEW_MODE_CREATE } from './constants';
import type { DesignSystemSummary, DesignSystemFull } from './constants';

const TokenGrid = styled.div({ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 });
const TokenCard = styled.div(({ theme }) => ({
  display: 'flex', alignItems: 'center', gap: 10,
  border: `1px solid ${theme.appBorderColor}`, borderRadius: theme.appBorderRadius,
  background: theme.background.app, padding: '7px 9px', minWidth: 0,
}));
const BigSwatch = styled(Swatch)({ width: 26, height: 26, borderRadius: 5 });
const Role = styled.div(({ theme }) => ({ font: `600 11px ${theme.typography.fonts.mono}`, color: theme.color.defaultText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }));
const Val = styled.div(({ theme }) => ({ font: `11px ${theme.typography.fonts.mono}`, color: theme.textMutedColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }));

/** The "System" tab: pick a design system, inspect it deeply (tokens · diagnostics · conflicts ·
 *  manifest · raw source), switch it, or request a change. Vertical, single-column layout. */
export function DesignSystemTab() {
  const { error, refresh } = useStudioState(3000);
  const sbApi = useStorybookApi();
  const [systems, setSystems] = useState<DesignSystemSummary[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DesignSystemFull | null>(null);
  const [req, setReq] = useState('');
  const [showRaw, setShowRaw] = useState<'none' | 'design' | 'tokens'>('none');

  const loadSystems = useCallback(async () => {
    try {
      const r = await api.listDesignSystems();
      setSystems(r.systems);
      setActive(r.active);
      setSelected((s) => s ?? r.active ?? r.systems[0]?.id ?? null);
    } catch { /* down */ }
  }, []);
  useEffect(() => { loadSystems(); }, [loadSystems]);
  useEffect(() => { if (selected) api.getDesignSystemFull(selected).then(setDetail).catch(() => setDetail(null)); }, [selected]);

  const use = async (id: string) => { await api.useDesignSystem(id); await loadSystems(); refresh(); };
  const openCreate = () => {
    const storyId = (sbApi as any)?.getUrlState?.().storyId ?? '*';
    try { (sbApi as any)?.navigateUrl?.(`/${VIEW_MODE_CREATE}/${storyId}`, { plain: false }); } catch { /* top-bar tab */ }
  };

  if (error) return <Page><ErrorBanner error={error} /></Page>;

  const byKind = (detail?.tokens ?? []).reduce<Record<string, DesignSystemFull['tokens']>>((a, t) => { (a[t.kind] ??= []).push(t); return a; }, {});
  const manifest = (detail?.manifest ?? {}) as Record<string, any>;
  const diagnostics = detail?.validation.diagnostics ?? [];
  const conflicts = detail?.conflicts ?? [];

  return (
    <Page>
      <Wrap>
        <PageTitle>Design System</PageTitle>
        <Sub>browse · inspect · switch · request changes</Sub>

        {/* Picker — horizontal chips (active system marked with a dot) */}
        <Row gap={8} wrap style={{ marginBottom: 16 }}>
          {systems.map((s) => (
            <Chip key={s.id} selected={selected === s.id} onClick={() => setSelected(s.id)}>
              {active === s.id && <span style={{ width: 6, height: 6, borderRadius: 999, background: '#3fb950', display: 'inline-block' }} />}
              {s.name}
            </Chip>
          ))}
          <Btn onClick={openCreate}>+ New</Btn>
          {systems.length === 0 && <Muted>none — create one →</Muted>}
        </Row>

        {detail ? (
          <Stack gap={14}>
            {/* Header */}
            <Section>
              <Row gap={10} wrap>
                <div style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>{detail.name}</div>
                <Pill tone={detail.validation.ok ? 'ok' : 'bad'}>{detail.validation.ok ? 'valid' : 'invalid'}</Pill>
                {conflicts.length > 0 && <Pill tone="warn">{conflicts.length} conflicts</Pill>}
                {active === detail.id ? <Pill tone="ok">active</Pill> : <Btn primary onClick={() => use(detail.id)}>Use this system</Btn>}
              </Row>
              {manifest.category && <Muted style={{ display: 'block', marginTop: 6 }}>{manifest.category}{manifest.description ? ` — ${manifest.description}` : ''}</Muted>}
              <Row gap={6} wrap style={{ marginTop: 8 }}>
                <Pill>{detail.components.length} components</Pill>
                <Pill>{detail.sections.length} sections</Pill>
                <Pill>{detail.tokens.length} tokens</Pill>
                {manifest.source && <Pill>via {manifest.source.skill ?? manifest.source.type}</Pill>}
              </Row>
              <Muted style={{ display: 'block', marginTop: 8 }}>{detail.components.join(' · ') || '—'}</Muted>
              <Row gap={8} style={{ marginTop: 12 }}>
                <Input value={req} onChange={(e) => setReq(e.target.value)} placeholder="request a change to this system… e.g. shift the accent warmer"
                  onKeyDown={(e) => { if (e.key === 'Enter' && req.trim()) { api.submitIntent({ type: 'update-design-system', instruction: req.trim(), payload: { id: detail.id } }).then(refresh); setReq(''); } }} />
                <Btn primary disabled={!req.trim()} onClick={() => { api.submitIntent({ type: 'update-design-system', instruction: req.trim(), payload: { id: detail.id } }).then(refresh); setReq(''); }}>Request</Btn>
              </Row>
            </Section>

            {/* Tokens */}
            <Section>
              <SectionTitle>Tokens</SectionTitle>
              <Stack gap={12}>
                {Object.entries(byKind).map(([kind, toks]) => (
                  <div key={kind}>
                    <Muted style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, display: 'block', marginBottom: 6 }}>{kind} · {toks.length}</Muted>
                    <TokenGrid>
                      {toks.map((t) => (
                        <TokenCard key={t.role} title={`--${t.role}: ${t.value}`}>
                          {kind === 'color' && <BigSwatch color={t.value} />}
                          <div style={{ minWidth: 0 }}>
                            <Role>--{t.role}</Role>
                            <Val>{t.value}</Val>
                          </div>
                        </TokenCard>
                      ))}
                    </TokenGrid>
                  </div>
                ))}
              </Stack>
            </Section>

            {/* Diagnostics & conflicts */}
            {(diagnostics.length > 0 || conflicts.length > 0) && (
              <Section>
                <SectionTitle>Diagnostics &amp; conflicts</SectionTitle>
                <Stack gap={6}>
                  {diagnostics.map((d, i) => (
                    <Row key={`d${i}`} gap={8}>
                      <Pill tone={sevTone(d.severity)}>{d.severity}</Pill>
                      <Muted style={{ flex: 1 }}>{d.message}{d.where ? ` · ${d.where.file}${d.where.line ? `:${d.where.line}` : ''}` : ''}{d.fix ? ` — fix: ${d.fix}` : ''}</Muted>
                    </Row>
                  ))}
                  {conflicts.map((c, i) => (
                    <Row key={`c${i}`} gap={8}>
                      <Pill tone={sevTone(c.severity)}>{c.kind}</Pill>
                      <Muted style={{ flex: 1 }}>{c.message}{c.subjects?.length ? ` · ${c.subjects.join(', ')}` : ''}</Muted>
                    </Row>
                  ))}
                </Stack>
              </Section>
            )}

            {/* Source */}
            <Section>
              <Row gap={8} wrap>
                <SectionTitle style={{ margin: 0, flex: 1 }}>Source</SectionTitle>
                <Btn primary={showRaw === 'design'} onClick={() => setShowRaw(showRaw === 'design' ? 'none' : 'design')}>DESIGN.md</Btn>
                <Btn primary={showRaw === 'tokens'} onClick={() => setShowRaw(showRaw === 'tokens' ? 'none' : 'tokens')}>tokens.css</Btn>
              </Row>
              {showRaw === 'design' && <Mono style={{ marginTop: 8 }}>{detail.designMd || '(empty)'}</Mono>}
              {showRaw === 'tokens' && <Mono style={{ marginTop: 8 }}>{detail.tokensCss || '(empty)'}</Mono>}
              {manifest.source?.license && <Muted style={{ display: 'block', marginTop: 8 }}>{manifest.source.license}{manifest.source.upstream ? ` · ${manifest.source.upstream}` : ''}</Muted>}
            </Section>
          </Stack>
        ) : <Section><Muted>select a system above</Muted></Section>}
      </Wrap>
    </Page>
  );
}
