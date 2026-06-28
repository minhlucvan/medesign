/**
 * Wand / Auto-Fix Tool — unit tests.
 *
 * These tests verify the auto-fix wand tool:
 * - ToolMode includes 'wand'
 * - EVT_WAND_TRIGGER carries the correct payload shape
 * - EVT_WAND_RESULT carries the correct payload shape
 * - Shift+click vision flag behavior
 * - Diagnostic summary structure
 */

import { EVT_WAND_TRIGGER, EVT_WAND_RESULT, type WandTriggerPayload, type WandResultPayload, type ToolMode } from '../channel';

// ── ToolMode contract ─────────────────────────────────────────────────

describe('ToolMode wand', () => {
  it('includes wand as a valid ToolMode', () => {
    const mode: ToolMode = 'wand';
    expect(mode).toBe('wand');
  });

  it('is compatible with tool mode switching', () => {
    const modes: ToolMode[] = ['off', 'comment', 'copy', 'text', 'reference', 'wand', 'place'];
    expect(modes).toContain('wand');
    // Wand mode toggles off when pressed again (same as other tools)
    const isActive = true;
    const nextMode: ToolMode = isActive ? 'off' : 'wand';
    expect(nextMode).toBe('off');
  });
});

// ── EVT_WAND_TRIGGER ─────────────────────────────────────────────────

describe('EVT_WAND_TRIGGER', () => {
  it('has the correct event name', () => {
    expect(EVT_WAND_TRIGGER).toBe('emdesign/wand-trigger');
  });
});

describe('WandTriggerPayload', () => {
  const mockPayload: WandTriggerPayload = {
    tag: 'button',
    text: 'Click me',
    selector: 'body > div > button.primary',
    component: 'Button',
    rect: { x: 100, y: 200, width: 80, height: 32 },
    computedStyles: {
      color: 'rgb(255, 255, 255)',
      backgroundColor: 'rgb(37, 99, 235)',
      fontSize: '14px',
      fontWeight: '500',
      paddingTop: '8px',
      paddingBottom: '8px',
      paddingLeft: '16px',
      paddingRight: '16px',
      borderRadius: '6px',
      boxShadow: 'none',
      display: 'inline-flex',
      position: 'relative',
    },
    storyId: 'example-button--primary',
    vision: false,
  };

  it('carries all required fields', () => {
    expect(mockPayload.tag).toBe('button');
    expect(mockPayload.selector).toContain('button');
    expect(mockPayload.component).toBe('Button');
    expect(mockPayload.rect.width).toBe(80);
    expect(mockPayload.rect.height).toBe(32);
    expect(mockPayload.vision).toBe(false);
  });

  it('has vision flag false by default', () => {
    expect(mockPayload.vision).toBe(false);
  });

  it('can enable vision critique via Shift+click', () => {
    const visionPayload: WandTriggerPayload = { ...mockPayload, vision: true };
    expect(visionPayload.vision).toBe(true);
  });

  it('carries computed styles for diagnostic analysis', () => {
    expect(mockPayload.computedStyles).toHaveProperty('color');
    expect(mockPayload.computedStyles).toHaveProperty('backgroundColor');
    expect(mockPayload.computedStyles).toHaveProperty('fontSize');
    expect(mockPayload.computedStyles).toHaveProperty('paddingTop');
    expect(mockPayload.computedStyles).toHaveProperty('borderRadius');
    expect(mockPayload.computedStyles).toHaveProperty('display');
  });

  it('allows minimal payload with empty text', () => {
    const minimal: WandTriggerPayload = {
      tag: 'div',
      text: '',
      selector: '#root',
      component: 'App',
      rect: { x: 0, y: 0, width: 0, height: 0 },
      computedStyles: {},
      vision: false,
    };
    expect(minimal.text).toBe('');
    expect(minimal.storyId).toBeUndefined();
  });

  it('can be constructed with storyId context', () => {
    expect(mockPayload.storyId).toBe('example-button--primary');
  });
});

// ── EVT_WAND_RESULT ──────────────────────────────────────────────────

describe('EVT_WAND_RESULT', () => {
  it('has the correct event name', () => {
    expect(EVT_WAND_RESULT).toBe('emdesign/wand-result');
  });
});

describe('WandResultPayload', () => {
  const completedResult: WandResultPayload = {
    sessionId: 'wand-session-001',
    status: 'completed',
    diagnosticSummary: {
      total: 5,
      p0: 1,
      p1: 2,
      p2: 2,
      fixable: 3,
      needsHuman: 2,
    },
    autoFixable: [
      { type: 'token-binding', message: 'Replace #2563eb with token --color-accent', priority: 'P0' },
      { type: 'spacing', message: 'Snap padding to 8px grid', priority: 'P1' },
      { type: 'grid-alignment', message: 'Snap to 8px grid', priority: 'P1' },
    ],
    needsHuman: [
      { type: 'visual-regression', message: 'Visual score 72% — below 85% threshold', priority: 'P1' },
      { type: 'a11y-violation', message: 'color-contrast: Element has insufficient color contrast', priority: 'P0' },
    ],
    applied: [
      { message: 'Replace #2563eb with token --color-accent', status: 'applied' },
      { message: 'Snap padding to 8px grid', status: 'applied' },
    ],
    gate: 'pass',
    improvements: [
      'Composite score improved by 12.0%',
      '1 P0 issue(s) resolved',
      'Component passes all quality gates',
    ],
    elapsed: 2847,
  };

  it('carries full completion result', () => {
    expect(completedResult.sessionId).toBe('wand-session-001');
    expect(completedResult.status).toBe('completed');
    expect(completedResult.gate).toBe('pass');
  });

  it('has diagnostic summary with all counts', () => {
    const summary = completedResult.diagnosticSummary!;
    expect(summary.total).toBe(5);
    expect(summary.p0).toBe(1);
    expect(summary.p1).toBe(2);
    expect(summary.p2).toBe(2);
    expect(summary.fixable).toBe(3);
    expect(summary.needsHuman).toBe(2);
    // Verify total is sum of P0 + P1 + P2
    expect(summary.total).toBe(summary.p0 + summary.p1 + summary.p2);
  });

  it('lists auto-fixable issues with priority and type', () => {
    expect(completedResult.autoFixable).toHaveLength(3);
    const p0 = completedResult.autoFixable![0];
    expect(p0.priority).toBe('P0');
    expect(p0.type).toBe('token-binding');
    expect(p0.message).toContain('#2563eb');
  });

  it('lists needs-human issues separately', () => {
    expect(completedResult.needsHuman).toHaveLength(2);
    const a11y = completedResult.needsHuman![1];
    expect(a11y.type).toBe('a11y-violation');
    expect(a11y.priority).toBe('P0');
  });

  it('tracks applied fixes with status', () => {
    const applied = completedResult.applied!;
    expect(applied).toHaveLength(2);
    expect(applied.every(a => a.status === 'applied')).toBe(true);
  });

  it('includes improvement summary', () => {
    expect(completedResult.improvements).toHaveLength(3);
    expect(completedResult.improvements![0]).toContain('improved');
  });

  it('records elapsed time in ms', () => {
    expect(completedResult.elapsed).toBeGreaterThan(0);
    expect(completedResult.elapsed).toBeLessThan(60000); // less than 1 min
  });

  it('supports running status', () => {
    const running: WandResultPayload = {
      sessionId: 'wand-session-002',
      status: 'running',
    };
    expect(running.status).toBe('running');
    expect(running.diagnosticSummary).toBeUndefined();
  });

  it('supports rolled-back status', () => {
    const rolledBack: WandResultPayload = {
      sessionId: 'wand-session-003',
      status: 'rolled-back',
      gate: 'regression',
      improvements: ['Auto-fix reverted — composite dropped by 8%'],
    };
    expect(rolledBack.status).toBe('rolled-back');
    expect(rolledBack.gate).toBe('regression');
  });

  it('supports error status with message', () => {
    const error: WandResultPayload = {
      sessionId: 'wand-session-004',
      status: 'error',
      error: 'Backend unreachable: Storybook not running',
    };
    expect(error.status).toBe('error');
    expect(error.error).toContain('Backend');
  });
});

// ── Auto-fix diagnostic logic ─────────────────────────────────────────

describe('Auto-fix diagnostic aggregation', () => {
  // Simulates the diagnostic parsing logic from auto-fix-workflow.js
  type Finding = {
    priority: 'P0' | 'P1' | 'P2';
    source: string;
    type: string;
    message: string;
    fixable: boolean;
    fixCandidate?: { type: string; file?: string; line?: number };
  };

  function makeFindings(findings: Finding[]): Finding[] {
    return findings
      .filter(Boolean)
      .sort((a, b) => a.priority.localeCompare(b.priority));
  }

  it('sorts findings P0 first, then P1, then P2', () => {
    const findings: Finding[] = [
      { priority: 'P2', source: 'render', type: 'deep-dom', message: 'DOM depth 16', fixable: false },
      { priority: 'P0', source: 'lint', type: 'token-binding', message: 'Raw hex #333', fixable: true },
      { priority: 'P1', source: 'spatial', type: 'overlap', message: 'div overlaps span by 4px', fixable: true },
    ];
    const sorted = makeFindings(findings);
    expect(sorted[0].priority).toBe('P0');
    expect(sorted[1].priority).toBe('P1');
    expect(sorted[2].priority).toBe('P2');
  });

  it('filters out null/undefined findings', () => {
    const findings: (Finding | null)[] = [
      { priority: 'P0', source: 'lint', type: 'token-binding', message: 'Fix this', fixable: true },
      null,
      undefined as unknown as Finding,
      { priority: 'P1', source: 'spatial', type: 'overlap', message: 'Overlap', fixable: false },
    ];
    const filtered = makeFindings(findings.filter(Boolean) as Finding[]);
    expect(filtered).toHaveLength(2);
  });

  it('determines fixability for token violations', () => {
    const tokenFindings: Finding[] = [
      {
        priority: 'P0', source: 'lint', type: 'token-binding',
        message: 'Replace #2563eb with --color-accent',
        fixable: true,
        fixCandidate: { type: 'token-binding', file: 'Button.tsx', line: 12 },
      },
      {
        priority: 'P1', source: 'spatial', type: 'overlap',
        message: 'div overlaps span by 4px',
        fixable: true, // small overlaps <= 10px are fixable
      },
      {
        priority: 'P0', source: 'a11y', type: 'a11y-violation',
        message: 'color-contrast: insufficient contrast',
        fixable: false, // a11y always needs human
      },
    ];
    const fixable = tokenFindings.filter(f => f.fixable);
    const needsHuman = tokenFindings.filter(f => !f.fixable);
    expect(fixable).toHaveLength(2);
    expect(needsHuman).toHaveLength(1);
    expect(needsHuman[0].source).toBe('a11y');
  });
});
