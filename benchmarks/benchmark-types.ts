/**
 * Benchmark types for the independent two-axis evaluation system.
 *
 * Black-box: external judges with no emdesign context (general code review,
 * visual comparison, functional checks, axe-core a11y).
 *
 * White-box: deterministic code metrics (token compliance, TypeScript health,
 * complexity, pattern adherence).
 */

// ── Test suite definition ─────────────────────────────────────────────────

export type BenchmarkComplexity = 'simple' | 'medium' | 'complex';

export interface BenchmarkTestCase {
  name: string;
  instruction: string;
  complexity: BenchmarkComplexity;
  expectedMinComposite: number;
  expectedMaxRounds: number;
}

export interface BenchmarkConfig {
  runId: string;
  timestamp: string;
  description: string;
  threshold: number;
  sourceFloors: Record<string, number>;
  plateauLimit: number;
  modelConfig: Record<string, string>;
  systemUnderTest: {
    workflowChanged?: string;
    backendChanged?: string;
    promptChanged?: string;
  };
}

export interface BenchmarkSuite {
  runId: string;
  config: BenchmarkConfig;
  tests: BenchmarkTestCase[];
}

// ── Black-box scores ──────────────────────────────────────────────────────

export interface BlackBoxScores {
  /** B1: General code review by a neutral agent (no emdesign context). 0-1. */
  general: number;
  generalFindings?: string[];

  /** B2: Visual comparison — pixelmatch vs reference or general vision model. 0-1. */
  visual: number;
  visualStatus?: 'pass' | 'changed' | 'error' | 'no-reference';
  visualChangedPixels?: number;

  /** B3: Functional verification — do all states render without errors? 0 or 1. */
  functional: number;
  functionalStates?: { name: string; pass: boolean; errors?: string[] }[];

  /** B4: Axe-core accessibility audit (standalone, not emdesign's a11y). 0-1. */
  accessibility: number;
  a11yViolations?: { id: string; impact: string; description: string }[];

  /** Weighted composite of the above (general 0.30, visual 0.30, functional 0.25, a11y 0.15). */
  composite: number;
}

// ── White-box scores ──────────────────────────────────────────────────────

export interface WhiteBoxMetrics {
  /** W1: Token compliance (raw hex count, unresolved var(), off-token styles). 0-1. */
  tokenCompliance: number;
  rawHexCount: number;
  unresolvedVarCount: number;
  offTokenStyleCount: number;

  /** W2: TypeScript health (any casts, @ts-ignore, untyped props). 0-1. */
  typescript: number;
  anyCount: number;
  tsIgnoreCount: number;
  untypedPropCount: number;

  /** W3: Code complexity (LOC, props, conditional depth, JSX depth). 0-1. Higher = better. */
  complexity: number;
  linesOfCode: number;
  propCount: number;
  maxConditionalDepth: number;
  maxJsxDepth: number;

  /** W4: Pattern adherence (hooks rules, keys, naming, exports). 0-1. */
  patterns: number;
  patternViolations: string[];

  /** Weighted composite (tokenCompliance 0.35, typescript 0.25, complexity 0.20, patterns 0.20). */
  composite: number;
}

// ── Per-test result ───────────────────────────────────────────────────────

export interface BenchmarkTestResult {
  name: string;
  complexity: BenchmarkComplexity;
  instruction: string;

  /** Did core-loop ship the component? */
  shipped: boolean;
  /** How many rounds core-loop took. */
  rounds: number;
  /** The engine's own final composite score (for reference, not used in pass/fail). */
  engineComposite: number | null;
  /** Why core-loop stopped (plateau, shipped, etc.). */
  stoppedReason?: string;

  /** Independent black-box evaluation. */
  blackBox: BlackBoxScores;
  /** Deterministic white-box analysis. */
  whiteBox: WhiteBoxMetrics;

  /** Overall: 0.6 × blackBox.composite + 0.4 × whiteBox.composite. */
  overall: number;

  /** Pass: overall >= 0.80 AND blackBox.composite >= 0.75 AND whiteBox.composite >= 0.75. */
  pass: boolean;
  reasons?: string[];

  /** Timing. */
  durationMs: number;

  /** Evidence paths. */
  sourcePath?: string;
  evidenceDir?: string;
}

// ── Aggregated summary ────────────────────────────────────────────────────

export interface BenchmarkTotals {
  testsPassed: number;
  testsFailed: number;
  totalRounds: number;
  totalDurationMs: number;
  avgComposite: number;
  avgRounds: number;
  avgDurationMs: number;
  avgBlackBox: number;
  avgWhiteBox: number;
}

export interface BenchmarkSummary {
  runId: string;
  timestamp: string;
  config: BenchmarkConfig;
  tests: BenchmarkTestResult[];
  totals: BenchmarkTotals;
  passRate: number;
}

// ── Comparison across runs ────────────────────────────────────────────────

export interface TestComparison {
  name: string;
  complexity: BenchmarkComplexity;
  current: { overall: number; blackBox: number; whiteBox: number; rounds: number; durationMs: number };
  previous: { overall: number; blackBox: number; whiteBox: number; rounds: number; durationMs: number };
  deltas: {
    overall: number;
    blackBox: number;
    whiteBox: number;
    rounds: number;
    durationMs: number;
  };
  regressed: boolean;
}

export interface BenchmarkComparison {
  currentRunId: string;
  previousRunId: string;
  tests: TestComparison[];
  summary: {
    compositeTrend: 'up' | 'down' | 'stable';
    roundsTrend: 'up' | 'down' | 'stable';
    durationTrend: 'up' | 'down' | 'stable';
    regressedTests: number;
    improvedTests: number;
  };
}

// ── Composite score shape ────────────────────────────────────────────────

export interface BenchmarkScore {
  blackBox: BlackBoxScores;
  whiteBox: WhiteBoxMetrics;
  overall: number;
  pass: boolean;
}

// ── Weights ───────────────────────────────────────────────────────────────

export const BLACK_BOX_WEIGHTS = { general: 0.30, visual: 0.30, functional: 0.25, accessibility: 0.15 };
export const WHITE_BOX_WEIGHTS = { tokenCompliance: 0.35, typescript: 0.25, complexity: 0.20, patterns: 0.20 };

export const BENCHMARK_PASS_THRESHOLD = 0.80;
export const BLACK_BOX_MIN = 0.75;
export const WHITE_BOX_MIN = 0.75;
