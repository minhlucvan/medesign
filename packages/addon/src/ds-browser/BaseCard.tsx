import React from 'react';
import { styled } from '@storybook/theming';
import { Row, Muted, Btn, Pill } from '../ui';
import type { DesignSystemBase } from '../constants';
import { api } from '../api';

const Card = styled.div<{ $expanded: boolean }>(({ theme, $expanded }) => ({
  border: `1px solid ${$expanded ? theme.color.secondary : theme.appBorderColor}`,
  borderRadius: theme.appBorderRadius, background: theme.background.content, overflow: 'hidden', cursor: 'pointer',
  transition: 'box-shadow 0.15s, border-color 0.15s',
  '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.12)', borderColor: $expanded ? theme.color.secondary : theme.textMutedColor },
}));
const PreviewArea = styled.div<{ $accent: string }>(({ $accent }) => ({
  height: 120, background: `linear-gradient(135deg, ${$accent}22 0%, ${$accent}44 50%, ${$accent}22 100%)`,
  display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
}));
const PreviewFrame = styled.iframe({ width: '100%', height: 120, border: 'none', pointerEvents: 'none' });
const InfoArea = styled.div({ padding: '10px 12px' });
const Name = styled.div(({ theme }) => ({ font: `600 13px ${theme.typography.fonts.base}`, color: theme.color.defaultText }));

export function BaseCard({ base, expanded, onToggle, onUse }: {
  base: DesignSystemBase; expanded: boolean; onToggle: () => void; onUse: () => void;
}) {
  const previewUrl = api.getBasePreviewUrl(base.id);
  return (
    <Card $expanded={expanded} onClick={onToggle}>
      <PreviewArea $accent="#2563eb">
        <PreviewFrame src={previewUrl} title={`${base.name} preview`} style={{ opacity: 0.85 }}
          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
      </PreviewArea>
      <InfoArea>
        <Row gap={6} wrap><Name style={{ flex: 1 }}>{base.name}</Name>{base.category && <Pill tone="muted">{base.category}</Pill>}</Row>
        {base.description && <Muted style={{ display: 'block', marginTop: 4, fontSize: 11 }}>{base.description}</Muted>}
        {expanded && <Row gap={6} style={{ marginTop: 8 }}><Btn primary onClick={(e: React.MouseEvent) => { e.stopPropagation(); onUse(); }}>Use as template →</Btn></Row>}
      </InfoArea>
    </Card>
  );
}
