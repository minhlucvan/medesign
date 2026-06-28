import React from 'react';
import { AddonPanel } from '@storybook/components';
import { Section, SectionTitle, Row, Stack, Muted, Pill, Btn } from '../ui';
import type { DiffResult } from '../constants';

interface DiffPanelProps {
  active: boolean;
}

/** Before/after screenshot comparison with pixel diff overlay.
 *  Shows baseline, actual, and diff PNGs side-by-side with pixel change count. */
export function DiffPanel({ active }: DiffPanelProps) {
  const [diff, setDiff] = React.useState<DiffResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Listen for visual test results — in a real impl this would come from EVT_DIFF_RESULT
  // For now, we expose a manual "Run visual test" button
  // The panel can be triggered from the Tool.tsx by emitting an event

  const runTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const { api } = await import('../api');
      const state = await api.getState();
      if (state?.currentComponent) {
        const result = await api.runVisualTest(state.currentComponent);
        // The visual test result comes back via StudioState.lastDiff
      } else {
        setError('No component selected. Navigate to a story first.');
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  };

  const BACKEND = 'http://localhost:4321';

  return (
    <AddonPanel active={active}>
      <Stack gap={12} style={{ padding: 12 }}>
        <Row gap={8} wrap>
          <SectionTitle style={{ margin: 0, flex: 1 }}>Visual Diff</SectionTitle>
          <Btn primary onClick={runTest} disabled={loading}>
            {loading ? 'Running...' : 'Run Visual Test'}
          </Btn>
        </Row>

        {error && (
          <Section>
            <Muted style={{ color: '#f87171' }}>{error}</Muted>
          </Section>
        )}

        {diff && (
          <>
            <Section>
              <SectionTitle>Result</SectionTitle>
              <Row gap={8} wrap>
                <Pill tone={diff.status === 'pass' ? 'ok' : diff.status === 'new' ? 'warn' : 'bad'}>
                  {diff.status === 'pass' ? '✅ Pass (no change)' : diff.status === 'new' ? '🆕 New baseline' : diff.status === 'changed' ? '🔴 Changed' : '❌ Error'}
                </Pill>
                {diff.changedPixels != null && (
                  <Muted>{diff.changedPixels} pixel(s) changed</Muted>
                )}
              </Row>
            </Section>

            {/* Screenshot comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {diff.baselinePng && (
                <Section>
                  <SectionTitle>Baseline</SectionTitle>
                  <img src={`${BACKEND}${diff.baselinePng}`} alt="baseline"
                    style={{ width: '100%', borderRadius: 4, border: '1px solid #333' }} />
                </Section>
              )}
              {diff.actualPng && (
                <Section>
                  <SectionTitle>Actual</SectionTitle>
                  <img src={`${BACKEND}${diff.actualPng}`} alt="actual"
                    style={{ width: '100%', borderRadius: 4, border: '1px solid #333' }} />
                </Section>
              )}
            </div>

            {diff.diffPng && (
              <Section>
                <SectionTitle>Diff Overlay</SectionTitle>
                <img src={`${BACKEND}${diff.diffPng}`} alt="diff"
                  style={{ width: '100%', borderRadius: 4, border: '1px solid #f87171' }} />
              </Section>
            )}

            {/* Action buttons */}
            <Row gap={8} wrap>
              {diff.status === 'changed' && (
                <>
                  <Btn primary>Accept New Baseline</Btn>
                  <Btn>Rollback</Btn>
                </>
              )}
            </Row>
          </>
        )}

        {!diff && !error && (
          <Section>
            <Muted>
              Run a visual test to compare the current component render against its stored baseline.
              Navigate to a component story first, then click "Run Visual Test".
            </Muted>
          </Section>
        )}
      </Stack>
    </AddonPanel>
  );
}
