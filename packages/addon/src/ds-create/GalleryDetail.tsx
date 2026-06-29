import React, { useEffect, useState } from 'react';
import { styled } from '@storybook/theming';
import { api } from '../api';
import { Row, Stack, Muted, Btn, Pill, LoadingSkeleton } from '../ui';
import type { DesignSystemBase, RegistrySystem, BaseDetail } from '../constants';

const Wrapper = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
});

const BackBar = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
});

const BackBtn = styled.button(({ theme }) => ({
  cursor: 'pointer',
  background: 'none',
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: 6,
  padding: '6px 12px',
  color: theme.color.defaultText,
  font: `600 12px ${theme.typography.fonts.base}`,
  '&:hover': { background: theme.background.hoverable },
}));

const PreviewFrame = styled.div<{ bg?: string }>(({ theme, bg }) => ({
  width: '100%',
  minHeight: 600,
  borderRadius: 8,
  overflow: 'auto',
  background: bg ?? theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
}));

const InfoGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
  marginTop: 4,
});

const InfoCard = styled.div(({ theme }) => ({
  padding: 12,
  borderRadius: 6,
  background: theme.background.content,
  border: `1px solid ${theme.appBorderColor}`,
}));

const InfoLabel = styled(Muted)({
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 4,
});

const InfoValue = styled.div(({ theme }) => ({
  fontSize: 13,
  color: theme.color.defaultText,
  fontWeight: 500,
}));

const DescText = styled.div(({ theme }) => ({
  fontSize: 13,
  lineHeight: 1.6,
  color: theme.color.defaultText,
  marginTop: 4,
}));

const TagRow = styled.div({
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  marginTop: 6,
});

const ActionBar = styled.div({
  display: 'flex',
  gap: 10,
  justifyContent: 'flex-end',
  paddingTop: 8,
  borderTop: '1px solid',
  borderTopColor: 'rgba(0,0,0,0.08)',
});

const Title = styled.h2(({ theme }) => ({
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
  color: theme.color.defaultText,
}));

type GalleryEntry =
  | { type: 'vendor'; data: DesignSystemBase }
  | { type: 'awesome'; data: RegistrySystem };

interface GalleryDetailProps {
  entry: GalleryEntry;
  onBack: () => void;
  onImport: () => void;
  onSelect: () => void;
  importLabel?: string;
}

export function GalleryDetail({ entry, onBack, onImport, onSelect, importLabel }: GalleryDetailProps) {
  const [baseDetail, setBaseDetail] = useState<BaseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load full detail for vendor entries
  useEffect(() => {
    if (entry.type === 'vendor') {
      setLoadingDetail(true);
      api.getBaseDetail(entry.data.ref).then((d) => {
        setBaseDetail(d);
        setLoadingDetail(false);
      }).catch(() => setLoadingDetail(false));
    }
  }, [entry]);

  const isAwesome = entry.type === 'awesome';
  const name = entry.data.name;
  const description = entry.data.description ?? 'No description available.';
  const category = isAwesome ? 'Brand' : (entry.data as DesignSystemBase).category ?? 'Other';

  // getdesign.md preview URL for awesome entries
  const previewUrl = isAwesome
    ? `https://getdesign.md/design-md/${(entry.data as RegistrySystem).id}/preview.html`
    : null;

  return (
    <Wrapper>
      {/* Back bar */}
      <BackBar>
        <BackBtn onClick={onBack}>← Back to gallery</BackBtn>
      </BackBar>

      {/* Preview frame — embedded from getdesign.md for rich design system analysis */}
      {previewUrl ? (
        <PreviewFrame>
          <iframe
            src={previewUrl}
            style={{ width: '100%', height: '800px', border: 'none', display: 'block', background: '#fff' }}
            title={`${name} preview`}
            sandbox="allow-same-origin"
          />
        </PreviewFrame>
      ) : (
        <PreviewFrame bg={(entry.data as DesignSystemBase).surface ?? '#f5f0eb'} />
      )}

      {/* Name + description */}
      <div>
        <Title>{name}</Title>
        <Row gap={6} style={{ marginTop: 6 }}>
          <Pill>{category}</Pill>
          {isAwesome && (entry.data as RegistrySystem).completeness === 'design-md-only' && (
            <Pill tone="warn">DESIGN.md</Pill>
          )}
          {isAwesome && (entry.data as RegistrySystem).completeness === 'full' && (
            <Pill tone="ok">Full</Pill>
          )}
          {!isAwesome && (entry.data as DesignSystemBase).source?.license && (
            <Pill>{entry.data.source.license}</Pill>
          )}
        </Row>
        <DescText>{description}</DescText>
      </div>

      {/* Detail info */}
      {isAwesome ? (
        <InfoGrid>
          <InfoCard>
            <InfoLabel>Tokens</InfoLabel>
            <InfoValue>{(entry.data as RegistrySystem).tokens ?? '—'}</InfoValue>
          </InfoCard>
          <InfoCard>
            <InfoLabel>Completeness</InfoLabel>
            <InfoValue>{(entry.data as RegistrySystem).completeness ?? '—'}</InfoValue>
          </InfoCard>
          <InfoCard>
            <InfoLabel>Source</InfoLabel>
            <InfoValue>{(entry.data as RegistrySystem).source ?? '—'}</InfoValue>
          </InfoCard>
          {(entry.data as RegistrySystem).primitives?.length > 0 && (
            <InfoCard>
              <InfoLabel>Primitives ({((entry.data as RegistrySystem).primitives ?? []).length})</InfoLabel>
              <TagRow>
                {(entry.data as RegistrySystem).primitives.slice(0, 8).map((p) => (
                  <Pill key={p}>{p}</Pill>
                ))}
                {(entry.data as RegistrySystem).primitives.length > 8 && (
                  <Muted>+{(entry.data as RegistrySystem).primitives.length - 8} more</Muted>
                )}
              </TagRow>
            </InfoCard>
          )}
        </InfoGrid>
      ) : (
        <InfoGrid>
          {loadingDetail ? (
            <>
              <InfoCard><LoadingSkeleton height={12} width="60%" /></InfoCard>
              <InfoCard><LoadingSkeleton height={12} width="60%" /></InfoCard>
            </>
          ) : baseDetail ? (
            <>
              {baseDetail.tokens?.length > 0 && (
                <InfoCard>
                  <InfoLabel>Tokens ({baseDetail.tokens.length})</InfoLabel>
                  <TagRow>
                    {baseDetail.tokens.slice(0, 6).map((t) => (
                      <Pill key={t.role}>{t.role}</Pill>
                    ))}
                    {baseDetail.tokens.length > 6 && (
                      <Muted>+{baseDetail.tokens.length - 6} more</Muted>
                    )}
                  </TagRow>
                </InfoCard>
              )}
              {baseDetail.fonts && (
                <InfoCard>
                  <InfoLabel>Typography</InfoLabel>
                  <Stack gap={2}>
                    {baseDetail.fonts.display && <InfoValue>Display: {baseDetail.fonts.display}</InfoValue>}
                    {baseDetail.fonts.body && <InfoValue>Body: {baseDetail.fonts.body}</InfoValue>}
                    {baseDetail.fonts.mono && <InfoValue>Mono: {baseDetail.fonts.mono}</InfoValue>}
                    {!baseDetail.fonts.display && !baseDetail.fonts.body && !baseDetail.fonts.mono && (
                      <InfoValue>—</InfoValue>
                    )}
                  </Stack>
                </InfoCard>
              )}
              {baseDetail.accentColor && (
                <InfoCard>
                  <InfoLabel>Accent Color</InfoLabel>
                  <Row gap={8}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 4,
                      background: baseDetail.accentColor,
                      border: '1px solid rgba(0,0,0,0.1)',
                    }} />
                    <InfoValue>{baseDetail.accentColor}</InfoValue>
                  </Row>
                </InfoCard>
              )}
              {baseDetail.hasPreview != null && (
                <InfoCard>
                  <InfoLabel>Preview</InfoLabel>
                  <InfoValue>{baseDetail.hasPreview ? 'Available' : 'Not available'}</InfoValue>
                </InfoCard>
              )}
            </>
          ) : (
            <InfoCard>
              <Muted>Loading details…</Muted>
            </InfoCard>
          )}
        </InfoGrid>
      )}

      {/* Action buttons */}
      <ActionBar>
        <Btn onClick={onBack}>Cancel</Btn>
        {isAwesome ? (
          <Btn primary onClick={onImport}>{importLabel ?? 'Import Now'}</Btn>
        ) : (
          <Btn primary onClick={onSelect}>{importLabel ?? 'Select'}</Btn>
        )}
      </ActionBar>
    </Wrapper>
  );
}
