export const meta = {
  name: 'core-loop',
  description: 'Build a single component until genuinely done. Progressive cascade: lint first (fastest), then visual, a11y, vision, LLM (slowest last). Each stage fails fast — if a check fails, fix it immediately and recheck before moving to the next stage. No round cap — only stops when done or plateaued.',
  phases: [
    { title: 'Analyze' },
    { title: 'Build' },
    { title: 'Lint' },
    { title: 'Visual' },
    { title: 'A11y' },
    { title: 'Vision' },
    { title: 'LLM' },
    { title: 'Gate' },
  ],
};

// ── Config ─────────────────────────────────────────────────────────────────
const NAME = (args && args.name) || 'Component';
const INSTRUCTION = (args && args.instruction) || '';
const THRESHOLD = (args && args.threshold) || 0.8;
const PLATEAU_LIMIT = 3;
const SLUG = NAME.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const SOURCE_FLOORS = JSON.stringify({ vision: 0.7, llm: 0.7, tokens: 0.8, visual: 0.85, a11y: 0.8 });

const STAGE_LIMITS = { lint: 5, visual: 5, a11y: 5, vision: 3, llm: 3 };

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
  properties: { composite: { type: 'number' }, decision: { type: 'string' }, unsatisfiedConditions: { type: 'array' } },
  required: ['decision'],
};

// ── Helper: run a cascade stage with immediate fix loop ─────────────────────
async function cascadeStage(name, labelPrefix, checkFn, fixPrompt, maxIter) {
  phase(name);
  for (let i = 0; i < maxIter; i++) {
    const result = await checkFn(i);
    if (result && result.pass) return result;
    if (i < maxIter - 1) {
      await agent(fixPrompt(result, i), { label: `${labelPrefix}:fix:r${i}`, phase: name });
    }
  }
  // Return last result even if failing — caller handles plateau/gate
  const final = await checkFn(maxIter - 1);
  return final || { pass: false };
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 1: ANALYZE
// ══════════════════════════════════════════════════════════════════════════
phase('Analyze');
const designContext = await agent(
  `Call get_design_context with componentName="${NAME}", instruction=${JSON.stringify(INSTRUCTION)}. Return the FULL text.`,
  { label: 'analyze', phase: 'Analyze' },
);
const hasDarkTheme = designContext && /data-theme\s*=\s*"dark"/i.test(designContext);
log(`Context loaded for "${NAME}". Dark theme: ${hasDarkTheme}`);

// ══════════════════════════════════════════════════════════════════════════
//  MAIN LOOP: Build → Cascade (Lint → Visual → a11y → Vision → LLM) → Gate
// ══════════════════════════════════════════════════════════════════════════
let round = 0;
let done = false;
let plateau = 0;
let prevComposite = 0;
let prevFeedback = '';
let lastResult = null;

while (!done) {
  round++;

  // ── Build ──────────────────────────────────────────────────────────────
  phase('Build');
  const op = round === 1 ? 'create' : 'edit';
  const darkNote = hasDarkTheme
    ? ' DARK MODE: Generate `dark:` variants for every color utility. Verify component looks correct in both themes.'
    : '';
  await agent(
    `${op === 'create' ? 'CREATE' : 'EDIT'} the React+Tailwind component "${NAME}" via ` +
    `\`${op === 'create' ? 'create_component' : 'edit_component'}\` (write a CSF story, title "Generated/${NAME}").` +
    ` Compose primitives from "@ds", reference token roles only, obey the Anti-patterns.\n` +
    ` TAILWIND CONFIG: The active design system's tailwind.config.js maps ALL --color-* tokens to semantic classes (bg-surface, text-highlight, border-accent, etc.). Use these classes INSTEAD of inline var() or arbitrary values. For example, use bg-highlight not bg-[var(--color-highlight)], text-text-muted not text-[var(--color-text-muted)], border-border not border-[var(--color-border)], hover:bg-surface not hover:bg-[var(--color-surface)]. Only use var(--x) for non-color tokens like --motion-fast, --focus-ring, --shadow-raised, --radius, --space-unit.\n` +
    ` CRITICAL: Never write \`text-[var(--color-X)]\` — always strip the \`--color-\` prefix and use the name directly: \`text-[var(--color-success)]\` => \`text-success\`, \`text-[var(--color-danger)]\` => \`text-danger\`, \`text-[var(--color-text)]\` => \`text-text\`. Same rule applies for \`bg-[var(--color-X)]\` => \`bg-X\` and \`border-[var(--color-X)]\` => \`border-X\`.\n${darkNote}` +
    ` NON-DETERMINISTIC CODE: NEVER use \`new Date()\`, \`Date.now()\`, \`Math.random()\`, or \`crypto.randomUUID()\` in component source.\n\n` +
    `DESIGN CONTEXT:\n${designContext}\n\n` +
    (prevFeedback ? `FIX THESE from the previous round:\n${prevFeedback}\n\n` : ''),
    { label: `build:r${round}`, phase: 'Build' },
  );

  // ══════════════════════════════════════════════════════════════════════
  //  CASCADE: 5 stages, cheapest first
  // ══════════════════════════════════════════════════════════════════════

  // ── Stage 1: Lint ──────────────────────────────────────────────────────
  const tokensResult = await cascadeStage(
    'Lint', `tokens:r${round}`,
    async (i) => {
      const res = await agent(
        `Audit "${NAME}" consistency (lint + graph where-to-fix). Check for non-deterministic code (new Date(), Date.now(), Math.random(), crypto.randomUUID()). Return tokens score and mustFix count.`,
        { agentType: 'consistency-auditor', schema: TOKENS, label: `tokens:r${round}:${i}`, phase: 'Lint' },
      );
      const pass = res && res.mustFix === 0 && res.tokens >= 0.8;
      return { ...res, pass };
    },
    (res) => `FIX these P0/P1 lint issues in "${NAME}":\n${
      (res && res.fixes ? res.fixes.map((f) => `[${f.severity}] ${f.message}${f.where ? ` (${f.where})` : ''}`).join('\n') : '')
    }\nUse graph_where_to_fix for exact file:line. Call edit_component to apply fixes.`,
    STAGE_LIMITS.lint,
  );

  // ── Stage 2: Visual ────────────────────────────────────────────────────
  const visualResult = await cascadeStage(
    'Visual', `visual:r${round}`,
    async (i) => {
      const res = await agent(
        `Call \`run_visual_test\` for "${NAME}". Map: 'pass'|'new' → visual=1.0, 'changed' → 0.5, 'error' → 0.0. Return {visual, status}.`,
        { schema: VISUAL, label: `visual:r${round}:${i}`, phase: 'Visual' },
      );
      const pass = res && (res.status === 'pass' || res.status === 'new');
      return { ...res, pass };
    },
    (res, i) => `Fix visual issues in "${NAME}". The visual test returned status="${res?.status}" with score ${res?.visual}. Check the diff screenshot if available. Adjust colors, spacing, layout to match the design spec. Call edit_component.`,
    STAGE_LIMITS.visual,
  );

  // ── Stage 3: a11y ──────────────────────────────────────────────────────
  const a11yResult = await cascadeStage(
    'A11y', `a11y:r${round}`,
    async (i) => {
      const res = await agent(
        `Run accessibility check on "${NAME}". Check for axe violations. Score: 1.0 minus penalties for critical(0.15), serious(0.08), moderate(0.04) violations. Return {a11y, violations}.`,
        { schema: A11Y, label: `a11y:r${round}:${i}`, phase: 'A11y' },
      );
      const pass = res && res.a11y >= 0.8;
      return { ...res, pass };
    },
    (res) => `Fix accessibility issues in "${NAME}":\n${
      (res && res.violations ? res.violations.map((v) => `[${v.impact || 'minor'}] ${v.id}: ${v.description}`).join('\n') : '')
    }\nAdd aria-labels, roles, keyboard handlers, proper heading hierarchy. Call edit_component.`,
    STAGE_LIMITS.a11y,
  );

  // ── Stage 4: Vision (slow — only reached if lint + visual + a11y pass) ──
  const visionResult = await cascadeStage(
    'Vision', `vision:r${round}`,
    async (i) => {
      const res = await agent(
        `Call \`vision_critique\` with component="${NAME}", mode="standard". Return visionScore + findings with region tags.`,
        { schema: VISION, label: `vision:r${round}:${i}`, phase: 'Vision' },
      );
      const pass = res && res.visionScore >= 0.7;
      return { ...res, pass };
    },
    (res) => `Fix visual design issues in "${NAME}" based on vision critique:\n${
      (res && res.findings ? res.findings.map((f) => `${f.region ? `[${f.region}] ` : ''}${f.issue || f.message}${f.fix ? ` → ${f.fix}` : ''}`).join('\n') : '')
    }\nAdjust hierarchy, balance, spacing, on-brand fit. Call edit_component.`,
    STAGE_LIMITS.vision,
  );

  // ── Stage 5: LLM (slow — only reached if all above pass) ────────────
  const llmResult = await cascadeStage(
    'LLM', `llm:r${round}`,
    async (i) => {
      const res = await agent(
        `Review component "${NAME}" (slug "${SLUG}") — code quality, API design, design-system semantics, intent alignment, voice/tone. Assess 5 axes: composition, api, semantics, intent-fit, voice. Return score + findings.`,
        { agentType: 'design-reviewer', schema: LLM, label: `llm:r${round}:${i}`, phase: 'LLM' },
      );
      const pass = res && res.llm >= 0.7;
      return { ...res, pass };
    },
    (res) => `Fix code/spec issues in "${NAME}" based on LLM review:\n${
      (res && res.findings ? res.findings.map((f) => `${f.severity ? `[${f.severity}] ` : ''}${f.issue || f.message}${f.fix ? ` → ${f.fix}` : ''}`).join('\n') : '')
    }\nImprove composition, API, semantics. Call edit_component.`,
    STAGE_LIMITS.llm,
  );

  // ══════════════════════════════════════════════════════════════════════
  //  FINAL GATE
  // ══════════════════════════════════════════════════════════════════════
  phase('Gate');

  const scores = {
    vision: visionResult && visionResult.visionScore,
    llm: llmResult && llmResult.llm,
    tokens: tokensResult && tokensResult.tokens,
    visual: visualResult && visualResult.visual,
    a11y: a11yResult && a11yResult.a11y,
  };
  const mustFix = ((visionResult && visionResult.mustFix) || 0) + ((tokensResult && tokensResult.mustFix) || 0);

  const gate = await agent(
    `Call \`critique_score\` with scores=${JSON.stringify(scores)}, mustFix=${mustFix}, threshold=${THRESHOLD}, ` +
    `component="${NAME}", sourceFloors=${SOURCE_FLOORS}. ` +
    `Then call \`record_evidence\` with slug="${SLUG}", round=${round}, scores=${JSON.stringify(scores)}, ` +
    `mustFix=${mustFix}, composite=(from result), decision=(from result), component="${NAME}". ` +
    `Return the FULL critique_score JSON.`,
    { schema: GATE, label: `gate:r${round}`, phase: 'Gate' },
  );

  lastResult = {
    round, composite: gate && gate.composite, decision: gate && gate.decision,
    mustFix, unsatisfiedConditions: (gate && gate.unsatisfiedConditions) || [], scores,
  };

  log(`Round ${round}: composite=${gate && gate.composite} decision=${gate && gate.decision} ` +
    `mustFix=${mustFix} unsatisfied=${((gate && gate.unsatisfiedConditions) || []).length}`);

  done = gate && gate.decision === 'ship';
  if (done) break;

  // ── Plateau detection ──────────────────────────────────────────────────
  const curComposite = (gate && gate.composite) || 0;
  if (Math.abs(curComposite - prevComposite) < 0.01) { plateau++; } else { plateau = 0; }
  prevComposite = curComposite;

  if (plateau >= PLATEAU_LIMIT) {
    log(`COMPONENT "${NAME}" PLATEAUED after ${round} rounds — composite stuck at ${curComposite}.`);
    lastResult.stoppedReason = `plateau — no composite improvement for ${PLATEAU_LIMIT} consecutive rounds`;
    break;
  }

  // ── Feedback for next round ────────────────────────────────────────────
  prevFeedback = [
    ...(gate && gate.unsatisfiedConditions ? gate.unsatisfiedConditions.map((c) => `CONDITION: ${c}`) : []),
    ...(tokensResult && tokensResult.fixes ? tokensResult.fixes.map((f) => `[${f.severity}] ${f.message}${f.where ? ` (${f.where})` : ''}`) : []),
    ...(visionResult && visionResult.findings ? visionResult.findings.map((f) => `${f.region ? `[${f.region}] ` : ''}${f.issue || f.message}`) : []),
    ...(llmResult && llmResult.findings ? llmResult.findings.map((f) => `${f.severity ? `[${f.severity}] ` : ''}${f.issue || f.message}`) : []),
    ...(a11yResult && a11yResult.violations ? a11yResult.violations.map((v) => `[a11y] ${v.id}: ${v.description}`) : []),
  ].join('\n');
}

// ── Capture ─────────────────────────────────────────────────────────────────
phase('A11y'); // reuse last phase slot for capture status
if (done) {
  await agent(
    `Call capture_component_with_baseline({ name: "${NAME}" }) — promote generated → components/ and seed visual baseline.`,
    { label: 'capture', phase: 'A11y' },
  );
  log(`Component "${NAME}" captured with baseline.`);
} else {
  await agent(
    `Call record_evidence with slug="${SLUG}-failed", scores=${JSON.stringify(lastResult ? lastResult.scores : {})}, ` +
    `mustFix=${lastResult ? lastResult.mustFix : 0}, composite=${lastResult ? lastResult.composite : 0}, ` +
    `decision="revise", notes="Stopped: ${lastResult ? lastResult.stoppedReason || 'failed to meet all conditions' : 'unknown'}".`,
    { label: 'record-failure', phase: 'A11y' },
  );
}

return {
  name: NAME, slug: SLUG, shipped: done, rounds: round,
  composite: lastResult && lastResult.composite,
  decision: lastResult && lastResult.decision,
  mustFix: lastResult && lastResult.mustFix,
  unsatisfiedConditions: lastResult && lastResult.unsatisfiedConditions,
  stoppedReason: lastResult && lastResult.stoppedReason,
  captured: done,
};
