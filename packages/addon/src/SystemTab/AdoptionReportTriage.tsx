/**
 * AdoptionReportTriage — read-only triage view over the adoption report.
 *
 * Unit 06 of `ds-from-existing-project`. Implementation-only (no spec
 * contract): a DISPLAY client over the read-only `design-surface-api` adoption
 * report. It groups components into loop-ready vs needs-manual-fix and lists
 * each blocking value (with candidate roles). "Mark reviewed" / "follow-up" are
 * CLIENT-ONLY view state — the view never writes back / persists anything.
 */

import React, { useState } from 'react';

export interface AdoptionRebind {
  before: string;
  after: string;
  location: string;
}

export interface AdoptionBlockingValue {
  value: string;
  location: string;
  candidateRoles?: string[];
}

export type AdoptionComponentStatus = 'loop-ready' | 'needs-manual-fix';

export interface AdoptionComponent {
  name: string;
  status: AdoptionComponentStatus;
  rebinds: AdoptionRebind[];
  blockingValues: AdoptionBlockingValue[];
}

export interface AdoptionReport {
  components: AdoptionComponent[];
}

export interface AdoptionReportTriageProps {
  /** The read-only adoption report. No save/persist callback — display only. */
  report: AdoptionReport;
}

function ComponentCard({
  component,
  reviewed,
  toggleReview,
  followup,
  toggleFollowup,
}: {
  component: AdoptionComponent;
  reviewed: Record<string, boolean>;
  toggleReview: (key: string) => void;
  followup: boolean;
  toggleFollowup: () => void;
}) {
  return (
    <div
      data-testid="component-item"
      data-component={component.name}
      data-status={component.status}
      data-followup={followup ? 'true' : 'false'}
      style={{ border: '1px solid #ddd', borderRadius: 6, padding: 8, marginBottom: 6 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ flex: 1 }}>{component.name}</strong>
        <button
          data-testid="component-followup-toggle"
          type="button"
          aria-pressed={followup}
          onClick={toggleFollowup}
        >
          {followup ? 'Follow-up ✓' : 'Mark follow-up'}
        </button>
      </div>

      {component.rebinds.map((rb, i) => {
        const key = `${component.name}:${i}`;
        const isReviewed = !!reviewed[key];
        return (
          <div
            key={key}
            data-testid="rebind-row"
            data-reviewed={isReviewed ? 'true' : 'false'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 4 }}
          >
            <span style={{ flex: 1 }}>
              {rb.before} → {rb.after} <span style={{ opacity: 0.7 }}>({rb.location})</span>
            </span>
            <button
              data-testid="rebind-review-toggle"
              type="button"
              aria-pressed={isReviewed}
              onClick={() => toggleReview(key)}
            >
              {isReviewed ? 'Reviewed ✓' : 'Mark reviewed'}
            </button>
          </div>
        );
      })}

      {component.blockingValues.map((bv, i) => (
        <div
          key={`bv-${i}`}
          data-testid="blocking-value"
          style={{ fontSize: 12, marginTop: 4, color: '#a40' }}
        >
          <span>{bv.value}</span> <span style={{ opacity: 0.7 }}>({bv.location})</span>
          {bv.candidateRoles && bv.candidateRoles.length > 0 && (
            <span data-testid="candidate-roles" style={{ marginLeft: 6, opacity: 0.85 }}>
              candidates: {bv.candidateRoles.join(', ')}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function AdoptionReportTriage({ report }: AdoptionReportTriageProps) {
  // Client-only view state — never persisted / written back.
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [followup, setFollowup] = useState<Record<string, boolean>>({});

  const toggleReview = (key: string) =>
    setReviewed((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleFollowup = (name: string) =>
    setFollowup((prev) => ({ ...prev, [name]: !prev[name] }));

  const loopReady = report.components.filter((c) => c.status === 'loop-ready');
  const needsManual = report.components.filter((c) => c.status === 'needs-manual-fix');

  const renderGroup = (components: AdoptionComponent[]) =>
    components.map((c) => (
      <ComponentCard
        key={c.name}
        component={c}
        reviewed={reviewed}
        toggleReview={toggleReview}
        followup={!!followup[c.name]}
        toggleFollowup={() => toggleFollowup(c.name)}
      />
    ));

  return (
    <div data-testid="adoption-report-triage" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <section data-testid="group-loop-ready">
        <h4 style={{ margin: '0 0 6px' }}>Loop-ready ({loopReady.length})</h4>
        {renderGroup(loopReady)}
      </section>
      <section data-testid="group-needs-manual-fix">
        <h4 style={{ margin: '0 0 6px' }}>Needs manual fix ({needsManual.length})</h4>
        {renderGroup(needsManual)}
      </section>
    </div>
  );
}

export default AdoptionReportTriage;
