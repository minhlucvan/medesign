import React, { useCallback, useEffect, useState } from 'react';
import { styled, keyframes } from '@storybook/theming';
import { api } from './api';
import type { StudioState } from './constants';

// ── Skeleton loading components ────────────────────────────────────────────

const shimmer = keyframes`
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
`;

export const LoadingSkeleton = styled.div<{ width?: string | number; height?: string | number }>(({ theme, width = '100%', height = 16 }) => ({
  width,
  height,
  borderRadius: 4,
  background: `linear-gradient(90deg, ${theme.background.app} 25%, ${theme.appBorderColor} 50%, ${theme.background.app} 75%)`,
  backgroundSize: '200% 100%',
  animation: `${shimmer} 1.5s ease-in-out infinite`,
}));

export const LoadingCard = () => (
  <Section>
    <LoadingSkeleton width="60%" height={14} />
    <div style={{ height: 8 }} />
    <LoadingSkeleton height={12} />
    <div style={{ height: 4 }} />
    <LoadingSkeleton width="85%" height={12} />
    <div style={{ height: 4 }} />
    <LoadingSkeleton width="70%" height={12} />
  </Section>
);

/** Shared 1.5s poll of the backend state, used by the panel + tab + tool. */
export function useStudioState(pollMs = 1500) {
  const [state, setState] = useState<StudioState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setState(await api.getState()); setError(null); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { refresh(); const t = setInterval(refresh, pollMs); return () => clearInterval(t); }, [refresh, pollMs]);
  return { state, error, refresh };
}

// ---- themed primitives (dark/light-aware via the Storybook theme) ----

export const Section = styled.div(({ theme }) => ({
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: theme.appBorderRadius,
  background: theme.background.content,
  padding: 12,
  marginBottom: 12,
}));

export const SectionTitle = styled.div(({ theme }) => ({
  font: `700 12px/1.2 ${theme.typography.fonts.base}`,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: theme.textMutedColor,
  marginBottom: 8,
}));

export const Row = styled.div<{ gap?: number; wrap?: boolean }>(({ gap = 8, wrap }) => ({
  display: 'flex',
  alignItems: 'center',
  gap,
  flexWrap: wrap ? 'wrap' : 'nowrap',
}));

export const Stack = styled.div<{ gap?: number }>(({ gap = 8 }) => ({ display: 'flex', flexDirection: 'column', gap }));

export const Muted = styled.span(({ theme }) => ({ color: theme.textMutedColor, fontSize: 12 }));

export const Input = styled.input(({ theme }) => ({
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 8px',
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: theme.appBorderRadius,
  background: theme.input.background,
  color: theme.input.color,
  font: `13px ${theme.typography.fonts.base}`,
}));

export const Textarea = Input.withComponent('textarea');

export const Btn = styled.button<{ primary?: boolean }>(({ theme, primary }) => ({
  cursor: 'pointer',
  padding: '5px 10px',
  borderRadius: theme.appBorderRadius,
  border: `1px solid ${primary ? theme.color.secondary : theme.appBorderColor}`,
  background: primary ? theme.color.secondary : theme.background.app,
  color: primary ? theme.color.lightest : theme.color.defaultText,
  font: `600 12px ${theme.typography.fonts.base}`,
  '&:disabled': { opacity: 0.45, cursor: 'default' },
}));

export const Pill = styled.span<{ tone?: 'ok' | 'warn' | 'bad' | 'muted' }>(({ theme, tone = 'muted' }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 7px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  background: theme.background.app,
  color:
    tone === 'ok' ? theme.color.positiveText ?? theme.color.positive
    : tone === 'warn' ? theme.color.warningText ?? theme.color.warning
    : tone === 'bad' ? theme.color.negativeText ?? theme.color.negative
    : theme.textMutedColor,
  border: `1px solid ${theme.appBorderColor}`,
}));

export const ErrorBanner = ({ error, onRetry, variant }: { error: string; onRetry?: () => void; variant?: 'error' | 'timeout' }) => {
  const msg = variant === 'timeout'
    ? `Request timed out: ${error}`
    : `Backend not reachable (${error}). Start it with \`emdesign serve\`.`;
  return (
    <Section style={{ borderColor: '#c0392b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Muted style={{ flex: 1 }}>{msg}</Muted>
        {onRetry && <Btn onClick={onRetry} style={{ flexShrink: 0 }}>Retry</Btn>}
      </div>
    </Section>
  );
};

export const FormError = ({ error }: { error: string | null }) =>
  error ? (
    <Muted style={{ color: '#c0392b', marginTop: 4, display: 'block' }}>{error}</Muted>
  ) : null;

// ---- full-page tab primitives ----

// ── header bar ───────────────────────────────────────────────────────────────

export const HeaderBar = styled.div(({ theme }) => ({
  display: 'flex', alignItems: 'center', gap: 6,
  paddingBottom: 12, marginBottom: 12,
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

export const HeaderBrand = styled.span(({ theme }) => ({
  font: `700 14px ${theme.typography.fonts.base}`, color: theme.color.defaultText, flex: 1,
}));

// ---- full-page tab primitives ----

export const Page = styled.div({ width: '100%', height: '100%', overflow: 'auto', padding: 16 });

export const PageTitle = styled.h2(({ theme }) => ({ font: `700 18px ${theme.typography.fonts.base}`, margin: '0 0 2px' }));

export const Sub = styled.div(({ theme }) => ({ color: theme.textMutedColor, fontSize: 12, marginBottom: 14 }));

export const Grid2 = styled.div({ display: 'grid', gridTemplateColumns: 'minmax(240px, 340px) 1fr', gap: 16, alignItems: 'start' });

/** Centered, readable max-width column for single-column tab layouts. */
export const Wrap = styled.div({ maxWidth: 920, margin: '0 auto' });

/** A pill-shaped selector chip (e.g. the design-system picker). */
export const Chip = styled.button<{ selected?: boolean }>(({ theme, selected }) => ({
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 12px',
  borderRadius: 999,
  border: `1px solid ${selected ? theme.color.secondary : theme.appBorderColor}`,
  background: selected ? theme.color.secondary : theme.background.app,
  color: selected ? theme.color.lightest : theme.color.defaultText,
  font: `600 12px ${theme.typography.fonts.base}`,
  whiteSpace: 'nowrap',
}));

export const Swatch = styled.span<{ color: string }>(({ color, theme }) => ({
  display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: color,
  border: `1px solid ${theme.appBorderColor}`, verticalAlign: 'middle', flex: 'none',
}));

export const Mono = styled.pre(({ theme }) => ({
  font: `12px/1.5 ${theme.typography.fonts.mono}`,
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: theme.appBorderRadius,
  padding: 10, margin: 0, overflow: 'auto', maxHeight: 320, whiteSpace: 'pre-wrap',
}));

export const Select = styled.select(({ theme }) => ({
  padding: '5px 8px',
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: theme.appBorderRadius,
  background: theme.input.background,
  color: theme.input.color,
  font: `13px ${theme.typography.fonts.base}`,
}));

/** Severity → pill tone for diagnostics/conflicts. */
export const sevTone = (s: string): 'bad' | 'warn' | 'muted' => (s === 'P0' ? 'bad' : s === 'P1' ? 'warn' : 'muted');
