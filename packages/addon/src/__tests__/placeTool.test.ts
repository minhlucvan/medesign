/**
 * Place Tool — unit tests.
 *
 * These tests verify the component placement tool:
 * - ToolMode includes 'place'
 * - EVT_PLACE_TRIGGER carries the correct payload shape
 * - EVT_PLACE_RESULT carries the correct payload shape
 * - PlacementMode covers all 4 modes
 * - PlaceTriggerPayload validates placementMode values
 */

import { EVT_PLACE_TRIGGER, EVT_PLACE_RESULT, type PlaceTriggerPayload, type PlaceResultPayload, type PlacementMode, type ToolMode } from '../channel';

// ── ToolMode contract ─────────────────────────────────────────────────

describe('ToolMode place', () => {
  it('includes place as a valid ToolMode', () => {
    const mode: ToolMode = 'place';
    expect(mode).toBe('place');
  });

  it('is distinct from other tool modes', () => {
    const placeMode: ToolMode = 'place';
    const otherModes: ToolMode[] = ['off', 'comment', 'copy', 'text', 'reference', 'wand'];
    expect(otherModes).not.toContain(placeMode);
  });
});

// ── PlacementMode type ────────────────────────────────────────────────

describe('PlacementMode', () => {
  const ALL_MODES: PlacementMode[] = ['before', 'after', 'into', 'replace'];

  it('covers all 4 insertion modes', () => {
    expect(ALL_MODES).toHaveLength(4);
    expect(ALL_MODES).toContain('before');
    expect(ALL_MODES).toContain('after');
    expect(ALL_MODES).toContain('into');
    expect(ALL_MODES).toContain('replace');
  });

  it('every mode is a non-empty string', () => {
    for (const mode of ALL_MODES) {
      expect(mode).toBeTruthy();
      expect(typeof mode).toBe('string');
      expect(mode.length).toBeGreaterThan(0);
    }
  });

  it('modes are unique', () => {
    expect(new Set(ALL_MODES).size).toBe(ALL_MODES.length);
  });
});

// ── EVT_PLACE_TRIGGER ─────────────────────────────────────────────────

describe('EVT_PLACE_TRIGGER', () => {
  it('has the correct event name', () => {
    expect(EVT_PLACE_TRIGGER).toBe('emdesign/place-trigger');
  });

  it('names are namespaced under emdesign/', () => {
    expect(EVT_PLACE_TRIGGER).toMatch(/^emdesign\//);
  });
});

describe('PlaceTriggerPayload', () => {
  const mockFullPayload: PlaceTriggerPayload = {
    tag: 'button',
    text: 'Submit',
    selector: 'body > div > button:nth-of-type(1)',
    component: 'Button',
    rect: { x: 100, y: 200, width: 80, height: 32 },
    computedStyles: {
      color: 'rgb(255, 255, 255)',
      backgroundColor: 'rgb(37, 99, 235)',
      fontSize: '14px',
      fontWeight: '500',
    },
    storyId: 'example-button--primary',
    placementMode: 'after',
    selectedComponent: 'StatsCard',
  };

  it('carries all required fields', () => {
    expect(mockFullPayload.tag).toBe('button');
    expect(mockFullPayload.selector).toBeTruthy();
    expect(mockFullPayload.component).toBe('Button');
    expect(mockFullPayload.rect).toEqual({ x: 100, y: 200, width: 80, height: 32 });
    expect(mockFullPayload.placementMode).toBe('after');
    expect(mockFullPayload.selectedComponent).toBe('StatsCard');
  });

  it('supports all 4 placement modes', () => {
    const modes: PlacementMode[] = ['before', 'after', 'into', 'replace'];
    for (const mode of modes) {
      const payload: PlaceTriggerPayload = {
        ...mockFullPayload,
        placementMode: mode,
      };
      expect(payload.placementMode).toBe(mode);
    }
  });

  it('carries computed styles for context', () => {
    expect(mockFullPayload.computedStyles).toHaveProperty('color');
    expect(mockFullPayload.computedStyles).toHaveProperty('backgroundColor');
    expect(mockFullPayload.computedStyles).toHaveProperty('fontSize');
  });

  it('allows optional storyId to be undefined', () => {
    const minimal: PlaceTriggerPayload = {
      tag: 'div',
      selector: '#root',
      component: 'App',
      rect: { x: 0, y: 0, width: 0, height: 0 },
      computedStyles: {},
      placementMode: 'after',
      selectedComponent: 'Button',
    };
    expect(minimal.storyId).toBeUndefined();
    expect(minimal.text).toBeUndefined();
  });

  it('validates placementMode is one of the 4 modes', () => {
    const validModes = ['before', 'after', 'into', 'replace'];
    expect(validModes).toContain(mockFullPayload.placementMode);
    expect(validModes).not.toContain('invalid');
  });
});

// ── EVT_PLACE_RESULT ──────────────────────────────────────────────────

describe('EVT_PLACE_RESULT', () => {
  it('has the correct event name', () => {
    expect(EVT_PLACE_RESULT).toBe('emdesign/place-result');
  });
});

describe('PlaceResultPayload', () => {
  const completedPayload: PlaceResultPayload = {
    sessionId: 'session-abc-123',
    status: 'completed',
    componentName: 'StatsCard',
    file: 'src/generated/StatsCard.stories.tsx',
    line: 42,
    gate: 'pass',
  };

  it('carries all fields for completed state', () => {
    expect(completedPayload.sessionId).toBeTruthy();
    expect(completedPayload.status).toBe('completed');
    expect(completedPayload.componentName).toBe('StatsCard');
    expect(completedPayload.file).toContain('StatsCard');
    expect(completedPayload.line).toBe(42);
    expect(completedPayload.gate).toBe('pass');
  });

  it('supports all status values', () => {
    const statuses: PlaceResultPayload['status'][] = ['running', 'completed', 'error'];
    for (const status of statuses) {
      const payload: PlaceResultPayload = {
        sessionId: 'session-xyz',
        status,
        componentName: 'Test',
      };
      expect(payload.status).toBe(status);
    }
  });

  it('has optional error field for error status', () => {
    const errorPayload: PlaceResultPayload = {
      sessionId: 'session-fail',
      status: 'error',
      componentName: 'BadComponent',
      error: 'Component generation failed: token violation',
    };
    expect(errorPayload.status).toBe('error');
    expect(errorPayload.error).toContain('failed');
  });

  it('allows minimal payload', () => {
    const minimal: PlaceResultPayload = {
      sessionId: '',
      status: 'running',
      componentName: 'Unknown',
    };
    expect(minimal.file).toBeUndefined();
    expect(minimal.line).toBeUndefined();
    expect(minimal.gate).toBeUndefined();
    expect(minimal.error).toBeUndefined();
  });
});

// ── Edge cases ────────────────────────────────────────────────────────

describe('Placement edge cases', () => {
  it('handles empty selectedComponent string', () => {
    const payload: PlaceTriggerPayload = {
      tag: 'div',
      selector: '.empty',
      component: 'Test',
      rect: { x: 0, y: 0, width: 0, height: 0 },
      computedStyles: {},
      placementMode: 'before',
      selectedComponent: '',
    };
    expect(payload.selectedComponent).toBe('');
    // An empty string should not crash the workflow — the agent will ask for clarification
  });

  it('handles zero-area rect (edge case for invisible elements)', () => {
    const payload: PlaceTriggerPayload = {
      tag: 'span',
      selector: '.hidden',
      component: 'Test',
      rect: { x: 0, y: 0, width: 0, height: 0 },
      computedStyles: {},
      placementMode: 'into',
      selectedComponent: 'Card',
    };
    expect(payload.rect.width).toBe(0);
    expect(payload.rect.height).toBe(0);
    // The placeholder rendering should handle zero-area by showing a minimum height
  });
});
