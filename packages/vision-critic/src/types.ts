/**
 * Core types for @medesign/vision-critic — the multi-model LLM vision critique system.
 *
 * A VisionProvider is the primitive. critique strategies (standard / regression / reference / ensemble)
 * compose providers with context (screenshot, DOM, design system) and return structured results that
 * feed into the medesign critique gate (vision scorer key, weight 0.25).
 */

// ---------------------------------------------------------------------------
// Provider contract
// ---------------------------------------------------------------------------

export interface VisionProvider {
  /** Unique id, e.g. "claude" | "gemini" | "minimax". */
  id: string;
  /** Human-readable name, e.g. "Claude Sonnet 4". */
  name: string;
  /** Whether the provider is available (API key present, configured, etc.). */
  available(): boolean;
  /**
   * Send one screenshot image + context to the provider and return a structured critique.
   * Implementations must handle missing keys gracefully (return a clear error result).
   */
  critique(imageBuffer: Buffer, imageMime: string, ctx: VisionContext): Promise<VisionCritiqueResult>;
  /**
   * Compare a reference image against the actual rendered screenshot.
   * Falls back to `critique` with a comparison prompt if not natively supported.
   */
  compare(referenceImage: Buffer, actualImage: Buffer, ctx: VisionContext): Promise<VisionCompareResult>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/** Everything a provider needs to produce a context-aware critique. */
export interface VisionContext {
  component: string;
  /** Design system context: DESIGN.md excerpt + tokens.css snippet. */
  designContext?: string;
  /**
   * Optional structured DOM snapshot from renderProbe (RenderSnapshot from @medesign/dsr).
   * Populated once the render-lint plan ships renderProbe.ts + plugin-core.
   */
  renderSnapshot?: string;
  /** Deterministic static-analysis findings from plugin-core / doctor. */
  staticFindings?: string;
  /** Previous round's critique for regression / delta analysis. */
  previousCritique?: VisionCritiqueResult;
  /** Path to the screenshot image on disk. */
  screenshotPath: string;
}

// ---------------------------------------------------------------------------
// Critique output
// ---------------------------------------------------------------------------

/** The five visual axes scored by the vision model. Each 0..1. */
export interface VisionAxes {
  hierarchy: number;       // Eye led to the right thing first
  balance: number;         // Whitespace distribution, alignment, optical centering
  spacingRhythm: number;   // Consistent spacing scale; no cramped or arbitrary gaps
  onBrand: number;         // Matches the design system's vibe
  polish: number;          // Contrast, radii consistency, no orphaned elements, no AI-generic look
}

/** A single finding — region-tied, actionable. */
export interface VisionFinding {
  severity: 'P0' | 'P1' | 'P2';
  /** CSS selector or element description, e.g. "header CTA button". */
  region: string;
  /** What's wrong. */
  issue: string;
  /** How to fix it. */
  fix: string;
}

/** Result from a single vision provider critique call. */
export interface VisionCritiqueResult {
  provider: string;
  /** Per-axis scores (may be partial if provider only returns overall). */
  axes: Partial<VisionAxes>;
  /** Overall vision score 0..1 — the gate uses this. */
  visionScore: number;
  findings: VisionFinding[];
  modelUsed: string;
  /** Raw provider response text for debugging / transparency. */
  raw?: string;
}

/** Result from a reference-image comparison. */
export interface VisionCompareResult {
  provider: string;
  /** How closely the actual render matches the reference, 0..1. */
  fidelityScore: number;
  differences: Array<{
    region: string;
    type: 'missing' | 'misaligned' | 'wrong-color' | 'wrong-size' | 'extra' | 'other';
    description: string;
  }>;
  findings: VisionFinding[];
  modelUsed: string;
}

// ---------------------------------------------------------------------------
// Orchestration types
// ---------------------------------------------------------------------------

export type CritiqueMode = 'standard' | 'regression' | 'reference' | 'ensemble';

export interface EnsembleConfig {
  providers: string[];
  /** How to combine axes scores across models. */
  strategy: 'average' | 'min' | 'max';
}

/** Input options for running a critique. */
export interface CritiqueOptions {
  component: string;
  mode?: CritiqueMode;
  /** Single provider id ("claude", "gemini", "minimax") — default claude. */
  provider?: string;
  /** For reference mode: path to the reference image. */
  referenceImagePath?: string;
  /** For ensemble mode. */
  ensemble?: EnsembleConfig;
  /** Path to a .render.json from renderProbe (optional). */
  renderSnapshotPath?: string;
  /** Path to a static-findings file from plugin-core/doctor (optional). */
  staticFindingsPath?: string;
}

/** Standardized output for MCP tools / CLI / HTTP. */
export interface VisionCritiqueOutput {
  component: string;
  mode: CritiqueMode;
  provider: string;
  axes: Partial<VisionAxes>;
  /** Overall vision score 0..1 (computed from axes). */
  visionScore: number;
  /** Count of P0 findings — feeds directly into the critique gate. */
  mustFix: number;
  findings: VisionFinding[];
  /** Error message if the critique failed. */
  error?: string;
  raw?: string;
}
