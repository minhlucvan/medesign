import React from 'react';
import { useChannel } from '@storybook/manager-api';
import { AddonPanel } from '@storybook/components';
import { EVT_ELEMENT_SELECTED, EVT_WAND_RESULT, type ElementSelectedPayload, type WandResultPayload } from '../channel';
import { Section, SectionTitle, Row, Stack, Muted, Pill, Swatch, Mono } from '../ui';

/** Colors that are likely token-bound vs raw-hex heuristics. */
const TOKEN_PATTERN = /^(var\(--|--)/;
const HEX_PATTERN = /^#[0-9a-fA-F]{3,8}$/;

function valueKind(value: string): 'token' | 'hex' | 'other' {
  if (TOKEN_PATTERN.test(value)) return 'token';
  if (HEX_PATTERN.test(value)) return 'hex';
  return 'other';
}

const GROUP_LABELS: Record<string, string> = {
  color: 'Color',
  backgroundColor: 'Background',
  fontSize: 'Font size',
  fontWeight: 'Font weight',
  marginTop: 'Margin top',
  marginRight: 'Margin right',
  marginBottom: 'Margin bottom',
  marginLeft: 'Margin left',
  paddingTop: 'Padding top',
  paddingRight: 'Padding right',
  paddingBottom: 'Padding bottom',
  paddingLeft: 'Padding left',
  borderRadius: 'Border radius',
  boxShadow: 'Box shadow',
  display: 'Display',
  position: 'Position',
};

const STYLE_KEYS = ['color', 'backgroundColor', 'fontSize', 'fontWeight', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderRadius', 'boxShadow'];

export function PropertiesPanel({ active }: { active: boolean }) {
  const [element, setElement] = React.useState<ElementSelectedPayload | null>(null);
  const [wandStatus, setWandStatus] = React.useState<string | null>(null);
  const [lastWandResult, setLastWandResult] = React.useState<WandResultPayload | null>(null);

  useChannel({
    [EVT_ELEMENT_SELECTED]: (p: ElementSelectedPayload) => {
      setElement(p);
    },
    [EVT_WAND_RESULT]: (p: WandResultPayload) => {
      setLastWandResult(p);
      setWandStatus(p.status === 'completed' ? '✅ Fixed' : p.status === 'rolled-back' ? '↩️ Rolled back' : p.status === 'running' ? '⏳ Running...' : `❌ ${p.error || 'Error'}`);
    },
  });

  if (!element) {
    return (
      <AddonPanel active={active}>
        <Stack gap={12} style={{ padding: 12 }}>
          <SectionTitle>Properties</SectionTitle>
          <Muted>Click an element in the preview with the Reference or Wand tool to inspect its properties.</Muted>
        </Stack>
      </AddonPanel>
    );
  }

  const { tag, text, selector, component, computedStyles, rect } = element;

  return (
    <AddonPanel active={active}>
      <Stack gap={12} style={{ padding: 12 }}>
        <Section>
          <SectionTitle>Element</SectionTitle>
          <Row gap={8} wrap>
            <Pill><strong>{tag}</strong></Pill>
            {component && <Pill tone="ok">{component}</Pill>}
          </Row>
          <Muted style={{ display: 'block', marginTop: 4, fontSize: 11 }}>{selector}</Muted>
          {text && <Muted style={{ display: 'block', marginTop: 4 }}>“{text.slice(0, 64)}”</Muted>}
          {rect && <Muted style={{ display: 'block', marginTop: 2 }}>{Math.round(rect.width)}×{Math.round(rect.height)} @ ({Math.round(rect.x)},{Math.round(rect.y)})</Muted>}

          {wandStatus && (
            <Row gap={8} style={{ marginTop: 8 }}>
              <Pill tone={wandStatus.includes('✅') ? 'ok' : wandStatus.includes('❌') ? 'bad' : 'warn'}>{wandStatus}</Pill>
            </Row>
          )}
        </Section>

        {/* Token-bound values */}
        <Section>
          <SectionTitle>Applied Styles</SectionTitle>
          <Stack gap={6}>
            {STYLE_KEYS.map((key) => {
              const value = computedStyles?.[key];
              if (!value || value === 'none' || value === 'normal') return null;
              const kind = valueKind(value);
              return (
                <Row key={key} gap={8}>
                  <Muted style={{ width: 90, flexShrink: 0, fontSize: 11 }}>{GROUP_LABELS[key] || key}</Muted>
                  <code style={{
                    flex: 1, font: '11px/1.4 monospace', padding: '1px 5px', borderRadius: 3,
                    background: kind === 'token' ? 'rgba(34,197,94,0.12)' : kind === 'hex' ? 'rgba(249,115,22,0.12)' : 'transparent',
                    color: kind === 'token' ? '#22c55e' : kind === 'hex' ? '#f97316' : '#aaa',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{value}</code>
                  {kind !== 'token' && <Muted style={{ fontSize: 10, color: '#f97316', flexShrink: 0 }}>raw</Muted>}
                </Row>
              );
            })}
          </Stack>
          {(!computedStyles || STYLE_KEYS.every(k => !computedStyles[k])) && (
            <Muted>No computed styles available (cross-origin iframe?).</Muted>
          )}
        </Section>

        {/* Quick fix hints */}
        {Object.values(computedStyles || {}).some(v => v && HEX_PATTERN.test(v)) && (
          <Section>
            <SectionTitle>Quick Fixes</SectionTitle>
            <Stack gap={6}>
              <Muted style={{ fontSize: 11, color: '#f97316' }}>
                ⚡ Raw color values detected. Use the Wand tool (🪄) to auto-replace with design system tokens.
              </Muted>
            </Stack>
          </Section>
        )}

        {/* Last wand result summary */}
        {lastWandResult && lastWandResult.diagnosticSummary && (
          <Section>
            <SectionTitle>Last Auto-Fix</SectionTitle>
            <Stack gap={4}>
              <Row gap={6} wrap>
                <Pill tone={lastWandResult.gate === 'pass' ? 'ok' : lastWandResult.gate === 'regression' ? 'bad' : 'warn'}>
                  {lastWandResult.gate === 'pass' ? 'Pass ✅' : lastWandResult.gate === 'regression' ? 'Regression 🔴' : 'Fail ❌'}
                </Pill>
                <Muted>{lastWandResult.diagnosticSummary.fixable} fixed / {lastWandResult.diagnosticSummary.needsHuman} needs human</Muted>
              </Row>
              {lastWandResult.improvements?.map((imp, i) => (
                <Muted key={i} style={{ fontSize: 11 }}>• {imp}</Muted>
              ))}
            </Stack>
          </Section>
        )}
      </Stack>
    </AddonPanel>
  );
}
