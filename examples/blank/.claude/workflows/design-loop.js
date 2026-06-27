export const meta = {
  name: 'design-loop',
  description:
    'Multi-feedback design loop: build → critique with four sources (rule + visual + vision + LLM) → authoritative gate → revise, until the component is beautiful, consistent, testable, shippable.',
  phases: [
    { title: 'Analyze' },
    { title: 'Build' },
    { title: 'Critique' },
    { title: 'Gate' },
  ],
};

// args: { name, instruction, threshold?, maxRounds? }
const NAME = (args && args.name) || 'Component';
const INSTRUCTION = (args && args.instruction) || '';
const THRESHOLD = (args && args.threshold) || 0.8;
const MAX_ROUNDS = (args && args.maxRounds) || 4;
const MODE = (args && args.mode) || 'build'; // 'build' | 'compose' (views) | 'update' (apply a change-request to an existing component)
const UPDATE = MODE === 'update';
const COMPOSE_NOTE =
  MODE === 'compose'
    ? ' COMPOSE existing CAPTURED components (import them) into a screen/view; do NOT re-implement primitives. Use graph_query({label:"artifact"}) to see what exists.'
    : '';
const SLUG = NAME.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const VISION = {
  type: 'object',
  additionalProperties: true,
  properties: { visionScore: { type: 'number' }, mustFix: { type: 'number' }, findings: { type: 'array' } },
  required: ['visionScore'],
};
const LLM = {
  type: 'object',
  additionalProperties: true,
  properties: { llm: { type: 'number' }, findings: { type: 'array' } },
  required: ['llm'],
};
const TOKENS = {
  type: 'object',
  additionalProperties: true,
  properties: { tokens: { type: 'number' }, mustFix: { type: 'number' }, fixes: { type: 'array' } },
  required: ['tokens', 'mustFix'],
};
const VISUAL = {
  type: 'object',
  additionalProperties: true,
  properties: { visual: { type: 'number' }, status: { type: 'string' } },
  required: ['visual'],
};
const GATE = {
  type: 'object',
  additionalProperties: true,
  properties: { composite: { type: 'number' }, decision: { type: 'string' } },
  required: ['decision'],
};

phase('Analyze');
const brief = await agent(
  `Call the emdesign MCP tool \`get_design_context\` with componentName="${NAME}" and instruction=${JSON.stringify(
    INSTRUCTION,
  )}. Return its full text (the design system + tokens + consistency brief). Output only that text.`,
  { label: 'analyze' },
);

let round = 0;
let shipped = false;
let feedback = '';
let last = null;

while (round < MAX_ROUNDS && !shipped) {
  round++;

  phase('Build');
  // 'update' edits the existing component from round 1; build/compose create it on round 1, then edit.
  const op = round === 1 && !UPDATE ? 'create' : 'edit';
  await agent(
    `${op === 'create' ? 'CREATE' : 'EDIT'} the React+Tailwind component "${NAME}" via the emdesign MCP tool ` +
      `\`${op === 'create' ? 'create_component' : 'edit_component'}\` (write a CSF story too, title "Generated/${NAME}"). ` +
      (UPDATE && round === 1
        ? `Apply this change-request to the EXISTING component — modify it in place, do NOT rebuild from scratch: ${JSON.stringify(
            INSTRUCTION,
          )}.\n`
        : '') +
      `Compose primitives from "@ds", reference token roles only, obey the Anti-patterns.${COMPOSE_NOTE}\n` +
      ` TAILWIND CONFIG: tailwind.config.js maps ALL --color-* tokens to semantic classes (bg-surface, text-highlight, etc.). Use these classes INSTEAD of inline var() or arbitrary values. Use bg-highlight NOT bg-[var(--color-highlight)]. Only var(--x) for non-color tokens (--motion-fast, --focus-ring, --shadow-raised, --radius).\n` +
      `DARK MODE: If the design system has a dark theme (tokens.css has [data-theme="dark"]), generate \`dark:\` variants for every color utility.\n` +
      `NON-DETERMINISTIC CODE: NEVER use \`new Date()\`, \`Date.now()\`, \`Math.random()\`, or \`crypto.randomUUID()\` in component source. Pass dynamic values via props.\n\n` +
      `DESIGN CONTEXT:\n${brief}\n\n` +
      (feedback ? `FIX THESE (P0 first), from the previous round:\n${feedback}\n` : ''),
    { label: `build:r${round}`, phase: 'Build' },
  );

  phase('Critique');
  const [vision, llm, tokens, visual] = await parallel([
    () =>
      agent(
        `Call the emdesign MCP tool \`vision_critique\` with component="${NAME}", mode="standard". Return the visionScore + findings. Use visionScore as your vision score.`,
        { schema: VISION, label: `vision:r${round}`, phase: 'Critique' },
      ),
    () =>
      agent(`Review component "${NAME}" (slug "${SLUG}") code + spec against the design system.`, {
        agentType: 'design-reviewer',
        schema: LLM,
        label: `llm:r${round}`,
        phase: 'Critique',
      }),
    () =>
      agent(`Audit component "${NAME}" consistency (lint + graph where-to-fix).`, {
        agentType: 'consistency-auditor',
        schema: TOKENS,
        label: `tokens:r${round}`,
        phase: 'Critique',
      }),
    () =>
      agent(
        `Call the emdesign MCP tool \`run_visual_test\` for "${NAME}". Map the result: status 'pass'|'new' → visual=1.0, 'changed' → 0.5, 'error' → 0.0. Return {visual,status}.`,
        { schema: VISUAL, label: `visual:r${round}`, phase: 'Critique' },
      ),
  ]);

  const scores = {
    vision: vision && vision.visionScore,
    llm: llm && llm.llm,
    tokens: tokens && tokens.tokens,
    visual: visual && visual.visual,
  };
  const mustFix = ((vision && vision.mustFix) || 0) + ((tokens && tokens.mustFix) || 0);

  phase('Gate');
  const gate = await agent(
    `Call the emdesign MCP tool \`critique_score\` with scores=${JSON.stringify(scores)}, mustFix=${mustFix}, ` +
      `threshold=${THRESHOLD}, component="${NAME}". Then call \`record_evidence\` with slug="${SLUG}", round=${round}, ` +
      `scores=${JSON.stringify(scores)}, mustFix=${mustFix}, composite=(from the result), decision=(from the result), ` +
      `component="${NAME}". Return the critique_score JSON.`,
    { schema: GATE, label: `gate:r${round}`, phase: 'Gate' },
  );

  last = gate;
  shipped = gate && gate.decision === 'ship';
  feedback = JSON.stringify({
    vision: (vision && vision.findings) || [],
    llm: (llm && llm.findings) || [],
    tokens: (tokens && tokens.fixes) || [],
  });
  log(`round ${round}: composite=${gate && gate.composite} decision=${gate && gate.decision} mustFix=${mustFix}`);
}

return { name: NAME, slug: SLUG, shipped, rounds: round, gate: last };
