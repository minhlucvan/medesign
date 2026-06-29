import React, { useEffect, useState, useCallback } from 'react';
import { styled } from '@storybook/theming';
import { api, BACKEND_URL } from '../api';
import { Row, Stack, Muted, Input, Btn, Pill } from '../ui';
import { CustomizeForm } from './CustomizeForm';
import { GalleryDetail } from './GalleryDetail';
import type { DesignSystemBase, RegistrySystem } from '../constants';

const SearchInput = styled(Input)({ maxWidth: 360, marginBottom: 0 });
const FilterRow = styled.div({ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 });
const FilterPill = styled.button<{ $active: boolean }>(({ theme, $active }) => ({
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '2px 8px', borderRadius: 999,
  border: `1px solid ${$active ? theme.color.secondary : theme.appBorderColor}`,
  background: $active ? theme.color.secondary : theme.background.app,
  color: $active ? theme.color.lightest : theme.color.defaultText,
  font: `600 11px ${theme.typography.fonts.base}`, whiteSpace: 'nowrap',
}));
const CardGrid = styled.div({ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginTop: 10 });
const EmptyState = styled.div(({ theme }) => ({
  gridColumn: '1 / -1', padding: 24, textAlign: 'center', color: theme.textMutedColor, font: `13px ${theme.typography.fonts.base}`,
}));

const PreviewArea = styled.div<{ bg?: string }>(({ theme, bg }) => ({
  height: 140, borderRadius: '6px 6px 0 0',
  background: bg ?? `linear-gradient(135deg, ${theme.background.app}, ${theme.appBorderColor})`,
  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
}));
const PreviewIframe = styled.iframe({ width: '100%', height: '100%', border: 'none' });
const BrandBadge = styled.span(({ theme }) => ({
  padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
  background: theme.color.secondary, color: theme.color.lightest,
}));

const Card = styled.div(({ theme }) => ({
  border: `1px solid ${theme.appBorderColor}`, borderRadius: 8, overflow: 'hidden',
  background: theme.background.content, cursor: 'pointer',
  '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
}));
const CardBody = styled.div({ padding: '8px 10px' });
const CardName = styled.div(({ theme }) => ({ font: `600 13px ${theme.typography.fonts.base}`, color: theme.color.defaultText }));
const CardDesc = styled.div(({ theme }) => ({ font: `11px ${theme.typography.fonts.base}`, color: theme.textMutedColor, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }));
const CardFooter = styled.div({ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 });

type GalleryEntry = {
  type: 'vendor';
  data: DesignSystemBase;
} | {
  type: 'awesome';
  data: RegistrySystem;
};

interface GalleryPathProps {
  onProgress?: (sessionId: string) => void;
  onComplete?: (id: string) => void;
}

export function GalleryPath({ onProgress, onComplete }: GalleryPathProps) {
  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [selectedAwesome, setSelectedAwesome] = useState<RegistrySystem | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<GalleryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.listBases().catch(() => ({ bases: [] })),
      api.listRegistry().catch(() => ({ systems: [], total: 0 })),
    ]).then(([basesRes, registryRes]) => {
      const merged: GalleryEntry[] = [
        ...basesRes.bases.map((b) => ({ type: 'vendor' as const, data: b })),
        ...registryRes.systems
          .filter((s) => s.source.startsWith('awesome/'))
          .map((s) => ({ type: 'awesome' as const, data: s })),
      ];
      setEntries(merged);
      setLoading(false);
    });
  }, []);

  const allCategories = Array.from(new Set(entries.map((e) =>
    e.type === 'vendor' ? e.data.category ?? 'Other' : 'Brand'
  ))).sort();

  const filtered = entries.filter((e) => {
    const name = e.type === 'vendor' ? e.data.name : e.data.name;
    const desc = e.type === 'vendor' ? (e.data.description ?? '') : e.data.description;
    const cat = e.type === 'vendor' ? (e.data.category ?? 'Other') : 'Brand';
    if (search) {
      const q = search.toLowerCase();
      if (!name.toLowerCase().includes(q) && !desc.toLowerCase().includes(q) && !cat.toLowerCase().includes(q)) return false;
    }
    if (activeFilters.size > 0 && !activeFilters.has(cat)) return false;
    return true;
  });

  // When selecting an awesome entry, trigger import via backend
  const handleSelectAwesome = useCallback(async (entry: RegistrySystem) => {
    setSelectedAwesome(entry);
    try {
      const brand = entry.source.replace('awesome/', '');
      const res = await fetch(`${BACKEND_URL}/api/design-systems/import-awesome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, name: entry.name }),
      });
      if (res.ok) {
        const data = await res.json();
        onComplete?.(data.id);
      }
    } catch { /* */ }
  }, [onComplete]);

  // Show detail page for a gallery entry
  if (selectedEntry) {
    return (
      <GalleryDetail
        entry={selectedEntry}
        onBack={() => setSelectedEntry(null)}
        onImport={() => {
          if (selectedEntry.type === 'awesome') {
            handleSelectAwesome(selectedEntry.data as RegistrySystem);
          }
        }}
        onSelect={() => {
          if (selectedEntry.type === 'vendor') {
            setSelectedBase((selectedEntry.data as DesignSystemBase).ref);
          }
        }}
      />
    );
  }

  if (selectedBase) {
    return (
      <div>
        <CustomizeForm baseId={selectedBase} onComplete={onComplete} onProgress={onProgress} />
      </div>
    );
  }

  if (loading) {
    return <Muted>Loading design systems...</Muted>;
  }

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search systems by name, description…" />
        <Muted>{filtered.length} of {entries.length}</Muted>
      </div>
      <FilterRow>
        <FilterPill $active={activeFilters.size === 0} onClick={() => setActiveFilters(new Set())}>All</FilterPill>
        {allCategories.map((cat) => (
          <FilterPill key={cat} $active={activeFilters.has(cat)}
            onClick={() => setActiveFilters((p) => { const n = new Set(p); n.has(cat) ? n.delete(cat) : n.add(cat); return n; })}>
            {cat}
          </FilterPill>
        ))}
      </FilterRow>
      <CardGrid>
        {filtered.length === 0 && <EmptyState>No systems match your filters.</EmptyState>}
        {filtered.map((e) => {
          if (e.type === 'vendor') {
            const b = e.data;
            return (
              <Card key={`v-${b.id}`} onClick={() => setSelectedEntry({ type: 'vendor', data: b })}>
                <PreviewArea bg={b.category === 'Editorial' ? '#f5f0eb' : undefined}>
                  {/* Vendor base — try to show preview iframe */}
                </PreviewArea>
                <CardBody>
                  <CardName>{b.name}</CardName>
                  <Row gap={4} style={{ marginTop: 4 }}>
                    <Pill>{b.category ?? 'Base'}</Pill>
                  </Row>
                  {b.description && <CardDesc>{b.description}</CardDesc>}
                  <CardFooter>
                    <Btn primary style={{ width: '100%' }}>Select</Btn>
                  </CardFooter>
                </CardBody>
              </Card>
            );
          }
          const s = e.data;
          return (
            <Card key={`a-${s.id}`} onClick={() => setSelectedEntry({ type: 'awesome', data: s })}>
              <PreviewArea bg={`linear-gradient(135deg, #667eea 0%, #764ba2 100%)`}>
                <iframe src={`${BACKEND_URL}/api/bases/awesome/${s.id}/preview`} style={{ width: '100%', height: '100%', border: 'none' }} />
              </PreviewArea>
              <CardBody>
                <CardName>{s.name}</CardName>
                <Row gap={4} style={{ marginTop: 4 }}>
                  <Pill>Brand</Pill>
                  {s.completeness === 'design-md-only' && <Pill tone="warn">DESIGN.md</Pill>}
                </Row>
                {s.description && <CardDesc>{s.description}</CardDesc>}
                <CardFooter>
                  <Btn primary style={{ width: '100%' }}>Import</Btn>
                </CardFooter>
              </CardBody>
            </Card>
          );
        })}
      </CardGrid>
    </div>
  );
}
