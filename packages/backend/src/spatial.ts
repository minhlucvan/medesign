/**
 * @emdesign/backend — spatial audit.
 *
 * Runs framework-level geometry charters against a component's rendered DOM snapshot
 * and returns structured findings for AI agent consumption.
 *
 * This is the programmatic counterpart to the `dsr/charters/geometry/` module —
 * it evaluates geometry charters at runtime and returns agent-friendly output
 * with coordinates, measurements, and remediation guidance.
 *
 * Used by the `spatial_audit` MCP tool.
 */

import { type ElementCharter, type RenderSnapshot, loadFrameworkCharters, buildDomTree, querySelectorAll } from '@emdesign/dsr';
import type { RepoPaths } from './paths.js';
import { renderSnapshot } from './renderProbe.js';
import type { RenderSnapshotOutput } from './renderProbe.js';

// ---------------------------------------------------------------------------
// Types — structured spatial finding for agent consumption
// ---------------------------------------------------------------------------

export interface SpatialFinding {
  /** Charter ID, e.g. "geometry/no-overlap" */
  charterId: string;
  /** Severity P0/P1/P2 */
  severity: string;
  /** Human-readable description of the finding */
  message: string;
  /** CSS selector of the primary element involved */
  target: string;
  /** CSS selector of the secondary element (if applicable, e.g. overlapped sibling) */
  relatedTarget?: string;
  /** Bounding box of the primary element */
  targetBox?: { x: number; y: number; width: number; height: number };
  /** Bounding box of the related element */
  relatedBox?: { x: number; y: number; width: number; height: number };
  /** Overlap/overflow measurement in px (horizontal × vertical where applicable) */
  measurement?: { x?: number; y?: number; max?: number };
  /** Suggested CSS remediation */
  remediation: string;
  /** Whether this finding is critical (P0) */
  isCritical: boolean;
}

export interface SpatialAuditResult {
  component: string;
  story: string;
  /** Number of findings */
  total: number;
  /** Number of critical findings (P0) */
  critical: number;
  /** All findings */
  findings: SpatialFinding[];
  /** Overall spatial score (0-1) */
  score: number;
}

// ---------------------------------------------------------------------------
// Core audit function
// ---------------------------------------------------------------------------

/**
 * Run a spatial audit against a component's rendered DOM.
 *
 * @param paths — RepoPaths for project configuration
 * @param component — Component name (PascalCase)
 * @param opts — Optional overrides (story, themes, extra charters)
 * @returns Structured spatial audit result
 */
export async function spatialAudit(
  paths: RepoPaths,
  component: string,
  opts: {
    story?: string;
    themes?: ('light' | 'dark')[];
    extraCharters?: ElementCharter[];
  } = {},
): Promise<SpatialAuditResult> {
  const { story = 'default', themes = ['light'], extraCharters = [] } = opts;

  // Capture the render snapshot
  let snapshots: RenderSnapshotOutput[];
  try {
    snapshots = await renderSnapshot(paths, component, { story, themes });
  } catch (err) {
    return {
      component,
      story,
      total: 1,
      critical: 0,
      findings: [{
        charterId: 'spatial-audit/error',
        severity: 'P2',
        message: `Could not render "${component}" (${story}): ${err instanceof Error ? err.message : String(err)}`,
        target: component,
        remediation: 'Ensure Storybook is running and the component story exists.',
        isCritical: false,
      }],
      score: 0.5,
    };
  }

  if (snapshots.length === 0) {
    return { component, story, total: 0, critical: 0, findings: [], score: 1 };
  }

  const allFindings: SpatialFinding[] = [];
  const charters = [...loadFrameworkCharters(), ...extraCharters];

  for (const snap of snapshots) {
    const renderSnap: RenderSnapshot = snap;
    const roots = buildDomTree(renderSnap);

    for (const charter of charters) {
      if (charter.matcher.type !== 'dom-selector') continue;

      const matchedElements = querySelectorAll(charter.matcher.selector, roots);
      const ctx = {
        layer: 'dom' as const,
        graph: {} as any,
        renders: [renderSnap],
        matchedElements,
      };

      try {
        const findings = charter.run(ctx);

        for (const f of findings) {
          // Try to extract the matched element's bounding box
          const matchedEl = matchedElements.find((m) => m.node.selector === f.target);
          const relatedElements = matchedElements.filter(
            (m) => m !== matchedEl && f.message.includes(m.node.selector),
          );

          // Parse overlap measurement from the message or target
          const measurement = parseMeasurement(f.message);

          allFindings.push({
            charterId: f.id,
            severity: f.severity,
            message: f.message,
            target: f.target ?? component,
            relatedTarget: relatedElements[0]?.node.selector,
            targetBox: matchedEl ? { ...matchedEl.node.box } : undefined,
            relatedBox: relatedElements[0] ? { ...relatedElements[0].node.box } : undefined,
            measurement: measurement ?? undefined,
            remediation: f.remediation ?? '',
            isCritical: f.severity === 'P0',
          });
        }
      } catch {
        // Charter threw — skip this charter for this snapshot
      }
    }
  }

  const critical = allFindings.filter((f) => f.isCritical).length;
  const score = allFindings.length === 0
    ? 1
    : Math.max(0, 1 - (critical * 0.34 + (allFindings.length - critical) * 0.12) / allFindings.length);

  return {
    component,
    story,
    total: allFindings.length,
    critical,
    findings: allFindings,
    score: Math.round(score * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse an overlap/overflow measurement from a charter message string. */
function parseMeasurement(message: string): { x?: number; y?: number; max?: number } | null {
  // Pattern: "overlaps ... by N×Mpx"
  const overlapMatch = /overlaps.*\b(\d+)\s*×\s*(\d+)\s*px/.exec(message);
  if (overlapMatch) {
    return { x: parseInt(overlapMatch[1]), y: parseInt(overlapMatch[2]) };
  }

  // Pattern: "overflows ... by right: Npx, bottom: Mpx"
  const overflowMatch = /overflows.*\bby\s+(\d+)\s*px/.exec(message);
  if (overflowMatch) {
    return { max: parseInt(overflowMatch[1]) };
  }

  return null;
}
