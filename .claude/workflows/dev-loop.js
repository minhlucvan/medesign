export const meta = {
  name: 'dev-loop',
  description: 'Simple build-check-fix loop. Build a component through core-loop, check the generated output for issues, fix the engine file directly, rebuild to verify. No FIX_MAP, no fragile anchors — just build, check, fix, verify, commit.',
  phases: [
    { title: 'Build' },
    { title: 'Check' },
    { title: 'Fix' },
    { title: 'Verify' },
    { title: 'Commit' },
  ],
};

var REPO_ROOT = '/Users/minh/Documents/medesign';
var COMPONENTS = ['Button', 'MetricCard', 'NavigationBar', 'DataTable', 'FeatureShowcase'];
var MAX_CYCLES = (args && args.maxCycles) || 50;
var FIX_FILES = [
  REPO_ROOT + '/apps/workspace/templates/claude/workflows/core-loop.js',
  REPO_ROOT + '/apps/workspace/templates/claude/agents/consistency-auditor.md',
  REPO_ROOT + '/packages/dsr/src/rules/lint.ts',
  REPO_ROOT + '/packages/plugin-tailwindcss/src/index.ts',
];

log('Simple dev-loop starting');
var cycleCount = 0;
var totalFixes = 0;
var cleanCount = 0;
var compIdx = 0;

while (cycleCount < MAX_CYCLES) {
  var comp = COMPONENTS[compIdx % COMPONENTS.length];
  compIdx++;
  cycleCount++;

  // ── Build ─────────────────────────────────────────────────────────────
  phase('Build');
  log('Cycle ' + cycleCount + ': building ' + comp + '...');
  var build = await agent(
    'Build "' + comp + '" through core-loop: get_design_context, create_component, cascade (lint→visual→a11y→vision→LLM), gate. Return { shipped: boolean, rounds: number }.',
    { label: 'build-' + comp, phase: 'Build', schema: { type: 'object', properties: { shipped: { type: 'boolean' }, rounds: { type: 'number' } }, required: ['shipped'] } },
  );
  if (!build || !build.shipped) { log(comp + ' did not ship. Continuing.'); continue; }

  // ── Check ─────────────────────────────────────────────────────────────
  phase('Check');
  var srcPath = REPO_ROOT + '/examples/ledger-console/src/generated/' + comp + '.tsx';
  var issues = await agent(
    'Read ' + srcPath + ' and check for these issues. Count each:\n' +
    '1. bg-[var(--color-*)] or text-[var(--color-*)] or border-[var(--color-*)] — should use Tailwind class (bg-highlight, text-text, border-border)\n' +
    '2. style={{}} with color/background/border/font values — should use Tailwind class\n' +
    '3. Any raw hex colors like #ff0000, #fff, #0a0a0a outside :root blocks\n' +
    '4. new Date(), Date.now(), Math.random(), crypto.randomUUID()\n' +
    '5. @ts-ignore or as any\n\n' +
    'Return JSON: { issues: [{ type: string, count: number, examples: string[], fixSuggestion: string }], totalIssues: number }',
    { label: 'check-' + comp, phase: 'Check', schema: { type: 'object', properties: { issues: { type: 'array' }, totalIssues: { type: 'number' } }, required: ['totalIssues'] } },
  );

  if (!issues || issues.totalIssues === 0) {
    log(comp + ' clean. Moving on.');
    cleanCount++;
    if (cleanCount >= 10) { log('10 clean cycles. All good. Stopping.'); break; }
    continue;
  }
  cleanCount = 0;
  log(issues.totalIssues + ' issue(s) found in ' + comp);

  // ── Fix ───────────────────────────────────────────────────────────────
  phase('Fix');
  var fixResult = await agent(
    'The generated component "' + comp + '" has these issues:\n' +
    JSON.stringify(issues.issues, null, 2) + '\n\n' +
    'The fix is to improve the engine files so future components are built correctly.\n' +
    'The most likely fix is adding/modifying instructions in the build prompt at:\n' +
    FIX_FILES[0] + '\n\n' +
    'Read the file, find the right place to add an instruction that prevents these issues, and apply the edit.\n' +
    'Only change ONE file. Make the smallest possible change. Do NOT change anything unrelated.\n' +
    'Then run: cd ' + REPO_ROOT + ' && git diff --stat\n' +
    'Return { fileChanged: string, diff: string, changeDescription: string }',
    { label: 'fix-' + comp, phase: 'Fix', schema: { type: 'object', properties: { fileChanged: { type: 'string' }, diff: { type: 'string' }, changeDescription: { type: 'string' } }, required: ['fileChanged'] } },
  );
  if (!fixResult || !fixResult.fileChanged) { log('Fix failed. Continuing.'); continue; }

  // ── Verify ────────────────────────────────────────────────────────────
  phase('Verify');
  log('Rebuilding ' + comp + ' to verify fix...');
  var rebuild = await agent(
    'Rebuild "' + comp + '" through core-loop (edit mode): call edit_component, cascade, gate. Return { shipped: boolean }.',
    { label: 'verify-' + comp, phase: 'Verify', schema: { type: 'object', properties: { shipped: { type: 'boolean' } }, required: ['shipped'] } },
  );

  var recheck = await agent(
    'Read ' + srcPath + ' and check the SAME issues again. Return the same JSON format: { issues: [{type, count, examples}], totalIssues: number }',
    { label: 'recheck-' + comp, phase: 'Verify', schema: { type: 'object', properties: { issues: { type: 'array' }, totalIssues: { type: 'number' } }, required: ['totalIssues'] } },
  );

  if (recheck && recheck.totalIssues === 0) {
    // ── Commit ────────────────────────────────────────────────────────
    phase('Commit');
    await agent(
      'Commit the fix: cd ' + REPO_ROOT + ' && git add -A && git commit -m "dev-loop: fix ' + issues.totalIssues + ' issue(s) in ' + comp + ' — ' + (issues.issues[0] ? issues.issues[0].type : '') + '" -m "Changed: ' + (fixResult.fileChanged || '') + '"',
      { label: 'commit', phase: 'Commit' },
    );
    totalFixes += issues.totalIssues;
    log('✅ Fixed ' + issues.totalIssues + ' issue(s) and committed. Total fixes: ' + totalFixes);
  } else {
    log('Fix did not resolve all issues (' + (recheck ? recheck.totalIssues : 'unknown') + ' remaining). Reverting.');
    await agent(
      'Revert: cd ' + REPO_ROOT + ' && git restore ' + (fixResult.fileChanged || '.'),
      { label: 'revert', phase: 'Verify' },
    );
  }
}

log('=== Done: ' + totalFixes + ' fixes across ' + cycleCount + ' cycles ===');
return { totalFixes: totalFixes, cyclesCompleted: cycleCount };
