import type { DesignSystem } from '../domain/designSystem.js';
import type { Severity, Provenance } from '../domain/values.js';
import type { ReviewFinding } from './review.js';

/**
 * Rendered-artifact linting — the "render probe" captures the live DOM of a Storybook story
 * as a structured RenderSnapshot, then RenderedReviewRules run deterministic checks (overlap,
 * contrast, off-scale spacing, tap-target size, type-scale sprawl, overflow) against it.
 *
 * This is the deterministic third leg alongside the advisory LLM vision-critic.
 *
 * Types live in dsr so doctor + plugin-api + plugin-core can all reference them without
 * depending on @emdesign/backend.
 */

// ---------------------------------------------------------------------------
// Render snapshot — produced by backend/src/renderProbe.ts page.evaluate walk
// ---------------------------------------------------------------------------

export interface RenderNode {
  /** CSS selector path (nth-of-type) under #storybook-root — reuses addon/src/preview.tsx cssPath logic. */
  selector: string;
  /** Element tag name, e.g. "button", "div". */
  tag: string;
  /** Element className string. */
  classes: string;
  /** Trimmed text content (first 120 chars). */
  text: string;
  /** getBoundingClientRect in CSS pixels. */
  box: { x: number; y: number; width: number; height: number };
  /** Computed style subset. */
  styles: {
    color: string;
    backgroundColor: string;
    backgroundImage: string;
    fontSize: string;
    fontFamily: string;
    fontWeight: string;
    lineHeight: string;
    marginTop: string;
    marginRight: string;
    marginBottom: string;
    marginLeft: string;
    paddingTop: string;
    paddingRight: string;
    paddingBottom: string;
    paddingLeft: string;
    gap: string;
    display: string;
    position: string;
    zIndex: string;
    overflow: string;
  };
  /** Selector of the parent node, if any. */
  parentSelector?: string;
}

export interface RenderSnapshot {
  component: string;
  storyId: string;
  url: string;
  theme: 'light' | 'dark';
  viewport: { width: number; height: number; deviceScaleFactor: number };
  /** #storybook-root dimensions and position (viewport-relative x,y). */
  root: { x: number; y: number; width: number; height: number };
  /** Visible elements only (display:none and zero-area elements filtered out). */
  nodes: RenderNode[];
}

// ---------------------------------------------------------------------------
// Rendered rule types — parallel to review.ts DesignReviewRule / ReviewContext
// ---------------------------------------------------------------------------

export interface RenderedReviewContext {
  ds: DesignSystem;
  /** One or more render snapshots (per theme / per story). */
  renders: RenderSnapshot[];
}

export interface RenderedReviewRule {
  id: string;
  /** Grouping for the report, e.g. 'geometry' | 'a11y' | 'spacing'. */
  category: string;
  title: string;
  severity: Severity;
  target: string;
  /**
   * Run a deterministic check against the rendered snapshots.
   * REUSES ReviewFinding — same shape, same consumers (doctor report, gate).
   */
  check(ctx: RenderedReviewContext): ReviewFinding;
}
