import React, { useState } from 'react';
import { styled } from '@storybook/theming';
import { Btn, Muted, Input, Pill, Row, Section } from '../ui';
import { addons } from '@storybook/manager-api';
import { EVT_CHAT_MODE } from '../channel';
import { ColorStrip } from './ColorStrip';

const HeroSection = styled(Section)({
  padding: '12px 12px 8px',
});

const NameRow = styled(Row)({
  marginBottom: 4,
});

const SystemName = styled.span(({ theme }) => ({
  font: `700 16px ${theme.typography.fonts.base}`,
  color: theme.color.defaultText,
}));

const Meta = styled.div(({ theme }) => ({
  font: `11px ${theme.typography.fonts.base}`,
  color: theme.textMutedColor,
  marginBottom: 8,
  lineHeight: 1.4,
}));

const AiRow = styled.div({
  display: 'flex',
  gap: 6,
});

export interface SystemHeroProps {
  name: string;
  description?: string;
  category?: string;
  tokens: Array<{ role: string; kind: string; value: string }>;
  validationOk: boolean;
  componentsCount: number;
  sectionsCount: number;
  tokensCount: number;
  onRequestChange: (text: string) => void;
  previewUrl?: string;
}

export function SystemHero({
  name,
  description,
  category,
  tokens,
  validationOk,
  componentsCount,
  sectionsCount,
  tokensCount,
  onRequestChange,
}: SystemHeroProps) {


  const colorTokens = tokens.filter((t) => t.kind === 'color');
  const bodyToken = tokens.find(
    (t) => t.role === 'font-body' || t.role === 'body-font',
  );
  const bodyLabel = bodyToken ? `Body: ${bodyToken.value}` : null;


  return (
    <HeroSection>
      <NameRow gap={8} wrap>
        <SystemName>{name}</SystemName>
        <Pill tone={validationOk ? 'ok' : 'bad'}>
          {validationOk ? 'Valid' : 'Issues'}
        </Pill>
        <Pill tone="muted">active</Pill>
      </NameRow>

      {category && (
        <Meta>
          {category}
          {description ? ` — ${description}` : ''}
        </Meta>
      )}
      {!category && description && <Meta>{description}</Meta>}

      {colorTokens.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <ColorStrip tokens={colorTokens} max={12} />
        </div>
      )}

      {/* Font preview */}
      <div style={{ marginBottom: 8 }}>
        <Muted
          as="div"
          style={{
            fontSize: 13,
            fontFamily: bodyToken?.value || undefined,
          }}
        >
          The quick brown fox jumps over the lazy dog.
        </Muted>
        {bodyLabel && (
          <Muted style={{ fontSize: 10, display: 'block', marginTop: 2 }}>
            {bodyLabel}
          </Muted>
        )}
      </div>

      {/* Stats row */}
      <Row gap={4} wrap>
        <Muted>{componentsCount} components</Muted>
        <Muted aria-hidden>·</Muted>
        <Muted>{sectionsCount} sections</Muted>
        <Muted aria-hidden>·</Muted>
        <Muted>{tokensCount} tokens</Muted>
      </Row>

      {/* AI action link — opens chat panel */}
      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <Btn onClick={() => {
          addons.getChannel().emit(EVT_CHAT_MODE, { enabled: true, sessionId: undefined });
        }}>
          ✦ Ask AI
        </Btn>
      </div>

      {/* Preview section */}
      {previewUrl && <PreviewSection url={previewUrl} />}
    </HeroSection>
  );
}

/** Inline preview with collapsible iframe. */
function PreviewSection({ url }: { url: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <Row gap={8} style={{ marginBottom: 6 }}>
        <Muted style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preview</Muted>
        <Btn onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Collapse' : 'View more'}
        </Btn>
      </Row>
      <div style={{
        border: '1px solid #e5e5e5', borderRadius: 6, overflow: 'hidden',
        height: expanded ? 600 : 120, transition: 'height 0.2s ease',
      }}>
        <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }} title="System preview" />
      </div>
    </div>
  );
}
