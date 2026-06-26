export const meta = {
  name: 'core-loop',
  description:
    'Build a single component until it is genuinely done. Every round uses ALL 5 feedback sources ' +
    '(vision + llm + tokens + visual + a11y). The loop keeps going until every condition passes: ' +
    'composite >= threshold, mustFix === 0, each source above its floor, no regression, and all ' +
    'previous findings resolved. No round cap — only stops when done or plateaued.',
  phases: [
    { title: 'Analyze' },
    { title: 'Build' },
    { title: 'Critique' },
    { title: 'Gate' },
    { title: 'Capture' },
  ],
};

// ── Config ─────────────────────────────────────────────────────────────────
const NAME = (args && args.name) || 'Component';
const INSTRUCTION = (args && args.instruction) || '';
const THRESHOLD = (args && args.threshold) || 0.8;
const PLATEAU_LIMIT = 3; // consecutive rounds with no composite improvement → stop
const SLUG = NAME.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const SOURCE_FLOORS = JSON.stringify({
  vision: 0.7,
  llm: 0.7,
  tokens: 0.8,
  visual: 0.85,
  a11y: 0.8,
});

// ── Schemas ────────────────────────────────────────────────────────────────
const VISION = {
  type: 'object', additionalProperties: true,
  properties: { visionScore: { type: 'number' }, mustFix: { type: 'number' }, findings: { type: 'array' } },
  required: ['visionScore'],
};
const LLM = {
  type: 'object', additionalProperties: true,
  properties: { llm: { type: 'number' }, findings: { type: 'array' } },
  required: ['llm'],
};
const TOKENS = {
  type: 'object', additionalProperties: true,
  properties: { tokens: { type: 'number' }, mustFix: { type: 'number' }, fixes: { type: 'array' } },
  required: ['tokens', 'mustFix'],
};
const VISUAL = {
  type: 'object', additionalProperties: true,
  properties: { visual: { type: 'number' }, status: { type: 'string' } },
  required: ['visual'],
};
const A11Y = {
  type: 'object', additionalProperties: true,
  properties: { a11y: { type: 'number' }, violations: { type: 'array' } },
  required: ['a11y'],
};
const GATE = {
  type: 'object', additionalProperties: true,
  properties: {
    composite: { type: 'number' },
    decision: { type: 'string' },
    unsatisfiedConditions: { type: 'array' },
  },
  required: ['decision'],
};

// ── Phase 1: Analyze ───────────────────────────────────────────────────────
// Get the full design system context + graph guidance.
phase('Analyze');
const darkCheck = await agent(
  `Check the active design system: call get_design_context with componentName="${NAME}", instruction=${JSON.stringify(INSTRUCTION)}. ` +
  `Return the FULL text.`,
  { label: 'analyze', phase: 'Analyze' },
);

const hasDarkTheme = darkCheck && /data-theme\s*=\s*"dark"/i.test(darkCheck);

log(`Context loaded for "${NAME}". Dark theme: ${hasDarkTheme}`);

// ── Loop: Build → Critique → Gate → Fix ────────────────────────────────────
let round = 0;
let done = false;
let plateau = 0;
let prevComposite = 0;
let prevFindings = '';
let previousFindingsList = '';
let lastResult = null;

while (!done) {
  round++;

  // ── Build ──────────────────────────────────────────────────────────────────
  phase('Build');
  const op = round === 1 ? 'create' : 'edit';
  const darkNote = hasDarkTheme
    ? ' DARK MODE: Generate `dark:` variants for every color utility (e.g., `dark:bg-surface dark:text-text`). Verify the component looks correct in both themes.'
    : '';
  await agent(
    `${op === 'create' ? 'CREATE' : 'EDIT'} the React+Tailwind component "${NAME}" via ` +
    `\`${op === 'create' ? 'create_component' : 'edit_component'}\` (write a CSF story too, title "Generated/${NAME}").` +
    ` Compose primitives from "@ds", reference token roles only, obey the Anti-patterns.\n` +
    `${darkNote}` +
    ` NON-DETERMINISTIC CODE: NEVER use \`new Date()\`, \`Date.now()\`, \`Math.random()\`, or \`crypto.randomUUID()\` in component source. Pass dynamic values via props.\n\n` +
    `DESIGN CONTEXT:\n${darkCheck}\n\n` +
    (round > 1
      ? `UNSATISFIED CONDITIONS from the previous round:\n${previousFindingsList}\n\n` +
        `PREVIOUS FINDINGS (must fix these P0 first):\n${prevFindings}\n\n`
      : ''),
    { label: `build:r${round}`, phase: 'Build' },
  );

  // ── Critique: ALL 5 sources in parallel ────────────────────────────────────
  phase('Critique');
  log(`Critiquing "${NAME}" round ${round} (5 sources)...`);

  const [vision, llm, tokens, visual, a11y] = await parallel([
    () => agent(
      `Call the emdesign MCP tool \`vision_critique\` with component="${NAME}", mode="standard". Return the visionScore + findings with region tags.`,
      { schema: VISION, label: `vision:r${round}`, phase: 'Critique' },
    ),
    () => agent(
      `Review component "${NAME}" (slug "${SLUG}") — code quality, API design, design-system semantics, intent alignment, voice/tone. Assess 5 axes: composition, api, semantics, intent-fit, voice. Return score + findings.`,
      { agentType: 'design-reviewer', schema: LLM, label: `llm:r${round}`, phase: 'Critique' },
    ),
    () => agent(
      `Audit component "${NAME}" consistency (lint + graph where-to-fix). For each finding, call graph_where_to_fix for exact file:line and the token role to use. Also check for non-deterministic code (new Date(), Date.now(), Math.random(), crypto.randomUUID()) — report these as P0.`,
      { agentType: 'consistency-auditor', schema: TOKENS, label: `tokens:r${round}`, phase: 'Critique' },
    ),
    () => agent(
      `Call \`run_visual_test\` for "${NAME}". Map: 'pass'|'new' → visual=1.0, 'changed' → 0.5, 'error' → 0.0. Return {visual,status}.`,
      { schema: VISUAL, label: `visual:r${round}`, phase: 'Critique' },
    ),
    () => agent(
      `Run a basic accessibility check on "${NAME}". If the story renders and no obvious axe violations exist, return {a11y: 1, violations: []}. Otherwise score proportionally and list violations.`,
      { schema: A11Y, label: `a11y:r${round}`, phase: 'Critique' },
    ),
  ]);

  const scores = {
    vision: vision && vision.visionScore,
    llm: llm && llm.llm,
    tokens: tokens && tokens.tokens,
    visual: visual && visual.visual,
    a11y: a11y && a11y.a11y,
  };
  const mustFix = ((vision && vision.mustFix) || 0) + ((tokens && tokens.mustFix) || 0);

  // ── Gate ───────────────────────────────────────────────────────────────────
  phase('Gate');
  const gate = await agent(
    `Call \`critique_score\` with scores=${JSON.stringify(scores)}, mustFix=${mustFix}, threshold=${THRESHOLD}, ` +
    `component="${NAME}", sourceFloors=${SOURCE_FLOORS}. ` +
    `Then call \`record_evidence\` with slug="${SLUG}", round=${round}, scores=${JSON.stringify(scores)}, ` +
    `mustFix=${mustFix}, composite=(from result), decision=(from result), component="${NAME}". ` +
    `Return the FULL critique_score JSON.`,
    { schema: GATE, label: `gate:r${round}`, phase: 'Gate' },
  );

  lastResult = {
    round,
    composite: gate && gate.composite,
    decision: gate && gate.decision,
    mustFix,
    unsatisfiedConditions: (gate && gate.unsatisfiedConditions) || [],
    scores,
  };

  log(`Round ${round}: composite=${gate && gate.composite} decision=${gate && gate.decision} ` +
    `mustFix=${mustFix} unsatisfied=${((gate && gate.unsatisfiedConditions) || []).length}`);

  // ── Check: done? ──────────────────────────────────────────────────────────
  done = gate && gate.decision === 'ship';
  if (done) {
    log(`Component "${NAME}" passed all conditions. Moving to capture.`);
    break;
  }

  // ── Plateau detection ────────────────────────────────────────────────────
  const curComposite = (gate && gate.composite) || 0;
  if (Math.abs(curComposite - prevComposite) < 0.01) {
    plateau++;
    log(`Plateau count: ${plateau}/${PLATEAU_LIMIT} (composite stuck at ${curComposite})`);
  } else {
    plateau = 0;
  }
  prevComposite = curComposite;

  if (plateau >= PLATEAU_LIMIT) {
    log(`COMPONENT "${NAME}" PLATEAUED after ${round} rounds — composite stuck at ${curComposite}. Stopping.`);
    lastResult.stoppedReason = `plateau — no composite improvement for ${PLATEAU_LIMIT} consecutive rounds`;
    break;
  }

  // ── Prepare feedback for the next round ──────────────────────────────────
  previousFindingsList = (gate && gate.unsatisfiedConditions && gate.unsatisfiedConditions.length > 0)
    ? gate.unsatisfiedConditions.map((c, i) => `  ${i + 1}. ${c}`).join('\n')
    : 'None recorded.';

  // Serialize all findings for the fix prompt
  const allFindings = [];
  if (vision && vision.findings) allFindings.push(...vision.findings);
  if (llm && llm.findings) allFindings.push(...llm.findings);
  if (tokens && tokens.fixes) allFindings.push(...tokens.fixes);
  if (a11y && a11y.violations) allFindings.push(...a11y.violations);

  prevFindings = allFindings.length > 0
    ? allFindings.map((f, i) => `  ${i + 1}. ${f.severity ? `[${f.severity}] ` : ''}${f.message || f.issue || ''}${f.where ? ` (${f.where})` : ''}${f.fix ? ` → ${f.fix}` : ''}`).join('\n')
    : 'No specific findings recorded — check the unsatisfied conditions above.';
}

// ── Capture ─────────────────────────────────────────────────────────────────
// Only if the component passed all conditions.
phase('Capture');
if (done) {
  await agent(
    `Call capture_component_with_baseline({ name: "${NAME}" }) — this promotes the component from generated/ to components/ AND seeds a visual baseline screenshot in one atomic step.`,
    { label: 'capture', phase: 'Capture' },
  );
  log(`Component "${NAME}" captured with baseline.`);
} else {
  log(`Component "${NAME}" did NOT pass all conditions. Recording evidence without capture.`);
  await agent(
    `Call record_evidence with slug="${SLUG}"-failed, scores=${JSON.stringify(lastResult ? lastResult.scores : {})}, ` +
    `mustFix=${lastResult ? lastResult.mustFix : 0}, composite=${lastResult ? lastResult.composite : 0}, ` +
    `decision="revise", notes="Stopped: ${lastResult ? lastResult.stoppedReason || 'failed to meet all conditions' : 'unknown'}".`,
    { label: 'record-failure', phase: 'Capture' },
  );
}

// ── Return ──────────────────────────────────────────────────────────────────
return {
  name: NAME,
  slug: SLUG,
  shipped: done,
  rounds: round,
  composite: lastResult && lastResult.composite,
  decision: lastResult && lastResult.decision,
  mustFix: lastResult && lastResult.mustFix,
  unsatisfiedConditions: lastResult && lastResult.unsatisfiedConditions,
  stoppedReason: lastResult && lastResult.stoppedReason,
  captured: done,
};
