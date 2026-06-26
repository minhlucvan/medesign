import React, { useEffect, useState, useCallback } from 'react';
import { styled } from '@storybook/theming';
import { api } from '../api';
import { Row, Stack, Muted, Input, Btn, Section, SectionTitle } from '../ui';
import type { DesignSystemBase, BaseDetail, CategoryCount } from '../constants';
import { BaseCard } from './BaseCard';
import { BasePreview } from './BasePreview';

const SearchInput = styled(Input)({ maxWidth: 360, marginBottom: 0 });
const FilterRow = styled.div({ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 0 });
const FilterPill = styled.button<{ $active: boolean }>(({ theme, $active }) => ({
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 10px', borderRadius: 999,
  border: `1px solid ${$active ? theme.color.secondary : theme.appBorderColor}`,
  background: $active ? theme.color.secondary : theme.background.app,
  color: $active ? theme.color.lightest : theme.color.defaultText,
  font: `600 11px ${theme.typography.fonts.base}`, whiteSpace: 'nowrap',
  '&:hover': { opacity: 0.85 },
}));
const CardGrid = styled.div({ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginTop: 12 });
const EmptyState = styled.div(({ theme }) => ({
  gridColumn: '1 / -1', padding: 32, textAlign: 'center', color: theme.textMutedColor, font: `13px ${theme.typography.fonts.base}`,
}));

export function CatalogView({ onUseTemplate }: { onUseTemplate?: (baseRef: string) => void }) {
  const [bases, setBases] = useState<DesignSystemBase[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BaseDetail | null>(null);

  useEffect(() => {
    api.listBases().then((r) => setBases(r.bases)).catch(() => {});
    api.getBaseCategories().then((r) => setCategories(r.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    if (previewId) { api.getBaseDetail(previewId).then(setDetail).catch(() => setDetail(null)); }
    else { setDetail(null); }
  }, [previewId]);

  const filtered = bases.filter((b) => {
    if (search) {
      const q = search.toLowerCase();
      if (!b.name.toLowerCase().includes(q) && !b.description?.toLowerCase().includes(q) && !b.category?.toLowerCase().includes(q)) return false;
    }
    if (activeFilters.size > 0) { if (!b.category || !activeFilters.has(b.category)) return false; }
    return true;
  });

  const allCategories = categories.map((c) => c.name);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bases by name, description, category…" />
        <Muted>{filtered.length} of {bases.length}</Muted>
      </div>
      <FilterRow>
        <FilterPill $active={activeFilters.size === 0} onClick={() => setActiveFilters(new Set())}>All</FilterPill>
        {allCategories.map((cat) => (
          <FilterPill key={cat} $active={activeFilters.has(cat)} onClick={() => setActiveFilters((p) => { const n = new Set(p); n.has(cat) ? n.delete(cat) : n.add(cat); return n; })}>{cat}</FilterPill>
        ))}
      </FilterRow>
      <CardGrid>
        {filtered.length === 0 && <EmptyState>No bases match your filters. Try a different search or clear the filters.</EmptyState>}
        {filtered.map((base) => (
          <BaseCard key={base.id} base={base} expanded={previewId === base.id} onToggle={() => setPreviewId(previewId === base.id ? null : base.id)} onUse={() => onUseTemplate?.(base.ref)} />
        ))}
      </CardGrid>
      {detail && previewId && (
        <Section style={{ marginTop: 16 }}><SectionTitle>{detail.name} — Preview</SectionTitle><BasePreview detail={detail} onUse={() => onUseTemplate?.(detail.ref)} /></Section>
      )}
    </div>
  );
}
