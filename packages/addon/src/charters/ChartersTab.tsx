/**
 * ChartersTab — Storybook addon tab showing charter evaluation results.
 *
 * Displays pass/fail/warning for each charter defined on the current component/story.
 * Re-evaluates when the story changes via the Storybook channel.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { addons } from '@storybook/manager-api';
import { styled } from '@storybook/theming';
import { EVT_CHARTER_RESULT } from './channel';
import { Page, PageTitle, Sub, Section, SectionTitle, Row, Pill, Muted } from '../ui';
import { sevTone } from '../ui';

import type { CharterResultPayload } from './channel';

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const SummaryRow = styled.div({
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  marginBottom: 16,
});

const CharterRow = styled.div<{ $pass: boolean }>(({ theme, $pass }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: '8px 0',
  borderBottom: `1px solid ${theme.appBorderColor}`,
  opacity: $pass ? 0.75 : 1,
  '&:last-child': { borderBottom: 'none' },
}));

const CharterName = styled.span(({ theme }) => ({
  font: `600 12px ${theme.typography.fonts.base}`,
  color: theme.color.defaultText,
  minWidth: 130,
}));

const CharterMessage = styled.span(({ theme }) => ({
  font: `12px ${theme.typography.fonts.base}`,
  color: theme.textMutedColor,
  flex: 1,
}));

const CharterFix = styled.code(({ theme }) => ({
  font: `11px ${theme.typography.fonts.mono}`,
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: 4,
  padding: '2px 6px',
  marginTop: 4,
  display: 'block',
  whiteSpace: 'pre-wrap',
}));

const EmptyState = styled.div(({ theme }) => ({
  padding: 24,
  textAlign: 'center',
  color: theme.textMutedColor,
  font: `13px ${theme.typography.fonts.base}`,
}));

const Icon = styled.span<{ $pass: boolean; $severity?: string }>(({ $pass, $severity }) => ({
  fontSize: 14,
  lineHeight: '20px',
  flexShrink: 0,
  width: 20,
  textAlign: 'center',
}));

function statusIcon(pass: boolean, severity?: string): string {
  if (pass) return '✅';
  if (severity === 'P0') return '❌';
  if (severity === 'P1') return '⚠️';
  return '⚪';
}

// ---------------------------------------------------------------------------
// Tab component
// ---------------------------------------------------------------------------

export function ChartersTab() {
  const [result, setResult] = useState<CharterResultPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const channel = addons.getChannel();
    const handler = (payload: CharterResultPayload) => {
      setResult(payload);
      setLoading(false);
    };
    channel.on(EVT_CHARTER_RESULT, handler);

    // Request an initial evaluation (in case the preview is already loaded)
    return () => {
      channel.off(EVT_CHARTER_RESULT, handler);
    };
  }, []);

  const passed = result?.passed ?? 0;
  const failed = result?.failed ?? 0;
  const total = passed + failed;

  return (
    <Page>
      <PageTitle>Charters</PageTitle>
      <Sub>Component-level validation assertions defined in CSF</Sub>

      {loading && (
        <EmptyState>Waiting for story to render…</EmptyState>
      )}

      {!loading && total === 0 && (
        <EmptyState>
          No charters defined for this story.
          {' '}<a href="https://emdesign.dev/docs/research/story-charters" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>Learn about charters →</a>
        </EmptyState>
      )}

      {!loading && total > 0 && (
        <>
          <SummaryRow>
            <Pill tone="ok">{passed} passed</Pill>
            {failed > 0 && <Pill tone="bad">{failed} failed</Pill>}
            {failed === 0 && <Pill tone="ok">All passing</Pill>}
            {result && (
              <Muted>
                {result.component} / {result.story}
              </Muted>
            )}
          </SummaryRow>

          <Section>
            {result?.findings.map((f) => (
              <CharterRow key={f.id} $pass={f.pass}>
                <Icon $pass={f.pass} $severity={f.severity}>
                  {statusIcon(f.pass, f.severity)}
                </Icon>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Row gap={8}>
                    <CharterName>{f.charterName}</CharterName>
                    <Pill tone={f.pass ? 'ok' : sevTone(f.severity)}>
                      {f.severity}
                    </Pill>
                  </Row>
                  <CharterMessage>{f.message}</CharterMessage>
                  {f.fix && !f.pass && <CharterFix>{f.fix}</CharterFix>}
                </div>
              </CharterRow>
            ))}
          </Section>
        </>
      )}
    </Page>
  );
}
