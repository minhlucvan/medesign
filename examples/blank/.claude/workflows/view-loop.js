export const meta = {
  name: 'view-loop',
  description:
    'Craft a large, complex page by progressive decomposition: decompose the brief into a component tree → author missing components (each gated via design-loop) or reuse existing ones → compose them into the page → verify the whole page against the four feedback sources.',
  phases: [{ title: 'Decompose' }, { title: 'Author' }, { title: 'Compose' }, { title: 'Verify' }],
};

// args: { name, instruction, threshold?, maxDepth?, maxRounds? }
const NAME = (args && args.name) || 'Page';
const INSTRUCTION = (args && args.instruction) || '';
const THRESHOLD = (args && args.threshold) || 0.8;
const MAX_DEPTH = (args && args.maxDepth) || 3;
const MAX_ROUNDS = (args && args.maxRounds) || 4;
const SLUG = NAME.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

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
        properties: { component: { type: 'string' }, intent: { type: 'string' }, exists: { type: 'boolean' } },
        required: ['component', 'intent', 'exists'],
      },
    },
  },
  required: ['leaves'],
};
const VISION = { type: 'object', additionalProperties: true, properties: { visionScore: { type: 'number' }, mustFix: { type: 'number' }, findings: { type: 'array' } }, required: ['visionScore'] };
const LLM = { type: 'object', additionalProperties: true, properties: { llm: { type: 'number' }, findings: { type: 'array' } }, required: ['llm'] };
const TOKENS = { type: 'object', additionalProperties: true, properties: { tokens: { type: 'number' }, mustFix: { type: 'number' }, fixes: { type: 'array' } }, required: ['tokens', 'mustFix'] };
const VISUAL = { type: 'object', additionalProperties: true, properties: { visual: { type: 'number' }, status: { type: 'string' } }, required: ['visual'] };
const GATE = { type: 'object', additionalProperties: true, properties: { composite: { type: 'number' }, decision: { type: 'string' } }, required: ['decision'] };

// ---- 1. Decompose: brief → a component tree (page → sections → components), reuse vs author ----
phase('Decompose');
const plan = await agent(
  `Decompose the page "${NAME}" into an on-system component tree (PROGRESSIVE DECOMPOSITION, max depth ${MAX_DEPTH}).\n` +
    `Brief: ${JSON.stringify(INSTRUCTION)}.\n` +
    `1) Call get_design_context for "${NAME}" (read the design system's layout/vibe + composable primitives).\n` +
    `2) Call graph_query({label:'artifact'}) and graph_query({label:'primitive'}) to see what components ALREADY exist.\n` +
    `3) Produce { tree, leaves } where leaves[] = the section-level components needed, each\n` +
    `   { component: PascalName, intent: "what it is + key content", exists: true|false }.\n` +
    `   exists=true ONLY when a captured artifact (art/<Name>) already covers it (reuse). A complex section may\n` +
    `   decompose into multiple leaves. Use the page-architect skill.\n` +
    `4) Also write the plan to design/changes/${SLUG}/plan.json. Return the JSON.`,
  { schema: PLAN, label: 'decompose', phase: 'Decompose' },
);

const leaves = (plan && plan.leaves) || [];
const missing = leaves.filter((l) => l && !l.exists);
const reused = leaves.filter((l) => l && l.exists).map((l) => l.component);
const allComponents = leaves.map((l) => l.component);
log(`plan: ${leaves.length} leaves — author ${missing.length} (${missing.map((l) => l.component).join(', ') || 'none'}), reuse ${reused.length} (${reused.join(', ') || 'none'})`);

// ---- 2. Author the MISSING leaves — each via the proven component gate (nested design-loop) + capture ----
phase('Author');
const authored = await parallel(
  missing.map((leaf) => async () => {
    const res = await workflow('design-loop', { name: leaf.component, instruction: leaf.intent, threshold: THRESHOLD });
    await agent(
      `Capture the leaf component "${leaf.component}" as reusable: call capture_reusable_component({ name: "${leaf.component}" }).`,
      { label: `capture:${leaf.component}`, phase: 'Author' },
    );
    return { component: leaf.component, shipped: !!(res && res.shipped) };
  }),
);

// ---- 3. Compose the page from the (now captured) leaf components ----
phase('Compose');
await agent(
  `COMPOSE the page "${NAME}". Import the captured leaf components (${allComponents.join(', ') || 'none'}) and lay them ` +
    `out per the plan tree into a full page. Use create_component to write generated/${NAME}.tsx + a CSF story ` +
    `(title "Generated/${NAME}", Default export). Compose components + design-system primitives only — do NOT ` +
    `re-implement them. Token roles + the DESIGN.md layout/spacing rules only; keep ONE accent budget across the ` +
    `whole page. Then call graph_rebuild so the page's composes edges are indexed.`,
  { label: 'compose', phase: 'Compose' },
);

// ---- 4. Verify the WHOLE page; revise until the gate passes ----
let round = 0;
let shipped = false;
let last = null;
let feedback = '';
while (round < MAX_ROUNDS && !shipped) {
  round++;
  phase('Verify');
  const [vision, llm, tokens, visual] = await parallel([
    () => agent(`Call the emdesign MCP tool \`vision_critique\` with component="${NAME}", mode="standard". Return the visionScore + findings.`, { schema: VISION, label: `vision:r${round}`, phase: 'Verify' }),
    () => agent(`Review the composed page "${NAME}" (slug "${SLUG}") — composition, reuse of captured components, intent-fit, voice.`, { agentType: 'design-reviewer', schema: LLM, label: `llm:r${round}`, phase: 'Verify' }),
    () => agent(`Audit page "${NAME}" consistency (lint + graph where-to-fix).`, { agentType: 'consistency-auditor', schema: TOKENS, label: `tokens:r${round}`, phase: 'Verify' }),
    () => agent(`Call run_visual_test for "${NAME}"; map status 'pass'|'new'→1.0, 'changed'→0.5, 'error'→0.0. Return {visual,status}.`, { schema: VISUAL, label: `visual:r${round}`, phase: 'Verify' }),
  ]);
  const scores = { vision: vision && vision.visionScore, llm: llm && llm.llm, tokens: tokens && tokens.tokens, visual: visual && visual.visual };
  const mustFix = ((vision && vision.mustFix) || 0) + ((tokens && tokens.mustFix) || 0);
  const gate = await agent(
    `Call critique_score scores=${JSON.stringify(scores)} mustFix=${mustFix} threshold=${THRESHOLD} component="${NAME}". ` +
      `Then record_evidence slug="${SLUG}" round=${round} scores=${JSON.stringify(scores)} mustFix=${mustFix} composite=(result) decision=(result) component="${NAME}". Return the critique_score JSON.`,
    { schema: GATE, label: `gate:r${round}`, phase: 'Verify' },
  );
  last = gate;
  shipped = !!(gate && gate.decision === 'ship');
  feedback = JSON.stringify({ vision: (vision && vision.findings) || [], llm: (llm && llm.findings) || [], tokens: (tokens && tokens.fixes) || [] });
  if (!shipped && round < MAX_ROUNDS) {
    await agent(`EDIT the page "${NAME}" to fix (P0 first):\n${feedback}\nUse graph_where_to_fix for file:line, then edit_component. Stay on-system.`, { label: `revise:r${round}`, phase: 'Verify' });
  }
  log(`page round ${round}: composite=${gate && gate.composite} decision=${gate && gate.decision} mustFix=${mustFix}`);
}

return { name: NAME, slug: SLUG, reused, authored, shipped, gate: last, plan: plan && plan.tree };
