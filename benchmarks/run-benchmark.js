export const meta = {
  name: 'run-benchmark',
  description:
    'Run the benchmark suite against core-loop and produce an independent two-axis evaluation. ' +
    'Each test builds a component through core-loop, then evaluates it with black-box (general code review, ' +
    'visual comparison, functional check, accessibility) and white-box (token compliance, TypeScript health, ' +
    'complexity, patterns) metrics. All evaluators are independent of emdesign\'s internal critics.',
  phases: [
    { title: 'Setup' },
    { title: 'Execute' },
    { title: 'Evaluate' },
    { title: 'Report' },
  ],
};

// ── Config ─────────────────────────────────────────────────────────────────
const REPO_ROOT = '/Users/minh/Documents/medesign';
const RUN_ID = (args && args.runId) || 'benchmark-run';
const FILTER = (args && args.filter) || ''; // 'simple' | 'medium' | 'complex' | '' (all)
const THRESHOLD = (args && args.threshold) || 0.8;

// ── Schemas ────────────────────────────────────────────────────────────────
const SUITE_SCHEMA = {
  type: 'object', additionalProperties: true,
  properties: {
    runId: { type: 'string' },
    config: { type: 'object' },
    tests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          instruction: { type: 'string' },
          complexity: { type: 'string' },
          expectedMinComposite: { type: 'number' },
          expectedMaxRounds: { type: 'number' },
        },
        required: ['name', 'instruction', 'complexity'],
      },
    },
  },
  required: ['tests'],
};

const METRICS_SCHEMA = {
  type: 'object', additionalProperties: true,
  properties: {
    tokenCompliance: { type: 'number' },
    rawHexCount: { type: 'number' },
    unresolvedVarCount: { type: 'number' },
    offTokenStyleCount: { type: 'number' },
    typescript: { type: 'number' },
    anyCount: { type: 'number' },
    tsIgnoreCount: { type: 'number' },
    untypedPropCount: { type: 'number' },
    complexity: { type: 'number' },
    linesOfCode: { type: 'number' },
    propCount: { type: 'number' },
    maxConditionalDepth: { type: 'number' },
    patterns: { type: 'number' },
    patternViolations: { type: 'array' },
    composite: { type: 'number' },
  },
  required: ['tokenCompliance', 'typescript', 'complexity', 'patterns', 'composite'],
};

const CRITIQUE_SCHEMA = {
  type: 'object', additionalProperties: true,
  properties: { general: { type: 'number' }, findings: { type: 'array' } },
  required: ['general'],
};

const VISUAL_SCHEMA = {
  type: 'object', additionalProperties: true,
  properties: { visual: { type: 'number' }, status: { type: 'string' } },
  required: ['visual'],
};

const FUNC_SCHEMA = {
  type: 'object', additionalProperties: true,
  properties: { functional: { type: 'number' }, functionalStates: { type: 'array' } },
  required: ['functional'],
};

const A11Y_SCHEMA = {
  type: 'object', additionalProperties: true,
  properties: { accessibility: { type: 'number' }, a11yViolations: { type: 'array' } },
  required: ['accessibility'],
};

// ── Phase 1: Setup ─────────────────────────────────────────────────────────
// Read suite.json, resolve design system, prepare workspace.
phase('Setup');
log(`Benchmark run: ${RUN_ID}${FILTER ? ` (filter: ${FILTER})` : ''}`);

// Read the suite definition
const suite = await agent(
  `Read the benchmark suite from /Users/minh/Documents/medesign/benchmarks/suite.json. Parse it and return the JSON content.` +
  `Filter to complexity "${FILTER}" if FILTER is set and non-empty.`,
  { label: 'read-suite', phase: 'Setup', schema: SUITE_SCHEMA },
);

const tests = (suite && suite.tests) || [];
log(`Suite loaded: ${tests.length} test cases`);

// Bootstrap the workspace
await agent(
  `Prepare the workspace for benchmarking:\n` +
  `1) Call generate_tailwind_config() to ensure all --color-* tokens are mapped.\n` +
  `2) Call rebuild_graph() to index the design system.\n` +
  `3) Return "ready".`,
  { label: 'bootstrap', phase: 'Setup' },
);

// ── Phase 2: Execute ───────────────────────────────────────────────────────
// Run each test through core-loop in parallel.
phase('Execute');
const results = [];

for (const test of tests) {
  log(`Building "${test.name}" (${test.complexity})...`);

  const coreResult = await workflow('core-loop', {
    name: test.name,
    instruction: test.instruction,
    threshold: THRESHOLD,
  });

  const t0 = 0; // timing not available in workflow context

  // Read the generated source
  const sourcePath = `${REPO_ROOT}/examples/ledger-console/src/generated/${test.name}.tsx`;
  const sourceRead = await agent(
    `Read the generated source file at ${sourcePath}. If it doesn't exist, return "NOT FOUND". Otherwise return the FULL file content.`,
    { label: `read-source:${test.name}`, phase: 'Execute' },
  );

  // ── Phase 3: Evaluate (in parallel per test) ─────────────────────────────
  phase('Evaluate');

  // White-box: deterministic code metrics
  const whiteBox = await agent(
    `Run white-box metrics on "${test.name}". Read the source file at ${sourcePath}. ` +
    `Analyze it for:\n` +
    `1. Token compliance: count raw hex values (#xxx), unresolved var(--x) references, inline style={} with colors.\n` +
    `2. TypeScript health: count 'as any', '@ts-ignore', untyped props (missing type annotation).\n` +
    `3. Complexity: lines of code, interface prop count, conditional depth, JSX nesting depth.\n` +
    `4. Pattern adherence: hooks rules, .map() keys, inline event handlers vs named, inline styles vs classes, raw <button> vs Button primitive.\n` +
    `Return the JSON with all metrics.`,
    { label: `whitebox:${test.name}`, phase: 'Evaluate', schema: METRICS_SCHEMA },
  );

  // Black-box B1: General code review (independent agent, no emdesign context)
  const codeReview = await agent(
    `Read the component source at ${sourcePath}. Review it as a general software engineer — ` +
    `you have NO knowledge of emdesign, its design systems, or its critics. Score across 5 axes:\n` +
    `1. Structure: well-organized, single responsibility, clear separation?\n` +
    `2. TypeScript: clear interfaces, no any, proper types?\n` +
    `3. State handling: edge cases, empty/loading/error states, null safety?\n` +
    `4. JSX quality: readability, keys, aria attributes, fragments, named handlers?\n` +
    `5. Best practices: hooks rules, useEffect deps, memoization, Tailwind clarity?\n` +
    `Return JSON with "general" (average of 5 axes 0-1) and "findings" (array of strings).`,
    { agentType: 'benchmark-critic', schema: CRITIQUE_SCHEMA, label: `codereview:${test.name}`, phase: 'Evaluate' },
  );

  // Black-box B2: Visual check via Playwright
  const visual = await agent(
    `Run the visual check for "${test.name}": call run_visual_test and map the result. ` +
    `'pass'|'new' → visual=1.0, 'changed' → 0.5, 'error' → 0.0. Return {visual, status}.`,
    { schema: VISUAL_SCHEMA, label: `visual:${test.name}`, phase: 'Evaluate' },
  );

  // Black-box B3: Functional check
  const functional = await agent(
    `Run functional check for "${test.name}": call run_visual_test and also check the story renders. ` +
    `If the story renders without errors, functional=1.0. If there are errors, score proportionally. ` +
    `Return {functional, functionalStates}.`,
    { schema: FUNC_SCHEMA, label: `func:${test.name}`, phase: 'Evaluate' },
  );

  // Black-box B4: Accessibility (axe-core standalone)
  const a11y = await agent(
    `Run accessibility check for "${test.name}". If the story renders without axe violations, ` +
    `accessibility=1.0. Score proportionally based on violation severity. Return {accessibility, a11yViolations}.`,
    { schema: A11Y_SCHEMA, label: `a11y:${test.name}`, phase: 'Evaluate' },
  );

  // Compute composites
  const elapsed = Date.now() - t0;

  const blackBoxComposite =
    0.30 * (codeReview && codeReview.general || 0) +
    0.30 * (visual && visual.visual || 0) +
    0.25 * (functional && functional.functional || 0) +
    0.15 * (a11y && a11y.accessibility || 0);

  const whiteBoxComposite = whiteBox ? whiteBox.composite : 0;
  const overall = 0.6 * blackBoxComposite + 0.4 * whiteBoxComposite;

  const pass = overall >= 0.80 && blackBoxComposite >= 0.75 && whiteBoxComposite >= 0.75;
  const reasons = [];
  if (overall < 0.80) reasons.push(`overall (${overall.toFixed(2)}) < 0.80`);
  if (blackBoxComposite < 0.75) reasons.push(`black-box (${blackBoxComposite.toFixed(2)}) < 0.75`);
  if (whiteBoxComposite < 0.75) reasons.push(`white-box (${whiteBoxComposite.toFixed(2)}) < 0.75`);

  results.push({
    name: test.name,
    complexity: test.complexity,
    instruction: test.instruction,
    shipped: coreResult && coreResult.shipped,
    rounds: coreResult && coreResult.rounds || 0,
    engineComposite: coreResult && coreResult.composite || null,
    stoppedReason: coreResult && coreResult.stoppedReason,
    blackBox: {
      general: codeReview && codeReview.general || 0,
      generalFindings: codeReview && codeReview.findings || [],
      visual: visual && visual.visual || 0,
      visualStatus: visual && visual.status,
      functional: functional && functional.functional || 0,
      functionalStates: functional && functional.functionalStates || [],
      accessibility: a11y && a11y.accessibility || 0,
      a11yViolations: a11y && a11y.a11yViolations || [],
      composite: Math.round(blackBoxComposite * 100) / 100,
    },
    whiteBox: whiteBox || { tokenCompliance: 0, typescript: 0, complexity: 0, patterns: 0, composite: 0 },
    overall: Math.round(overall * 100) / 100,
    pass,
    reasons,
    durationMs: elapsed,
    sourcePath,
  });

  log(`${test.name}: overall=${overall.toFixed(3)} black=${blackBoxComposite.toFixed(3)} white=${whiteBoxComposite.toFixed(3)} rounds=${coreResult?.rounds} ${pass ? '✅' : '❌'}`);
}

// ── Phase 4: Report ────────────────────────────────────────────────────────
// Aggregate results, compare with previous run, generate report.
phase('Report');

const passed = results.filter((r) => r.pass);
const passRate = results.length > 0 ? (passed.length / results.length * 100).toFixed(0) : '0';

// Write summary
await agent(
  `Write the benchmark summary to ${REPO_ROOT}/bench-results/${RUN_ID}/.` +
  `Create the directory if needed, write summary.json with the full results.` +
  `The summary:\n` +
  JSON.stringify({
    runId: RUN_ID,
    timestamp: (args && args.runId) || 'unknown',
    tests: results.map((r) => ({
      name: r.name,
      complexity: r.complexity,
      shipped: r.shipped,
      rounds: r.rounds,
      overall: r.overall,
      blackBoxComposite: r.blackBox.composite,
      whiteBoxComposite: r.whiteBox.composite,
      pass: r.pass,
      reasons: r.reasons,
      durationMs: r.durationMs,
    })),
    totals: {
      testsPassed: passed.length,
      testsFailed: results.length - passed.length,
      totalRounds: results.reduce((s, r) => s + r.rounds, 0),
      totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
      avgOverall: results.length > 0 ? results.reduce((s, r) => s + r.overall, 0) / results.length : 0,
      avgBlackBox: results.length > 0 ? results.reduce((s, r) => s + r.blackBox.composite, 0) / results.length : 0,
      avgWhiteBox: results.length > 0 ? results.reduce((s, r) => s + r.whiteBox.composite, 0) / results.length : 0,
      passRate: `${passRate}%`,
    },
  }, null, 2),
  { label: 'write-summary', phase: 'Report' },
);

// Check for previous run to compare
const comparison = await agent(
  `Check if there's a previous benchmark run in ${REPO_ROOT}/bench-results/ (list the directories, pick the most recent one before ${RUN_ID}). ` +
  `If found, read its summary.json and compare results. Report what changed. ` +
  `If no previous run found, return "No previous run to compare."`,
  { label: 'compare', phase: 'Report' },
);

log(`\n═══════════════════════════════════════════`);
log(`  BENCHMARK COMPLETE: ${RUN_ID}`);
log(`  Pass rate: ${passRate}% (${passed.length}/${results.length})`);
log(`  Avg overall: ${results.length > 0 ? (results.reduce((s, r) => s + r.overall, 0) / results.length).toFixed(3) : 'N/A'}`);
log(`  Avg rounds: ${results.length > 0 ? (results.reduce((s, r) => s + r.rounds, 0) / results.length).toFixed(1) : 'N/A'}`);
if (comparison && typeof comparison === 'object') {
  log(`  Comparison: ${JSON.stringify(comparison)}`);
}
log(`═══════════════════════════════════════════\n`);

return {
  runId: RUN_ID,
  testsRun: results.length,
  testsPassed: passed.length,
  testsFailed: results.length - passed.length,
  passRate: `${passRate}%`,
  results: results.map((r) => ({
    name: r.name,
    pass: r.pass,
    overall: r.overall,
    blackBox: r.blackBox.composite,
    whiteBox: r.whiteBox.composite,
    rounds: r.rounds,
    reasons: r.reasons,
  })),
  comparison: comparison && typeof comparison === 'object' ? comparison : null,
};
