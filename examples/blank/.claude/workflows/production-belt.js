export const meta = {
  name: 'production-belt',
  description:
    'Turn a prompt + design system into production-grade, gated, baselined, git-tracked components. ' +
    'Full automated pipeline: bootstrap the workspace, analyze & decompose, build each leaf through the ' +
    'full 5-source core-loop, capture with baselines, compose into pages, and clean up intents.',
  phases: [
    { title: 'Bootstrap' },
    { title: 'Scope' },
    { title: 'Build' },
    { title: 'Capture' },
    { title: 'Compose' },
    { title: 'Finish' },
  ],
};

// ── Config ─────────────────────────────────────────────────────────────────
const NAME = (args && args.name) || 'Component';
const INSTRUCTION = (args && args.instruction) || '';
const DS_ID = (args && args.designSystemId) || '';
const THRESHOLD = (args && args.threshold) || 0.8;
const MODE = (args && args.mode) || 'page'; // 'component' | 'page'
const SLUG = NAME.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

// ── Schemas ────────────────────────────────────────────────────────────────
const PLAN = {
  type: 'object',
  additionalProperties: true,
  properties: {
    tree: {},
    leaves: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          component: { type: 'string' },
          intent: { type: 'string' },
          exists: { type: 'boolean' },
          type: { type: 'string' }, // 'component' | 'page'
        },
        required: ['component', 'intent', 'exists'],
      },
    },
  },
  required: ['leaves'],
};
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
  properties: { composite: { type: 'number' }, decision: { type: 'string' } },
  required: ['decision'],
};
const BOOTSTRAP_RESULT = {
  type: 'object', additionalProperties: true,
  properties: { ok: { type: 'boolean' }, designSystemId: { type: 'string' }, hasDarkTheme: { type: 'boolean' } },
  required: ['ok'],
};

// ── Phase 0: Bootstrap ────────────────────────────────────────────────────
// Prepare the workspace: apply DS, generate tailwind config, rebuild graph.
phase('Bootstrap');
const boot = await agent(
  `Bootstrap the workspace for building "${NAME}" (prompt: "${INSTRUCTION}").\n` +
  `1) If DS_ID is provided ("${DS_ID}"), call manage_design_system({ action: "apply", id: "${DS_ID}" }).\n` +
  `2) Call generate_tailwind_config() — this reads the active design system's tokens.css and writes ALL --color-* roles to tailwind.config.js.\n` +
  `3) Call rebuild_graph() to index everything.\n` +
  `4) Return { ok: true, designSystemId: "<id>", hasDarkTheme: true|false } indicating the active DS and whether it has a dark theme.`,
  { label: 'bootstrap', phase: 'Bootstrap', schema: BOOTSTRAP_RESULT },
);

log(`Bootstrapped with DS: ${boot && boot.designSystemId}, dark: ${boot && boot.hasDarkTheme}`);

// ── Phase 1: Scope ────────────────────────────────────────────────────────
// Understand the prompt, query existing components, produce a decomposition plan.
phase('Scope');
const plan = await agent(
  `Decompose the brief for "${NAME}" into an on-system component tree.\n` +
  `Brief: ${JSON.stringify(INSTRUCTION)}\n` +
  `1) Call get_design_context for "${NAME}" (read the design system + tokens + primitives).\n` +
  `2) Call discover_components to see what generated/captured artifacts already exist.\n` +
  `3) Produce { tree, leaves } where leaves[] = the components needed, each:\n` +
  `   { component: PascalName, intent: "what it is + key content", exists: true|false, type: "component"|"page" }.\n` +
  `   exists=true ONLY when a captured artifact already covers it (reuse).\n` +
  `4) For single-component mode (${MODE === 'component'}), produce 1 leaf.\n` +
  `Return the JSON.`,
  { label: 'scope', phase: 'Scope', schema: PLAN },
);

const leaves = (plan && plan.leaves) || [];
const missing = leaves.filter((l) => l && !l.exists);
const reused = leaves.filter((l) => l && l.exists).map((l) => l.component);
const allComponents = leaves.map((l) => l.component);
const isPage = MODE === 'page' && leaves.length > 1;

log(`Scope: ${leaves.length} leaves — author ${missing.length} (${missing.map((l) => l.component).join(', ') || 'none'}), reuse ${reused.length} (${reused.join(', ') || 'none'}), page=${isPage}`);

// ── Phase 2: Build ────────────────────────────────────────────────────────
// Build each missing leaf through the full 5-source core-loop (no shortcuts).
phase('Build');
const builtComponents = await parallel(
  missing.map((leaf) => async () => {
    const result = await workflow('core-loop', {
      name: leaf.component,
      instruction: leaf.intent,
      threshold: THRESHOLD,
    });
    return {
      component: leaf.component,
      shipped: result && result.shipped,
      rounds: result && result.rounds,
      composite: result && result.composite,
      gate: result,
    };
  }),
);

const shippedComponents = builtComponents.filter((c) => c && c.shipped);
const failedComponents = builtComponents.filter((c) => c && !c.shipped);

log(`Build complete: ${shippedComponents.length} shipped, ${failedComponents.length} failed`);

// ── Phase 3: Capture ──────────────────────────────────────────────────────
// Transactional capture + baseline seeding. Roll back on failure.
phase('Capture');
const captured = [];
const captureFailed = [];

for (const leaf of shippedComponents) {
  try {
    await agent(
      `Call capture_component_with_baseline({ name: "${leaf.component}" }) — this promotes the component from generated/ to components/ AND seeds a visual baseline screenshot in one atomic step.`,
      { label: `capture:${leaf.component}`, phase: 'Capture' },
    );
    captured.push(leaf.component);
  } catch (e) {
    // Transactional rollback: delete already-captured dirs
    for (const already of captured) {
      await agent(
        `Rollback: remove src/components/${already}/ directory. This is a cleanup step — delete the directory if it exists.`,
        { label: `rollback:${already}`, phase: 'Capture' },
      );
    }
    captureFailed.push({ component: leaf.component, error: String(e) });
    log(`Capture transaction FAILED at ${leaf.component}. Rolled back ${captured.length} already-captured components.`);
    break;
  }
}

// Rebuild graph after captures so indexed for compose
await agent(`Call rebuild_graph() to index the newly captured components.`, { label: 'rebuild-after-capture', phase: 'Capture' });

log(`Captured: ${captured.length}, failed: ${captureFailed.length}`);

// ── Phase 4: Compose (page mode only) ─────────────────────────────────────
// Compose page from captured components with full 5-source critique.
let shipped = false;
let pageGate = null;
let pageComponent = null;

if (isPage && captured.length > 0) {
  phase('Compose');
  const pageBrief = await agent(
    `Call get_design_context with componentName="${NAME}". Return its full text.`,
    { label: 'page-brief', phase: 'Compose' },
  );

  // Compose the page
  const composeNote = ` COMPOSE existing CAPTURED components (${captured.join(', ')}) into a screen/view; import from src/components/ComponentName/. Do NOT re-implement primitives.`;
  await agent(
    `CREATE the React+Tailwind page "${NAME}" via create_component (write a CSF story too, title "Generated/${NAME}").\n` +
    composeNote + '\n' +
    `Use Tailwind utility classes with dark: variants where applicable. NEVER use inline var() — use the semantic class via the Tailwind config.\n` +
    `${boot && boot.hasDarkTheme ? 'DARK MODE: Generate dark: variants for every color utility.' : ''}\n` +
    `NON-DETERMINISTIC CODE: NEVER use new Date(), Date.now(), Math.random(), or crypto.randomUUID().\n\n` +
    `DESIGN CONTEXT:\n${pageBrief}`,
    { label: 'compose', phase: 'Compose' },
  );

  // Full 5-source critique at compose level
  let round = 0;
  let feedback = '';

  while (round < MAX_ROUNDS && !shipped) {
    round++;

    const [vision, llm, tokens, visual, a11y] = await parallel([
      () => agent(
        `Call vision_critique with component="${NAME}", mode="standard". Return the visionScore + findings.`,
        { schema: VISION, label: `vision:r${round}`, phase: 'Compose' },
      ),
      () => agent(`Review composed page "${NAME}" (slug "${SLUG}") — composition, reuse, intent-fit, voice.`, {
        agentType: 'design-reviewer',
        schema: LLM,
        label: `llm:r${round}`,
        phase: 'Compose',
      }),
      () => agent(`Audit page "${NAME}" consistency (lint + graph where-to-fix).`, {
        agentType: 'consistency-auditor',
        schema: TOKENS,
        label: `tokens:r${round}`,
        phase: 'Compose',
      }),
      () => agent(
        `Call run_visual_test for "${NAME}". Map: 'pass'|'new'→1.0, 'changed'→0.5, 'error'→0.0. Return {visual,status}.`,
        { schema: VISUAL, label: `visual:r${round}`, phase: 'Compose' },
      ),
      () => agent(
        `Run a basic a11y check on "${NAME}". If the story renders and no axe violations are visible, return {a11y: 1, violations: []}. Otherwise score proportionally.`,
        { schema: A11Y, label: `a11y:r${round}`, phase: 'Compose' },
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

    const gate = await agent(
      `Call critique_score with scores=${JSON.stringify(scores)}, mustFix=${mustFix}, threshold=${THRESHOLD}, component="${NAME}". ` +
      `Then call record_evidence with slug="${SLUG}", round=${round}, scores=${JSON.stringify(scores)}, mustFix=${mustFix}, ` +
      `composite=(from result), decision=(from result), component="${NAME}". Return the critique_score JSON.`,
      { schema: GATE, label: `gate:r${round}`, phase: 'Compose' },
    );

    pageGate = gate;
    shipped = gate && gate.decision === 'ship';
    feedback = JSON.stringify({
      vision: (vision && vision.findings) || [],
      llm: (llm && llm.findings) || [],
      tokens: (tokens && tokens.fixes) || [],
    });

    log(`page round ${round}: composite=${gate && gate.composite} decision=${gate && gate.decision} mustFix=${mustFix}`);

    if (!shipped && round < MAX_ROUNDS) {
      await agent(
        `EDIT the page "${NAME}" to fix (P0 first):\n${feedback}\nUse graph_where_to_fix for file:line, then edit_component. Stay on-system.` +
        ` NEVER use new Date(), Date.now(), Math.random(), or crypto.randomUUID().` +
        `${boot && boot.hasDarkTheme ? ' Generate dark: variants for every color utility.' : ''}`,
        { label: `revise:r${round}`, phase: 'Compose' },
      );
    }
  }

  // If shipped, capture the page too
  if (shipped) {
    await agent(
      `Call capture_component_with_baseline({ name: "${NAME}" }) — promote the composed page from generated/ to components/ and seed its baseline.`,
      { label: 'capture-page', phase: 'Compose' },
    );
    pageComponent = NAME;
  }
}

// ── Phase 5: Finish ───────────────────────────────────────────────────────
// Resolve intents, record final summary evidence, rebuild graph.
phase('Finish');
await agent(
  `Finalize the build for "${NAME}".\n` +
  `1) Resolve any pending change requests related to this build: call handle_change_request with action="resolve" for each relevant intent ID.\n` +
  `2) Call record_evidence with slug="${SLUG}", round=0, scores=..., mustFix=0, composite=..., decision=..., notes=... for the final summary.\n` +
  `3) Call rebuild_graph() to index everything.\n` +
  `Return a JSON summary of what was built.`,
  { label: 'finish', phase: 'Finish' },
);

log(`Production belt complete for "${NAME}". Shipped: ${shipped}, captured: ${captured.length}, failed: ${failedComponents.length}`);

return {
  name: NAME,
  slug: SLUG,
  mode: MODE,
  designSystem: boot && boot.designSystemId,
  components: builtComponents.map((c) => ({
    name: c && c.component,
    shipped: c && c.shipped,
    rounds: c && c.rounds,
    composite: c && c.composite,
  })),
  captured,
  captureFailed: captureFailed.map((f) => f.component),
  composed: pageComponent,
  pageShipped: shipped,
  pageGate,
  totalRounds: builtComponents.reduce((s, c) => s + (c && c.rounds || 0), 0) + (pageGate ? 1 : 0),
};
