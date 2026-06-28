import React from 'react';
import { useChannel } from '@storybook/manager-api';
import { AddonPanel } from '@storybook/components';
import { EVT_WAND_RESULT, type WandResultPayload } from '../channel';
import { Section, SectionTitle, Row, Stack, Muted, Pill, Btn } from '../ui';

/** Results from the auto-fix wand: diagnostic summary, applied fixes, before/after scores. */
export function WandResultsPanel({ active }: { active: boolean }) {
  const [result, setResult] = React.useState<WandResultPayload | null>(null);
  const [status, setStatus] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [applying, setApplying] = React.useState(false);

  useChannel({
    [EVT_WAND_RESULT]: (p: WandResultPayload) => {
      setResult(p);
      setStatus(p.status === 'completed' ? 'done' : p.status === 'error' ? 'error' : 'running');
    },
  });

  // Reset when idle
  if (!result && status === 'idle') {
    return (
      <AddonPanel active={active}>
        <Stack gap={12} style={{ padding: 12 }}>
          <SectionTitle>Wand Results</SectionTitle>
          <Muted>
            Click the wand icon 🪄 in the toolbar, then click an element in the preview to run auto-diagnostics.
            Hold Shift while clicking to include vision critique.
          </Muted>
        </Stack>
      </AddonPanel>
    );
  }

  const handleApply = async () => {
    setApplying(true);
    // In a real implementation, this would call the backend to apply fixes
    // For now, the agent picks up the wand intent and applies via auto-fix-workflow
    setApplying(false);
  };

  return (
    <AddonPanel active={active}>
      <Stack gap={12} style={{ padding: 12 }}>
        {/* Status header */}
        <Section>
          <Row gap={8} wrap>
            <SectionTitle style={{ margin: 0, flex: 1 }}>Auto-Fix Results</SectionTitle>
            {status === 'running' && <Pill tone="warn">⏳ Running...</Pill>}
            {status === 'done' && <Pill tone={result?.gate === 'pass' ? 'ok' : 'warn'}>{result?.gate === 'pass' ? '✅ Pass' : result?.gate === 'regression' ? '↩️ Rolled back' : '❌ Failed'}</Pill>}
            {status === 'error' && <Pill tone="bad">❌ Error</Pill>}
          </Row>
          {result?.elapsed != null && (
            <Muted style={{ display: 'block', marginTop: 4 }}>Completed in {(result.elapsed / 1000).toFixed(1)}s</Muted>
          )}
          {result?.error && (
            <Muted style={{ display: 'block', marginTop: 4, color: '#f87171' }}>{result.error}</Muted>
          )}
        </Section>

        {/* Diagnostic summary */}
        {result?.diagnosticSummary && (
          <Section>
            <SectionTitle>Diagnostic Summary</SectionTitle>
            <Stack gap={6}>
              <Row gap={8} wrap>
                <Pill tone={result.diagnosticSummary.p0 > 0 ? 'bad' : 'ok'}>{result.diagnosticSummary.p0} P0</Pill>
                <Pill tone={result.diagnosticSummary.p1 > 0 ? 'warn' : 'ok'}>{result.diagnosticSummary.p1} P1</Pill>
                <Pill>{result.diagnosticSummary.p2} P2</Pill>
                <Pill tone={result.diagnosticSummary.fixable > 0 ? 'ok' : 'muted'}>{result.diagnosticSummary.fixable} auto-fixable</Pill>
                <Pill tone={result.diagnosticSummary.needsHuman > 0 ? 'warn' : 'muted'}>{result.diagnosticSummary.needsHuman} needs human</Pill>
              </Row>
              <Row gap={8}>
                <Muted>Total: {result.diagnosticSummary.total} issue(s) detected</Muted>
              </Row>
            </Stack>
          </Section>
        )}

        {/* Auto-fixable issues */}
        {result?.autoFixable && result.autoFixable.length > 0 && (
          <Section>
            <SectionTitle>🪄 Auto-Fixable ({result.autoFixable.length})</SectionTitle>
            <Stack gap={6}>
              {result.autoFixable.map((item, i) => (
                <Row key={i} gap={8}>
                  <Pill tone={item.priority === 'P0' ? 'bad' : item.priority === 'P1' ? 'warn' : 'muted'}>{item.priority}</Pill>
                  <Muted style={{ flex: 1, fontSize: 12 }}>{item.message}</Muted>
                </Row>
              ))}
            </Stack>
            {status === 'done' && !applying && (
              <Btn primary style={{ marginTop: 8 }} onClick={handleApply}>
                Apply {result.autoFixable.length} Auto-Fix(es)
              </Btn>
            )}
            {applying && <Muted style={{ marginTop: 8 }}>Applying fixes...</Muted>}
          </Section>
        )}

        {/* Applied fixes */}
        {result?.applied && result.applied.length > 0 && (
          <Section>
            <SectionTitle>Applied Fixes</SectionTitle>
            <Stack gap={6}>
              {result.applied.map((item, i) => (
                <Row key={i} gap={8}>
                  <Pill tone={item.status === 'applied' ? 'ok' : item.status === 'failed' ? 'bad' : 'warn'}>
                    {item.status === 'applied' ? '✅' : item.status === 'failed' ? '❌' : '⏳'}
                  </Pill>
                  <Muted style={{ flex: 1, fontSize: 12 }}>{item.message}</Muted>
                </Row>
              ))}
            </Stack>
          </Section>
        )}

        {/* Needs human */}
        {result?.needsHuman && result.needsHuman.length > 0 && (
          <Section>
            <SectionTitle>👤 Needs Human Review ({result.needsHuman.length})</SectionTitle>
            <Stack gap={6}>
              {result.needsHuman.slice(0, 10).map((item, i) => (
                <Row key={i} gap={8}>
                  <Pill tone={item.priority === 'P0' ? 'bad' : item.priority === 'P1' ? 'warn' : 'muted'}>{item.priority}</Pill>
                  <Muted style={{ flex: 1, fontSize: 12 }}>{item.message}</Muted>
                </Row>
              ))}
              {result.needsHuman.length > 10 && (
                <Muted>...and {result.needsHuman.length - 10} more</Muted>
              )}
            </Stack>
          </Section>
        )}

        {/* Improvements */}
        {result?.improvements && result.improvements.length > 0 && (
          <Section>
            <SectionTitle>📈 Improvements</SectionTitle>
            <Stack gap={4}>
              {result.improvements.map((imp, i) => (
                <Muted key={i} style={{ fontSize: 12 }}>• {imp}</Muted>
              ))}
            </Stack>
          </Section>
        )}

        {/* Error state */}
        {status === 'error' && !result?.diagnosticSummary && (
          <Section>
            <Muted style={{ color: '#f87171' }}>
              Auto-fix encountered an error. Check the backend logs for details.
            </Muted>
          </Section>
        )}
      </Stack>
    </AddonPanel>
  );
}
