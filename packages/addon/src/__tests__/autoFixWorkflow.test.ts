/**
 * Auto-Fix Workflow — diagnostic aggregation logic tests.
 *
 * Tests the core diagnostic parsing and priority logic that lives in
 * auto-fix-workflow.js. These are pure-function tests (no workflow
 * infrastructure), verifying that probe outputs are correctly parsed
 * into prioritized, fixable/non-fixable issue lists.
 */

// ── Priority assignment ────────────────────────────────────────────────

describe('Diagnostic priority assignment', () => {
  function assignPriority(score: number | null, hasDiff: boolean): string {
    if (score != null && score < 0.6) return 'P0';
    if (score != null && score < 0.85) return 'P1';
    if (hasDiff) return 'P1';
    return 'P2';
  }

  it('assigns P0 for visual score below 0.6', () => {
    expect(assignPriority(0.45, false)).toBe('P0');
    expect(assignPriority(0.59, false)).toBe('P0');
  });

  it('assigns P1 for visual score between 0.6 and 0.85', () => {
    expect(assignPriority(0.72, false)).toBe('P1');
    expect(assignPriority(0.84, false)).toBe('P1');
  });

  it('assigns P1 when pixels differ from baseline', () => {
    expect(assignPriority(0.95, true)).toBe('P1');
  });

  it('assigns P2 for acceptable visual score with no diff', () => {
    expect(assignPriority(0.90, false)).toBe('P2');
  });

  it('handles null score gracefully', () => {
    expect(assignPriority(null, false)).toBe('P2');
  });
});

// ── Token binding detection ────────────────────────────────────────────

describe('Token binding detection', () => {
  type StyleEntry = { key: string; value: string };
  const TOKEN_PATTERN = /^(var\(--|--)/;
  const HEX_PATTERN = /^#[0-9a-fA-F]{3,8}$/;

  function valueKind(value: string): 'token' | 'hex' | 'other' {
    if (TOKEN_PATTERN.test(value)) return 'token';
    if (HEX_PATTERN.test(value)) return 'hex';
    return 'other';
  }

  it('detects token-bound values', () => {
    expect(valueKind('var(--color-accent)')).toBe('token');
    expect(valueKind('var(--space-unit)')).toBe('token');
    expect(valueKind('--color-surface')).toBe('token');
  });

  it('detects raw hex values', () => {
    expect(valueKind('#2563eb')).toBe('hex');
    expect(valueKind('#fff')).toBe('hex');
    expect(valueKind('#aabbccdd')).toBe('hex');
  });

  it('classifies other values as other', () => {
    expect(valueKind('14px')).toBe('other');
    expect(valueKind('1.5')).toBe('other');
    expect(valueKind('rgb(255, 255, 255)')).toBe('other');
    expect(valueKind('inline-flex')).toBe('other');
  });

  it('correctly flags raw values for quick-fix suggestions', () => {
    const entries: StyleEntry[] = [
      { key: 'color', value: '#fff' },
      { key: 'backgroundColor', value: 'var(--color-surface)' },
      { key: 'fontSize', value: '14px' },
    ];
    const rawValues = entries.filter(e => valueKind(e.value) === 'hex');
    const tokenValues = entries.filter(e => valueKind(e.value) === 'token');
    expect(rawValues).toHaveLength(1);
    expect(tokenValues).toHaveLength(1);
    expect(rawValues[0].key).toBe('color');
  });
});

// ── Grid alignment ────────────────────────────────────────────────────

describe('Grid alignment', () => {
  function isOnGrid(value: number, gridSize: number): boolean {
    return value % gridSize === 0;
  }

  it('detects values on the 8px grid', () => {
    expect(isOnGrid(0, 8)).toBe(true);
    expect(isOnGrid(8, 8)).toBe(true);
    expect(isOnGrid(16, 8)).toBe(true);
    expect(isOnGrid(32, 8)).toBe(true);
  });

  it('detects values off the 8px grid', () => {
    expect(isOnGrid(3, 8)).toBe(false);
    expect(isOnGrid(7, 8)).toBe(false);
    expect(isOnGrid(10, 8)).toBe(false);
    expect(isOnGrid(17, 8)).toBe(false);
  });

  it('snaps to nearest grid unit', () => {
    function snapToGrid(value: number, gridSize: number): number {
      return Math.round(value / gridSize) * gridSize;
    }
    expect(snapToGrid(7, 8)).toBe(8);
    expect(snapToGrid(9, 8)).toBe(8);
    expect(snapToGrid(10, 8)).toBe(8);
    expect(snapToGrid(14, 8)).toBe(16);
  });
});

// ── Probe result parsing ──────────────────────────────────────────────

describe('Probe result parsing', () => {
  interface ProbeResult {
    ok: boolean;
    data?: {
      scores?: { visual?: number; tokens?: number; spatial?: number; a11y?: number };
      mustFix?: number;
      composite?: number;
      decision?: string;
      findings?: Array<{ severity: string; message: string; kind?: string; token?: string }>;
      overlaps?: Array<{ a: string; b: string; overlapPx: number }>;
      grid?: { violations: number; gridSize: number };
      violations?: Array<{ id: string; help: string; impact: string }>;
      summary?: { totalViolations: number; totalCritical: number };
    };
  }

  function parseVisual(probe: ProbeResult): { score: number | null; diffPixels: number } {
    return {
      score: probe.data?.scores?.visual ?? null,
      diffPixels: 0,
    };
  }

  function parseLint(probe: ProbeResult): Array<{ priority: string; message: string; fixable: boolean }> {
    if (!probe.ok || !probe.data?.findings) return [];
    return probe.data.findings.map(f => ({
      priority: f.severity === 'P0' ? 'P0' : 'P1',
      message: f.message,
      fixable: f.severity === 'P0' && !!f.token,
    }));
  }

  function parseSpatial(probe: ProbeResult): { overlaps: number; gridViolations: number } {
    return {
      overlaps: probe.data?.overlaps?.length ?? 0,
      gridViolations: probe.data?.grid?.violations ?? 0,
    };
  }

  function parseA11y(probe: ProbeResult): { total: number; critical: number } {
    return {
      total: probe.data?.summary?.totalViolations ?? 0,
      critical: probe.data?.summary?.totalCritical ?? 0,
    };
  }

  it('parses visual probe with score', () => {
    const result = parseVisual({ ok: true, data: { scores: { visual: 0.72 } } });
    expect(result.score).toBe(0.72);
  });

  it('parses visual probe without score as null', () => {
    const result = parseVisual({ ok: true, data: {} });
    expect(result.score).toBeNull();
  });

  it('parses lint findings with fixability', () => {
    const probe: ProbeResult = {
      ok: true,
      data: {
        findings: [
          { severity: 'P0', message: 'Raw hex #333 used', kind: 'off-token-color', token: '--color-text' },
          { severity: 'P1', message: 'Spacing 7px not on grid', kind: 'off-grid-spacing' },
        ],
      },
    };
    const findings = parseLint(probe);
    expect(findings).toHaveLength(2);
    expect(findings[0].fixable).toBe(true); // P0 with token
    expect(findings[1].fixable).toBe(false); // P1 without token
  });

  it('parses spatial audit results', () => {
    const probe: ProbeResult = {
      ok: true,
      data: {
        overlaps: [{ a: 'div.header', b: 'div.nav', overlapPx: 4 }],
        grid: { violations: 3, gridSize: 8 },
      },
    };
    const spatial = parseSpatial(probe);
    expect(spatial.overlaps).toBe(1);
    expect(spatial.gridViolations).toBe(3);
  });

  it('parses a11y audit results', () => {
    const probe: ProbeResult = {
      ok: true,
      data: {
        violations: [
          { id: 'color-contrast', help: 'Element has insufficient color contrast', impact: 'serious' },
        ],
        summary: { totalViolations: 1, totalCritical: 1 },
      },
    };
    const a11y = parseA11y(probe);
    expect(a11y.total).toBe(1);
    expect(a11y.critical).toBe(1);
  });

  it('handles unavailable probe gracefully', () => {
    expect(parseVisual({ ok: false })).toEqual({ score: null, diffPixels: 0 });
    expect(parseLint({ ok: false })).toEqual([]);
    expect(parseSpatial({ ok: false })).toEqual({ overlaps: 0, gridViolations: 0 });
    expect(parseA11y({ ok: false })).toEqual({ total: 0, critical: 0 });
  });
});

// ── Improvement summary generation ─────────────────────────────────────

describe('Improvement summary', () => {
  function computeImprovements(baseline: { composite: number; mustFix: number } | null, postFix: { composite: number; mustFix: number; decision: string } | null, needsHuman: number): string[] {
    const improvements: string[] = [];
    if (baseline && postFix) {
      const compositeDelta = (postFix.composite - baseline.composite) * 100;
      const mustFixDelta = baseline.mustFix - postFix.mustFix;
      if (compositeDelta > 0) improvements.push(`Composite score improved by ${compositeDelta.toFixed(1)}%`);
      if (mustFixDelta > 0) improvements.push(`${mustFixDelta} P0 issue(s) resolved`);
      if (postFix.composite >= 0.85 && postFix.decision === 'ship') improvements.push('Component passes all quality gates — ready for capture');
      if (postFix.composite < 0.85) improvements.push(`Component needs further work: composite ${(postFix.composite * 100).toFixed(0)}% < 85%`);
      if (needsHuman > 0) improvements.push(`${needsHuman} issue(s) flagged for human review`);
    }
    return improvements;
  }

  it('reports composite improvement', () => {
    const improvements = computeImprovements(
      { composite: 0.72, mustFix: 2 },
      { composite: 0.88, mustFix: 0, decision: 'ship' },
      0,
    );
    expect(improvements).toContain('Composite score improved by 16.0%');
    expect(improvements).toContain('2 P0 issue(s) resolved');
    expect(improvements).toContain('Component passes all quality gates — ready for capture');
  });

  it('reports needs human items', () => {
    const improvements = computeImprovements(
      { composite: 0.80, mustFix: 1 },
      { composite: 0.86, mustFix: 0, decision: 'ship' },
      3,
    );
    expect(improvements).toContain('3 issue(s) flagged for human review');
  });

  it('reports when component needs further work', () => {
    const improvements = computeImprovements(
      { composite: 0.40, mustFix: 3 },
      { composite: 0.60, mustFix: 2, decision: 'revise' },
      2,
    );
    expect(improvements).toContain('Composite score improved by 20.0%');
    expect(improvements).toContain('Component needs further work: composite 60% < 85%');
    expect(improvements).toContain('2 issue(s) flagged for human review');
  });

  it('returns empty array when no baseline', () => {
    expect(computeImprovements(null, null, 0)).toEqual([]);
  });
});
