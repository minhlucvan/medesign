import React from 'react';
import { styled } from '@storybook/theming';
import { Row, Stack, Muted, Btn, Swatch, Section, SectionTitle } from '../ui';
import { api } from '../api';
import type { BaseDetail } from '../constants';

const PreviewLayout = styled.div({ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, alignItems: 'start' });
const TokenGrid = styled.div({ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 });
const TokenItem = styled.div(({ theme }) => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
  border: `1px solid ${theme.appBorderColor}`, borderRadius: theme.appBorderRadius,
  background: theme.background.app, fontSize: 10, fontFamily: theme.typography.fonts.mono,
  color: theme.textMutedColor, minWidth: 0,
}));
const ColorSwatch = styled(Swatch)({ width: 16, height: 16, borderRadius: 3, flexShrink: 0 });
const PreviewIframe = styled.iframe({ width: '100%', height: 320, border: '1px solid', borderRadius: 6, background: '#fff' });
const TokenSection = styled.div({ marginBottom: 12 });

export function BasePreview({ detail, onUse }: { detail: BaseDetail; onUse: () => void }) {
  const previewUrl = detail.hasPreview ? api.getBasePreviewUrl(detail.id) : null;
  const colors = detail.tokens.filter((t) => t.kind === 'color');
  const fonts = detail.tokens.filter((t) => t.kind === 'typography');
  const shapes = detail.tokens.filter((t) => t.kind === 'shape');

  return (
    <div>
      <PreviewLayout>
        <div>
          {colors.length > 0 && <TokenSection><Muted style={{ fontWeight: 700, marginBottom: 4, display: 'block' }}>Colors</Muted><TokenGrid>{colors.map((t) => (<TokenItem key={t.role} title={`--${t.role}: ${t.value}`}><ColorSwatch color={t.value} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.role.replace('color-', '')}</span></TokenItem>))}</TokenGrid></TokenSection>}
          {fonts.length > 0 && <TokenSection><Muted style={{ fontWeight: 700, marginBottom: 4, display: 'block' }}>Typography</Muted><Stack gap={4}>{fonts.map((t) => (<Muted key={t.role} style={{ fontSize: 10, fontFamily: 'monospace' }}>{t.role.replace('font-', '')}: {t.value}</Muted>))}</Stack></TokenSection>}
          {shapes.length > 0 && <TokenSection><Muted style={{ fontWeight: 700, marginBottom: 4, display: 'block' }}>Shape</Muted><Stack gap={4}>{shapes.slice(0, 5).map((t) => (<Muted key={t.role} style={{ fontSize: 10, fontFamily: 'monospace' }}>{t.role}: {t.value}</Muted>))}</Stack></TokenSection>}
        </div>
        <div>
          {previewUrl ? <PreviewIframe src={previewUrl} title={`${detail.name} reference`} /> : (
            <div style={{ height: 320, borderRadius: 6, background: `linear-gradient(135deg, ${detail.accentColor || '#eee'}22, ${detail.accentColor || '#eee'}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Muted>No reference preview available for this base.</Muted>
            </div>
          )}
        </div>
      </PreviewLayout>
      <Row gap={16} wrap style={{ marginTop: 12 }}>
        {detail.fonts.display && <Muted>Headline: <strong>{detail.fonts.display}</strong></Muted>}
        {detail.fonts.body && <Muted>Body: <strong>{detail.fonts.body}</strong></Muted>}
        {detail.accentColor && <Row gap={4}><Muted>Accent:</Muted><ColorSwatch color={detail.accentColor} /><Muted>{detail.accentColor}</Muted></Row>}
      </Row>
      <Row gap={8} style={{ marginTop: 12 }}><Btn primary onClick={onUse}>Use as template →</Btn><Muted>Clone and customize this base to create your own design system.</Muted></Row>
    </div>
  );
}
