/**
 * From-Existing-Project creator + adoption-report triage — view tests.
 *
 * Unit 06 of `ds-from-existing-project`. These tests pin the CLIENT-SIDE view
 * logic only — the addon System-tab "From Existing Project" path is
 * implementation-only with NO spec contract: it is a display/triage client over
 * the read-only `design-surface-api` (progress + report). Triage decisions
 * persist nothing (no write-back).
 *
 * Scenarios consumed (read-only):
 *   - design-surface-api: "Client subscribes to workflow progress"
 *   - design-surface-api: "Adoption report is served"
 *   - component-adoption: "Report classifies components" (loop-ready vs
 *     needs-manual-fix, blocking value + location)
 *   - component-adoption: "Ambiguous value is left for manual fix" (candidate
 *     roles surfaced)
 *   - README invariant: "Triage UI is display-only — no write-back persistence."
 *
 * The components imported below do NOT exist yet → this file fails (RED) at
 * module resolution until the Green step creates them.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';

// ── New components (do not exist yet → RED) ─────────────────────────────
import {
  FromProjectCreator,
  type ProjectStageEvent,
} from '../SystemTab/FromProjectCreator';
import {
  AdoptionReportTriage,
  type AdoptionReport,
} from '../SystemTab/AdoptionReportTriage';

// =============================================================================
// Test harness — render into a jsdom container with createRoot + flushSync
// (the addon convention; see orchestrator.test.tsx). No @testing-library dep.
// =============================================================================

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  try {
    flushSync(() => root.unmount());
  } catch {
    /* already unmounted */
  }
  container.remove();
  vi.restoreAllMocks();
});

function render(node: React.ReactElement): void {
  flushSync(() => root.render(node));
}

function click(el: Element | null | undefined): void {
  if (!el) throw new Error('click target not found');
  flushSync(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function typeInto(input: HTMLInputElement, value: string): void {
  flushSync(() => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

const q = (root: Element, sel: string): Element[] =>
  Array.from(root.querySelectorAll(sel));
const q1 = (root: Element, sel: string): Element | null => root.querySelector(sel);
const text = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

// =============================================================================
// Creator input — renders a project-path / current-workspace input and starts
// the flow when submitted (design-surface-api: workflow is started/subscribed).
// =============================================================================

describe('FromProjectCreator — creator input', () => {
  it('renders a project-path input, a current-workspace toggle, and a start action', () => {
    render(<FromProjectCreator start={vi.fn().mockResolvedValue({ sessionId: 's1' })} />);
    expect(q1(container, '[data-testid="project-path-input"]')).not.toBeNull();
    expect(q1(container, '[data-testid="use-current-workspace"]')).not.toBeNull();
    expect(q1(container, '[data-testid="start-adoption"]')).not.toBeNull();
  });

  it('starts the flow with the typed project path on submit', async () => {
    const start = vi.fn().mockResolvedValue({ sessionId: 'sess-42' });
    render(<FromProjectCreator start={start} />);

    typeInto(
      q1(container, '[data-testid="project-path-input"]') as HTMLInputElement,
      '/work/acme-app',
    );
    click(q1(container, '[data-testid="start-adoption"]'));
    await flushMicrotasks();

    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ projectPath: '/work/acme-app', useCurrentWorkspace: false }),
    );
  });

  it('starts against the current workspace when that option is selected', async () => {
    const start = vi.fn().mockResolvedValue({ sessionId: 'sess-cur' });
    render(<FromProjectCreator start={start} />);

    click(q1(container, '[data-testid="use-current-workspace"]'));
    click(q1(container, '[data-testid="start-adoption"]'));
    await flushMicrotasks();

    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ useCurrentWorkspace: true }),
    );
  });

  it('does not start when neither a path nor current-workspace is provided', () => {
    const start = vi.fn().mockResolvedValue({ sessionId: 's' });
    render(<FromProjectCreator start={start} />);
    click(q1(container, '[data-testid="start-adoption"]'));
    expect(start).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Live progress — given a stream of SSE stage events, render the stages in
// order with started/completed/failed status and surface intermediate
// artifacts as they arrive (design-surface-api: "Client subscribes to
// workflow progress").
// =============================================================================

describe('FromProjectCreator — live progress', () => {
  const stages: ProjectStageEvent[] = [
    { name: 'Extracting', status: 'completed', artifact: { label: 'roles', value: '12 token roles' } },
    { name: 'Synthesizing', status: 'completed', artifact: { label: 'contract', value: 'DESIGN.md' } },
    { name: 'Adopting', status: 'started', artifact: { label: 'components', value: '8 placed' } },
    { name: 'Validating', status: 'failed', reason: 'consistency lint: 1 mustFix' },
  ];

  it('renders every stage in arrival order', () => {
    render(<FromProjectCreator start={vi.fn()} stages={stages} />);
    const rows = q(container, '[data-testid="stage-item"]');
    expect(rows.map(r => r.getAttribute('data-stage'))).toEqual([
      'Extracting',
      'Synthesizing',
      'Adopting',
      'Validating',
    ]);
  });

  it('reflects each stage status (started / completed / failed)', () => {
    render(<FromProjectCreator start={vi.fn()} stages={stages} />);
    const rows = q(container, '[data-testid="stage-item"]');
    expect(rows.map(r => r.getAttribute('data-status'))).toEqual([
      'completed',
      'completed',
      'started',
      'failed',
    ]);
  });

  it('surfaces the intermediate artifacts as they arrive', () => {
    render(<FromProjectCreator start={vi.fn()} stages={stages} />);
    const artifacts = q(container, '[data-testid="stage-artifact"]').map(text);
    expect(artifacts.join(' | ')).toContain('12 token roles');
    expect(artifacts.join(' | ')).toContain('DESIGN.md');
    expect(artifacts.join(' | ')).toContain('8 placed');
  });

  it('shows the failing stage reason for a failed stage', () => {
    render(<FromProjectCreator start={vi.fn()} stages={stages} />);
    expect(text(container)).toContain('consistency lint: 1 mustFix');
  });
});

// =============================================================================
// Triage classification — group components into loop-ready vs needs-manual-fix
// and list each blocking value with its location (component-adoption: "Report
// classifies components" + "Ambiguous value is left for manual fix").
// =============================================================================

const report: AdoptionReport = {
  components: [
    {
      name: 'Button',
      status: 'loop-ready',
      rebinds: [{ before: '#ffffff', after: 'bg-surface', location: 'Button.tsx:12' }],
      blockingValues: [],
    },
    {
      name: 'Badge',
      status: 'loop-ready',
      rebinds: [],
      blockingValues: [],
    },
    {
      name: 'Card',
      status: 'needs-manual-fix',
      rebinds: [{ before: '#000000', after: 'text-default', location: 'Card.tsx:5' }],
      blockingValues: [
        { value: '#3a3a3a', location: 'Card.tsx:21', candidateRoles: ['text-muted', 'border-default'] },
      ],
    },
    {
      name: 'Modal',
      status: 'needs-manual-fix',
      rebinds: [],
      blockingValues: [{ value: '13px', location: 'Modal.tsx:40' }],
    },
  ],
};

describe('AdoptionReportTriage — classification', () => {
  it('groups loop-ready components separately from needs-manual-fix', () => {
    render(<AdoptionReportTriage report={report} />);

    const ready = q1(container, '[data-testid="group-loop-ready"]')!;
    const manual = q1(container, '[data-testid="group-needs-manual-fix"]')!;
    expect(ready).not.toBeNull();
    expect(manual).not.toBeNull();

    const readyNames = q(ready, '[data-testid="component-item"]').map(el =>
      el.getAttribute('data-component'),
    );
    const manualNames = q(manual, '[data-testid="component-item"]').map(el =>
      el.getAttribute('data-component'),
    );

    expect(readyNames.sort()).toEqual(['Badge', 'Button']);
    expect(manualNames.sort()).toEqual(['Card', 'Modal']);
  });

  it('lists each blocking value with its location for needs-manual-fix components', () => {
    render(<AdoptionReportTriage report={report} />);
    const blocking = q(container, '[data-testid="blocking-value"]').map(text).join(' || ');
    expect(blocking).toContain('#3a3a3a');
    expect(blocking).toContain('Card.tsx:21');
    expect(blocking).toContain('13px');
    expect(blocking).toContain('Modal.tsx:40');
  });

  it('surfaces candidate roles for an ambiguous blocking value', () => {
    render(<AdoptionReportTriage report={report} />);
    const all = text(container);
    expect(all).toContain('text-muted');
    expect(all).toContain('border-default');
  });

  it('does not list any blocking value for loop-ready components', () => {
    render(<AdoptionReportTriage report={report} />);
    const ready = q1(container, '[data-testid="group-loop-ready"]')!;
    expect(q(ready, '[data-testid="blocking-value"]')).toHaveLength(0);
  });
});

// =============================================================================
// View-state only — marking a rebind reviewed / a component for follow-up
// updates LOCAL view state and triggers NO write-back / persistence call.
// (README invariant: the triage UI is display-only over the read-only surface.)
// =============================================================================

describe('AdoptionReportTriage — view-state only (no write-back)', () => {
  it('marking a rebind reviewed toggles local state without any network call', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as never);
    render(<AdoptionReportTriage report={report} />);

    const toggle = q1(container, '[data-testid="rebind-review-toggle"]')!;
    expect(toggle).not.toBeNull();
    const row = toggle.closest('[data-testid="rebind-row"]')!;
    expect(row.getAttribute('data-reviewed')).not.toBe('true');

    click(toggle);

    expect(row.getAttribute('data-reviewed')).toBe('true');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('marking a component for follow-up toggles local state without any network call', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as never);
    render(<AdoptionReportTriage report={report} />);

    const toggle = q1(container, '[data-testid="component-followup-toggle"]')!;
    expect(toggle).not.toBeNull();
    const item = toggle.closest('[data-testid="component-item"]')!;
    expect(item.getAttribute('data-followup')).not.toBe('true');

    click(toggle);

    expect(item.getAttribute('data-followup')).toBe('true');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('exposes no persistence/save action prop on the triage view', () => {
    // Display-only: the component renders correctly with only a read-only
    // `report` prop — there is no required save/persist callback.
    render(<AdoptionReportTriage report={report} />);
    expect(q1(container, '[data-testid="group-loop-ready"]')).not.toBeNull();
  });
});
