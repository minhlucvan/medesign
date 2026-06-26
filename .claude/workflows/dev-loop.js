export const meta = {
  name: 'dev-loop',
  description: 'Automated benchmark-driven engine development loop. Measures current state, diagnoses weaknesses, forms a specific hypothesis, implements ONE change to the engine, re-runs the benchmark to verify, then keeps or reverts the change. Loops until production-ready (all 7 tests pass, avg rounds <= 5) or progress stalls.',
  phases: [
    { title: 'Initialize' },
    { title: 'Diagnose' },
    { title: 'Hypothesize' },
    { title: 'Implement' },
    { title: 'Verify' },
    { title: 'Decide' },
    { title: 'Report' },
    { title: 'Check' },
  ],
};

// ── Config ─────────────────────────────────────────────────────────────────
const MAX_CYCLES = (args && args.maxCycles) || 30;
const MODE = (args && args.mode) || 'semi-auto'; // 'semi-auto' | 'auto' | 'suggest'
const INITIAL_FILTER = (args && args.filter) || '';
const TOLERANCE = 0.02;
const ROUND_TOLERANCE = 2;
const FULL_SUITE_INTERVAL = 5;
const PRODUCTION_THRESHOLD = 0.80;
const MAX_AVG_ROUNDS = 5;

// ── Engine file registry ───────────────────────────────────────────────────
const ENGINE_FILES = [
  {
    path: 'apps/workspace/templates/claude/workflows/core-loop.js',
    type: 'workflow', area: 'build-prompt',
    description: 'The core build/critique loop. Contains the CREATE/EDIT prompt, critique prompts, and gate call.',
    impactAxes: ['general', 'visual', 'functional', 'accessibility', 'tokenCompliance', 'typescript', 'complexity', 'patterns', 'rounds'],
  },
  {
    path: 'apps/workspace/templates/claude/agents/consistency-auditor.md',
    type: 'agent', area: 'token-audit',
    description: 'Runs lint, scores token compliance, returns file:line fix list.',
    impactAxes: ['tokenCompliance', 'patterns'],
  },
  {
    path: 'apps/workspace/templates/claude/agents/design-reviewer.md',
    type: 'agent', area: 'design-review',
    description: 'LLM critique of code quality, API design, semantics, intent-fit, and voice.',
    impactAxes: ['general', 'functional'],
  },
  {
    path: 'apps/workspace/templates/claude/agents/vision-critic.md',
    type: 'agent', area: 'vision-critique',
    description: 'Screenshot-based visual critique of hierarchy, balance, spacing, on-brand, polish.',
    impactAxes: ['visual'],
  },
  {
    path: 'packages/backend/src/critique/scoreboard.ts',
    type: 'backend', area: 'gate-logic',
    description: 'Weighted composite computation, decideRound dual gate.',
    impactAxes: ['rounds'],
  },
  {
    path: 'packages/backend/src/critique/score.ts',
    type: 'backend', area: 'gate-config',
    description: 'scoreComponent with per-source floors, threshold, ratchet.',
    impactAxes: ['visual', 'tokens', 'rounds'],
  },
  {
    path: 'packages/plugin-tailwindcss/src/index.ts',
    type: 'plugin', area: 'codegen',
    description: 'Tailwind codegen instructions and token→class mapping.',
    impactAxes: ['tokenCompliance', 'patterns'],
  },
  {
    path: 'packages/dsr/src/rules/lint.ts',
    type: 'dsr', area: 'lint-rules',
    description: 'P0/P1 lint rules for anti-pattern detection.',
    impactAxes: ['tokenCompliance', 'patterns'],
  },
];

const AXIS_TO_ENGINE = {
  general: { label: 'Code structure (B1)', primaryFile: 'apps/workspace/templates/claude/workflows/core-loop.js', area: 'build-prompt structure section', typicalFix: 'Add specific structure requirements to the build prompt — extract logic, define interfaces, separate concerns' },
  visual: { label: 'Visual appearance (B2)', primaryFile: 'apps/workspace/templates/claude/agents/vision-critic.md', area: 'vision-critic criteria', typicalFix: 'Add specific visual guidance to the build prompt or tighten vision-critic instructions for alignment/spacing' },
  functional: { label: 'Functional correctness (B3)', primaryFile: 'apps/workspace/templates/claude/workflows/core-loop.js', area: 'build prompt state handling', typicalFix: 'Add state coverage requirements: default, hover, active, disabled, loading, empty, error' },
  accessibility: { label: 'Accessibility (B4)', primaryFile: 'apps/workspace/templates/claude/workflows/core-loop.js', area: 'build prompt a11y', typicalFix: 'Add a11y requirements: aria-labels, heading hierarchy, keyboard nav' },
  tokenCompliance: { label: 'Token compliance (W1)', primaryFile: 'packages/dsr/src/rules/lint.ts', area: 'lint rules', typicalFix: 'Add a new lint rule for an off-token pattern or strengthen the token prompt in core-loop' },
  typescript: { label: 'TypeScript quality (W2)', primaryFile: 'apps/workspace/templates/claude/workflows/core-loop.js', area: 'build prompt TypeScript', typicalFix: 'Add TS requirements: explicit Props interface, no any, no @ts-ignore' },
  complexity: { label: 'Code complexity (W3)', primaryFile: 'apps/workspace/templates/claude/workflows/core-loop.js', area: 'build prompt complexity', typicalFix: 'Add complexity budget: max LOC, max conditionals, max nesting' },
  patterns: { label: 'Pattern adherence (W4)', primaryFile: 'apps/workspace/templates/claude/workflows/core-loop.js', area: 'build prompt patterns', typicalFix: 'Add pattern rules: named handlers, stable keys, sub-components for repeated JSX' },
  rounds: { label: 'Iteration speed', primaryFile: 'apps/workspace/templates/claude/workflows/core-loop.js', area: 'build prompt or gate params', typicalFix: 'Improve first-attempt quality via more specific build prompt, or adjust plateau/floor params' },
};

// ── Schemas ────────────────────────────────────────────────────────────────
const HISTORY_SCHEMA = {
  type: 'object', additionalProperties: true,
  properties: {
    startTime: { type: 'string' },
    initialBaseline: { type: 'string' },
    bestOverallAvg: { type: 'number' },
    cycles: { type: 'array', items: { type: 'object' } },
  },
  required: ['cycles'],
};

const DIAGNOSIS_SCHEMA = {
  type: 'object', additionalProperties: true,
  properties: {
    weakestTest: { type: 'string' },
    weakestAxis: { type: 'string' },
    axisValue: { type: 'number' },
    axisBucket: { type: 'string' },
    complexity: { type: 'string' },
    testOverall: { type: 'number' },
    testRounds: { type: 'number' },
    failingTests: { type: 'array' },
    allTestsPass: { type: 'boolean' },
    avgRounds: { type: 'number' },
    productionReady: { type: 'boolean' },
  },
  required: ['weakestTest', 'weakestAxis', 'axisValue', 'failingTests', 'allTestsPass', 'productionReady'],
};

const HYPOTHESIS_SCHEMA = {
  type: 'object', additionalProperties: true,
  properties: {
    hypothesis: { type: 'string' },
    changeFile: { type: 'string' },
    changeType: { type: 'string' },
    operation: { type: 'string' },
    anchorText: { type: 'string' },
    insertText: { type: 'string' },
    targetMetric: { type: 'string' },
    expectedDelta: { type: 'number' },
    expectedDirection: { type: 'string' },
    mechanism: { type: 'string' },
    risks: { type: 'string' },
  },
  required: ['hypothesis', 'changeFile', 'operation', 'anchorText', 'insertText', 'targetMetric', 'expectedDelta', 'expectedDirection'],
};

const IMPLEMENTATION_SCHEMA = {
  type: 'object', additionalProperties: true,
  properties: { applied: { type: 'boolean' }, diff: { type: 'string' }, error: { type: 'string' } },
  required: ['applied'],
};

const VERIFICATION_SCHEMA = {
  type: 'object', additionalProperties: true,
  properties: {
    targetImproved: { type: 'boolean' },
    targetDelta: { type: 'number' },
    hasRegressions: { type: 'boolean' },
    regressions: { type: 'array' },
    improvements: { type: 'array' },
    hypothesisCorrect: { type: 'boolean' },
    overallAvgDelta: { type: 'number' },
    avgRoundsDelta: { type: 'number' },
    afterPassRate: { type: 'number' },
  },
  required: ['targetImproved', 'hasRegressions', 'hypothesisCorrect'],
};

// ── Helper: determine benchmark filter for verify phase ────────────────────
function determineFilter(cycleNum, diagnosis) {
  if (cycleNum % FULL_SUITE_INTERVAL === 0) return ''; // full suite
  if (!diagnosis) return INITIAL_FILTER || 'simple';
  const c = (diagnosis.complexity || 'simple').toLowerCase();
  if (c === 'complex' || c === 'medium') return c;
  return 'simple';
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 0: INITIALIZE
// ══════════════════════════════════════════════════════════════════════════
phase('Initialize');

// Check git working tree
const gitClean = await agent(
  `Check if the git working tree is clean. Run \`git status --porcelain\` and return the output. If empty, the tree is clean.`,
  { label: 'git-check', phase: 'Initialize' },
);
const isClean = gitClean && typeof gitClean === 'string' && gitClean.trim().length === 0;
if (!isClean) {
  log('ERROR: Git working tree is not clean. Commit or stash changes before running dev-loop.');
  return { error: 'Dirty working tree. Please commit or stash first.', gitStatus: gitClean };
}

// Load or create history
let history = { startTime: new Date().toISOString(), initialBaseline: '', bestOverallAvg: 0, cycles: [] };
const historyRaw = await agent(
  `Read bench-results/dev-loop-history.json if it exists. If it exists, parse it and return the JSON. If it doesn't exist or is empty, return { cycles: [] }.`,
  { label: 'load-history', phase: 'Initialize', schema: HISTORY_SCHEMA },
);
if (historyRaw && historyRaw.cycles) {
  history = { ...history, ...historyRaw, cycles: [...(historyRaw.cycles || [])] };
}

let cycleNumber = (history.cycles && history.cycles.length > 0 ? history.cycles.length : 0) + 1;
let currentResults = null;
const hadBaseline = history.cycles.length > 0;

if (!hadBaseline) {
  log('No baseline found. Running initial benchmark...');
  const baseline = await workflow('run-benchmark', { runId: `baseline-${Date.now()}`, filter: '', threshold: 0.8 });
  history.initialBaseline = baseline && baseline.runId;
  currentResults = baseline;
  history.bestOverallAvg = baseline && baseline.results
    ? baseline.results.reduce((s, r) => s + r.overall, 0) / baseline.results.length
    : 0;
  log(`Baseline complete: pass rate ${baseline ? baseline.passRate : 'N/A'}`);
} else {
  log(`Resuming from cycle ${history.cycles.length}. Last result: ${history.bestOverallAvg}`);
}

log(`Dev loop starting: cycle ${cycleNumber}, mode=${MODE}, max=${MAX_CYCLES}`);
const cycleStart = Date.now();

// ══════════════════════════════════════════════════════════════════════════
//  MAIN LOOP
// ══════════════════════════════════════════════════════════════════════════
let done = false;
let stalled = false;
let keptChanges = [];
let lastDiagnosis = null;
let totalBenchmarkRuns = hadBaseline ? 1 : 0;

while (!done && !stalled && cycleNumber <= MAX_CYCLES) {
  // ── 1. DIAGNOSE ───────────────────────────────────────────────────────
  phase('Diagnose');
  const diagnosis = await agent(
    `You are diagnosing engine weaknesses from benchmark results.\n\n` +
    `PRODUCTION-READY DEFINITION:\n` +
    `- All 7 tests: overall >= ${PRODUCTION_THRESHOLD}, black-box >= 0.75, white-box >= 0.75\n` +
    `- Average rounds across all tests <= ${MAX_AVG_ROUNDS}\n\n` +
    `CURRENT RESULTS:\n${JSON.stringify(currentResults, null, 2)}\n\n` +
    `Analyze each test. For each failing test, identify which sub-axis is the weakest:\n` +
    `- Black-box sub-axes: general, visual, functional, accessibility\n` +
    `- White-box sub-axes: tokenCompliance, typescript, complexity, patterns\n\n` +
    `Priority: 1) failing simple tests 2) failing medium 3) failing complex 4) high rounds\n\n` +
    `Return JSON with: weakestTest, weakestAxis, axisValue, axisBucket (black-box/white-box), ` +
    `complexity, testOverall, testRounds, failingTests[], allTestsPass, avgRounds, productionReady.`,
    { label: `diagnose:r${cycleNumber}`, phase: 'Diagnose', schema: DIAGNOSIS_SCHEMA },
  );

  lastDiagnosis = diagnosis;

  if (diagnosis && diagnosis.productionReady) {
    log('All tests pass and avg rounds within target. Engine is production-ready!');
    done = true;
    break;
  }

  log(`Diagnosis: weakest=${diagnosis?.weakestTest}/${diagnosis?.weakestAxis} (${diagnosis?.axisValue}) ` +
    `pass=${diagnosis?.allTestsPass} rounds=${diagnosis?.avgRounds}`);

  // ── 2. HYPOTHESIZE ────────────────────────────────────────────────────
  phase('Hypothesize');
  const axis = (diagnosis && diagnosis.weakestAxis) || 'patterns';
  const axisInfo = AXIS_TO_ENGINE[axis] || AXIS_TO_ENGINE.patterns;
  const primaryFile = axisInfo.primaryFile;
  const engineFileInfo = ENGINE_FILES.find((f) => f.path === primaryFile);

  const hypothesis = await agent(
    `You are forming a hypothesis to improve the emdesign engine.\n\n` +
    `WEAKEST: ${diagnosis?.weakestTest || 'unknown'} / ${axis} (score: ${diagnosis?.axisValue || '?'})\n\n` +
    `This axis maps to: ${JSON.stringify(axisInfo)}\n\n` +
    `ENGINE FILE: ${JSON.stringify(engineFileInfo)}\n\n` +
    `CRITICAL RULE: ONE change per cycle. Choose exactly ONE file and ONE specific change.\n\n` +
    `First, read the target file at ${primaryFile} to understand the current content around the area you want to change.\n\n` +
    `Form a hypothesis with structure:\n` +
    `1. hypothesis: "If I [change X] in [file], then [metric Y] will improve because [mechanism Z]"\n` +
    `2. changeFile: the exact relative path\n` +
    `3. operation: "insert-after" | "insert-before" | "replace-line" | "replace-block"\n` +
    `4. anchorText: EXACT text from the file to anchor the edit (copy verbatim)\n` +
    `5. insertText: the exact text to add/modify\n` +
    `6. targetMetric: e.g. "${diagnosis?.weakestTest || 'Test'}.blackBox.${axis}" or "suite.avgRounds"\n` +
    `7. expectedDelta: the expected improvement (0.05 to 0.3)\n` +
    `8. expectedDirection: "up" | "down"\n` +
    `9. mechanism: why this change should have that effect\n` +
    `10. risks: which other metrics might regress\n\n` +
    `Return the hypothesis as JSON.`,
    { label: `hypothesize:r${cycleNumber}`, phase: 'Hypothesize', schema: HYPOTHESIS_SCHEMA },
  );

  if (!hypothesis || !hypothesis.changeFile) {
    log('Failed to form hypothesis. Skipping cycle.');
    cycleNumber++;
    continue;
  }

  log(`Hypothesis: ${hypothesis.hypothesis ? hypothesis.hypothesis.slice(0, 120) : 'N/A'}`);

  if (MODE === 'suggest') {
    log('Mode is "suggest" — stopping after hypothesis.');
    done = true;
    break;
  }

  // ── 3. IMPLEMENT ──────────────────────────────────────────────────────
  phase('Implement');
  const gitBefore = await agent(`Run \`git status --porcelain\` to confirm tree is still clean. Return the output.`, { label: `git-before:r${cycleNumber}`, phase: 'Implement' });
  const stillClean = gitBefore && typeof gitBefore === 'string' && gitBefore.trim().length === 0;
  if (!stillClean) {
    log('Working tree changed unexpectedly. Aborting cycle.');
    cycleNumber++;
    continue;
  }

  const implementation = await agent(
    `Read the file at ${hypothesis.changeFile}.\n` +
    `Find this EXACT text in the file:\n"${hypothesis.anchorText}"\n\n` +
    `Then apply this operation: ${hypothesis.operation}\n` +
    `With this text:\n"""${hypothesis.insertText}"""\n\n` +
    `After applying, write the FULL modified file content back.\n` +
    `Rules:\n` +
    `- Do NOT change anything else in the file\n` +
    `- Do NOT reformat or modify surrounding code\n` +
    `- If the anchor text is not found exactly, report the error and stop\n\n` +
    `Then run \`git diff -- ${hypothesis.changeFile}\` and include the diff output.`,
    { label: `implement:r${cycleNumber}`, phase: 'Implement', schema: IMPLEMENTATION_SCHEMA },
  );

  if (!implementation || !implementation.applied) {
    log(`Implementation failed: ${implementation?.error || 'unknown error'}. Skipping verify.`);
    cycleNumber++;
    continue;
  }

  log(`Change applied: ${(implementation.diff || '').split('\n').length} lines changed.`);
  keptChanges.push({ cycle: cycleNumber, file: hypothesis.changeFile, diff: implementation.diff });

  // ── 4. VERIFY ─────────────────────────────────────────────────────────
  phase('Verify');
  const filter = determineFilter(cycleNumber, diagnosis);
  log(`Running benchmark (filter: ${filter || 'full'})...`);

  const afterResults = await workflow('run-benchmark', {
    runId: `cycle-${cycleNumber}-${Date.now()}`,
    filter,
    threshold: 0.8,
  });
  totalBenchmarkRuns++;

  // Compare before vs after
  const verification = await agent(
    `Compare these two benchmark runs:\n\n` +
    `BEFORE (${hadBaseline ? 'previous' : 'baseline'}):\n${JSON.stringify(currentResults, null, 2)}\n\n` +
    `AFTER (cycle ${cycleNumber}):\n${JSON.stringify(afterResults, null, 2)}\n\n` +
    `TARGET METRIC: ${hypothesis.targetMetric}\n` +
    `EXPECTED DIRECTION: ${hypothesis.expectedDirection}\n\n` +
    `Compute per-test deltas. Determine:\n` +
    `1. Did the target metric improve? (delta >= +${TOLERANCE})\n` +
    `2. Did any other metric regress? (delta <= -${TOLERANCE} for overall/black/white, or roundsDelta > ${ROUND_TOLERANCE})\n` +
    `3. Was the hypothesis correct? (target improved, no regressions)\n\n` +
    `Return JSON with: targetImproved, targetDelta, hasRegressions, regressions[], improvements[], ` +
    `hypothesisCorrect, overallAvgDelta, avgRoundsDelta, afterPassRate.`,
    { label: `verify:r${cycleNumber}`, phase: 'Verify', schema: VERIFICATION_SCHEMA },
  );

  log(`Verify: targetImproved=${verification?.targetImproved} hasRegressions=${verification?.hasRegressions} correct=${verification?.hypothesisCorrect}`);

  // ── 5. DECIDE ─────────────────────────────────────────────────────────
  phase('Decide');
  let decision = 'revert';
  if (verification && verification.targetImproved && !verification.hasRegressions) {
    decision = 'keep';
  } else if (verification && verification.targetImproved && verification.hasRegressions) {
    // Evaluate tradeoff: if quality gain outweighs regression, keep
    const netEffect = (verification.overallAvgDelta || 0) - (verification.hasRegressions ? 0.01 : 0);
    decision = netEffect > 0 ? 'keep' : 'revert';
  }

  if (decision === 'keep') {
    await agent(
      `The change improved the target metric without unacceptable regressions. ` +
      `Commit it:\n` +
      `git add -A && git commit -m "dev-loop cycle ${cycleNumber}: ${(hypothesis.hypothesis || '').slice(0, 100)}" ` +
      `-m "File: ${hypothesis.changeFile}\\nTarget: ${hypothesis.targetMetric}\\nDelta: ${verification?.targetDelta}"`,
      { label: `commit:r${cycleNumber}`, phase: 'Decide' },
    );
    log(`✅ Cycle ${cycleNumber}: KEPT — ${hypothesis.hypothesis ? hypothesis.hypothesis.slice(0, 80) : ''}`);
  } else {
    // Revert
    await agent(
      `Revert the change: run \`git restore ${hypothesis.changeFile}\` (or \`git checkout -- ${hypothesis.changeFile}\`). ` +
      `Confirm the revert with \`git diff -- ${hypothesis.changeFile}\` — it should be empty.`,
      { label: `revert:r${cycleNumber}`, phase: 'Decide' },
    );
    log(`❌ Cycle ${cycleNumber}: REVERTED — ${hypothesis.hypothesis ? hypothesis.hypothesis.slice(0, 80) : ''}`);
  }

  // Update current results
  currentResults = afterResults;

  // Update history
  const cycleEntry = {
    cycle: cycleNumber,
    hypothesis: hypothesis.hypothesis,
    changeFile: hypothesis.changeFile,
    targetMetric: hypothesis.targetMetric,
    targetDelta: verification ? verification.targetDelta : 0,
    kept: decision === 'keep',
    compositeDelta: verification ? verification.overallAvgDelta : 0,
    roundsDelta: verification ? verification.avgRoundsDelta : 0,
    regressions: verification ? verification.regressions : [],
  };
  history.cycles.push(cycleEntry);

  // Update best overall
  if (afterResults && afterResults.results) {
    const avg = afterResults.results.reduce((s, r) => s + r.overall, 0) / afterResults.results.length;
    if (avg > history.bestOverallAvg) history.bestOverallAvg = avg;
  }

  // Persist history
  await agent(
    `Write the dev-loop history to bench-results/dev-loop-history.json:\n` +
    JSON.stringify(history, null, 2),
    { label: `save-history:r${cycleNumber}`, phase: 'Decide' },
  );

  // ── 6. REPORT ─────────────────────────────────────────────────────────
  phase('Report');
  const reportLines = [];
  reportLines.push(`## Dev Loop Cycle ${cycleNumber}`);
  reportLines.push('');
  reportLines.push(`**Hypothesis:** ${hypothesis.hypothesis}`);
  reportLines.push(`**File:** ${hypothesis.changeFile}`);
  reportLines.push(`**Target:** ${hypothesis.targetMetric} (expected ${hypothesis.expectedDirection} ${hypothesis.expectedDelta})`);
  reportLines.push(`**Result:** ${verification?.targetImproved ? '✅ Improved' : '❌ No improvement'} (delta: ${verification?.targetDelta})`);
  reportLines.push(`**Decision:** ${decision === 'keep' ? '✅ KEPT' : '❌ REVERTED'}`);
  reportLines.push(`**Regressions:** ${verification?.hasRegressions ? JSON.stringify(verification.regressions) : 'None'}`);
  reportLines.push(`**Overall avg delta:** ${verification?.overallAvgDelta}`);
  reportLines.push(`**Rounds avg delta:** ${verification?.avgRoundsDelta}`);
  reportLines.push('');
  reportLines.push('### Progress');
  reportLines.push('');
  reportLines.push(`| Cycle | Hypothesis (truncated) | Kept | Composite Δ | Rounds Δ |`);
  reportLines.push(`|-------|----------------------|------|-------------|----------|`);
  for (const c of history.cycles.slice(-10)) {
    reportLines.push(`| ${c.cycle} | ${(c.hypothesis || '').slice(0, 60)} | ${c.kept ? '✅' : '❌'} | ${(c.compositeDelta || 0).toFixed(3)} | ${(c.roundsDelta || 0).toFixed(1)} |`);
  }
  reportLines.push('');
  reportLines.push(`**Best overall avg so far:** ${history.bestOverallAvg.toFixed(3)}`);
  reportLines.push(`**Cycles completed:** ${history.cycles.length}`);
  log(reportLines.join('\n'));

  // ── 7. CHECK ──────────────────────────────────────────────────────────
  phase('Check');

  // Re-check production-ready
  if (diagnosis && diagnosis.productionReady) {
    done = true;
    log('Production-ready! All tests pass with acceptable rounds.');
    break;
  }

  // Stall detection: last 3 cycles all reverted or no improvement
  const last3 = history.cycles.slice(-3);
  if (last3.length >= 3) {
    const allReverted = last3.every((c) => !c.kept);
    const noImprovement = last3.every((c) => (c.compositeDelta || 0) <= 0);
    if (allReverted || noImprovement) {
      stalled = true;
      log(`STALLED: Last 3 cycles had ${allReverted ? 'no kept changes' : 'no improvement'}. Stopping.`);
      break;
    }
  }

  // Check max cycles
  if (cycleNumber >= MAX_CYCLES) {
    log(`Reached max cycles (${MAX_CYCLES}). Stopping.`);
    break;
  }

  cycleNumber++;
  log(`--- Starting cycle ${cycleNumber} ---`);
}

// ══════════════════════════════════════════════════════════════════════════
//  FINAL RETURN
// ══════════════════════════════════════════════════════════════════════════
const finalPassRate = currentResults && currentResults.results
  ? `${(currentResults.results.filter((r) => r.pass).length / currentResults.results.length * 100).toFixed(0)}%`
  : 'N/A';

const finalAvgOverall = currentResults && currentResults.results
  ? (currentResults.results.reduce((s, r) => s + r.overall, 0) / currentResults.results.length).toFixed(3)
  : 'N/A';

log('');
log('═══════════════════════════════════════════════════════');
log(`  DEV LOOP COMPLETE`);
log(`  Cycles: ${history.cycles.length}`);
log(`  Pass rate: ${finalPassRate}`);
log(`  Avg overall: ${finalAvgOverall}`);
log(`  Production-ready: ${done || false}`);
log(`  Stalled: ${stalled || false}`);
log(`  Benchmark runs: ${totalBenchmarkRuns}`);
log('═══════════════════════════════════════════════════════');

return {
  name: 'dev-loop',
  cyclesCompleted: history.cycles.length,
  totalBenchmarkRuns,
  productionReady: done || false,
  stalled: stalled || false,
  startTime: history.startTime,
  durationMs: Date.now() - cycleStart,
  currentState: currentResults && currentResults.results ? {
    passRate: finalPassRate,
    avgOverall: parseFloat(finalAvgOverall),
    tests: currentResults.results.map((r) => ({ name: r.name, pass: r.pass, overall: r.overall, rounds: r.rounds })),
  } : null,
  history: history.cycles.map((c) => ({
    cycle: c.cycle,
    kept: c.kept,
    hypothesis: (c.hypothesis || '').slice(0, 120),
    targetDelta: c.targetDelta,
    compositeDelta: c.compositeDelta,
    roundsDelta: c.roundsDelta,
  })),
  latestDiagnosis: lastDiagnosis ? {
    weakestTest: lastDiagnosis.weakestTest,
    weakestAxis: lastDiagnosis.weakestAxis,
    axisValue: lastDiagnosis.axisValue,
    allTestsPass: lastDiagnosis.allTestsPass,
    productionReady: lastDiagnosis.productionReady,
  } : null,
  keptChanges: keptChanges.map((k) => ({ cycle: k.cycle, file: k.file })),
  summary: `Dev loop completed ${history.cycles.length} cycles. ` +
    `Production-ready: ${done}. ` +
    `Final pass rate: ${finalPassRate}. ` +
    `Best avg overall: ${history.bestOverallAvg.toFixed(3)}.`,
};
