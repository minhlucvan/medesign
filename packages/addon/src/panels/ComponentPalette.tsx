import React, { useEffect, useState, useCallback } from 'react';
import { EVT_PLACE_TRIGGER, EVT_PLACE_RESULT, type PlaceTriggerPayload, type PlaceResultPayload, type PlacementMode } from '../channel';
import { Muted, Pill, Row, Stack, Btn } from '../ui';

interface AvailableComponent {
  name: string;
  category: 'primitive' | 'generated' | 'captured';
}

const PLACEMENT_MODES: Array<{ mode: PlacementMode; label: string; description: string }> = [
  { mode: 'after', label: 'After', description: 'Insert after the target element' },
  { mode: 'before', label: 'Before', description: 'Insert before the target element' },
  { mode: 'into', label: 'Into', description: 'Insert as last child of target' },
  { mode: 'replace', label: 'Replace', description: 'Swap target with new component' },
];

interface ComponentPaletteProps {
  triggerPayload: PlaceTriggerPayload;
  onDismiss: () => void;
  channel: any; // Storybook channel for emitting events
}

/** A popover that shows available components + placement modes. */
export function ComponentPalette({ triggerPayload, onDismiss, channel }: ComponentPaletteProps) {
  const [query, setQuery] = useState('');
  const [components, setComponents] = useState<AvailableComponent[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string>('');
  const [placementMode, setPlacementMode] = useState<PlacementMode>(triggerPayload.placementMode || 'after');
  const [placing, setPlacing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Fetch component list
  useEffect(() => {
    const BACKEND = 'http://localhost:4321';
    fetch(`${BACKEND}/api/components`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setComponents(data.map((c: string) => ({ name: c, category: 'generated' as const })));
        } else if (data?.components) {
          setComponents(data.components.map((c: string) => ({ name: c, category: 'generated' as const })));
        }
      })
      .catch(() => {
        // If API fails, show some default primitives
        setComponents([
          { name: 'Button', category: 'primitive' },
          { name: 'Card', category: 'primitive' },
          { name: 'Heading', category: 'primitive' },
          { name: 'Stack', category: 'primitive' },
          { name: 'Input', category: 'primitive' },
          { name: 'Badge', category: 'primitive' },
        ]);
      });
  }, []);

  const filtered = query
    ? components.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : components;

  const grouped = filtered.reduce<Record<string, AvailableComponent[]>>((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  const handlePlace = useCallback(async () => {
    if (!selectedComponent) return;
    setPlacing(true);
    setStatus('placing...');

    const payload: PlaceTriggerPayload = {
      ...triggerPayload,
      placementMode,
      selectedComponent,
    };

    channel.emit(EVT_PLACE_TRIGGER, payload);
    setStatus(`✅ Placing ${selectedComponent}...`);
    setTimeout(() => onDismiss(), 1500);
  }, [selectedComponent, placementMode, triggerPayload, channel, onDismiss]);

  return (
    <div style={{
      position: 'fixed', zIndex: 100000,
      background: '#1c1c1f', color: '#fff',
      border: '1px solid #333', borderRadius: 8,
      padding: 10, width: 300,
      boxShadow: '0 6px 24px rgba(0,0,0,.5)',
      font: '13px sans-serif',
      top: Math.min(triggerPayload.rect.y + triggerPayload.rect.height + 8, window.innerHeight - 400),
      left: Math.min(triggerPayload.rect.x, window.innerWidth - 320),
    }}>
      {/* Header */}
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 12 }}>Place component</strong>
        <button onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
      </div>
      <Muted style={{ fontSize: 11, marginBottom: 8 }}>
        at &lt;{triggerPayload.tag}&gt;{triggerPayload.text ? ` "${triggerPayload.text.slice(0, 24)}"` : ''}
      </Muted>

      {/* Placement mode selector */}
      <Row gap={4} wrap style={{ marginBottom: 8 }}>
        {PLACEMENT_MODES.map(pm => (
          <Btn key={pm.mode} primary={placementMode === pm.mode}
            onClick={() => setPlacementMode(pm.mode)}
            style={{ fontSize: 11, padding: '3px 8px' }}
            title={pm.description}>
            {pm.label}
          </Btn>
        ))}
      </Row>

      {/* Search input */}
      <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Search components..."
        style={{
          width: '100%', boxSizing: 'border-box', padding: '5px 8px', marginBottom: 8,
          background: '#0f0f10', color: '#fff', border: '1px solid #333', borderRadius: 4,
          font: '13px sans-serif',
        }}
      />

      {/* Component list grouped by category */}
      <div style={{ maxHeight: 200, overflow: 'auto' }}>
        {Object.entries(grouped).map(([category, comps]) => (
          <div key={category} style={{ marginBottom: 6 }}>
            <Muted style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>
              {category} ({comps.length})
            </Muted>
            <Stack gap={2}>
              {comps.map(c => (
                <div key={c.name}
                  onClick={() => setSelectedComponent(c.name)}
                  style={{
                    cursor: 'pointer', padding: '4px 8px', borderRadius: 4,
                    background: selectedComponent === c.name ? '#2563eb' : 'transparent',
                    color: selectedComponent === c.name ? '#fff' : '#ccc',
                    fontSize: 12,
                  }}>
                  {c.name}
                </div>
              ))}
            </Stack>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <Muted style={{ display: 'block', padding: 8 }}>No components match "{query}"</Muted>
        )}
      </div>

      {/* Place button */}
      <Row gap={8} style={{ marginTop: 8, justifyContent: 'flex-end' }}>
        <button onClick={onDismiss}
          style={{ cursor: 'pointer', background: 'transparent', color: '#aaa', border: '1px solid #444', borderRadius: 4, padding: '4px 10px', fontSize: 12 }}>
          Cancel
        </button>
        <button onClick={handlePlace} disabled={!selectedComponent || placing}
          style={{
            cursor: selectedComponent && !placing ? 'pointer' : 'default',
            background: selectedComponent && !placing ? '#2563eb' : '#333',
            color: '#fff', border: 0, borderRadius: 4, padding: '4px 12px', fontSize: 12,
            opacity: selectedComponent && !placing ? 1 : 0.5,
          }}>
          {placing ? 'Placing...' : `Place ${selectedComponent || '...'}`}
        </button>
      </Row>

      {status && <Muted style={{ display: 'block', marginTop: 6, fontSize: 11 }}>{status}</Muted>}
    </div>
  );
}
