export const meta = {
  name: 'inbox-loop',
  description:
    'Drain the browser intent queue, classify + group each intent (intent-router), then dispatch independent groups to isolated subagents IN PARALLEL — serializing/coalescing same-target work and surfacing system-level / ambiguous intents for a human gate. The optimized /mds:inbox engine.',
  phases: [{ title: 'Drain' }, { title: 'Classify' }, { title: 'Dispatch' }],
};

// args: { } — drains the whole queue once. The /mds:inbox command re-invokes until drained === 0.

// Structured-output schemas must be a top-level object, so the drained array is wrapped in `intents`.
const BATCH = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intents: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: { id: { type: 'string' }, type: { type: 'string' }, instruction: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  required: ['intents'],
};

const PLAN = {
  type: 'object',
  additionalProperties: true,
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          conflictKey: { type: 'string' },
          route: { type: 'string' },
          target: { type: ['string', 'null'] },
          intentIds: { type: 'array', items: { type: 'string' } },
          instruction: { type: 'string' },
          payload: {},
          needsHuman: { type: 'boolean' },
          confidence: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['route', 'intentIds', 'needsHuman'],
      },
    },
  },
  required: ['groups'],
};

function summarize(g, res) {
  if (res && res.gate) return `${g.route} ${g.target}: ${res.shipped ? 'gate PASS' : 'needs work'} (composite=${res.gate.composite}, rounds=${res.rounds})`;
  if (res && res.tokenContractOk !== undefined) return `system ${g.target}: tokenContractOk=${res.tokenContractOk}`;
  return `${g.route} ${g.target || ''} done`;
}

// Resolve every intent in a group via the MCP resolve_intent tool (so the panel's Activity tab updates).
async function resolveGroup(g, status, note) {
  await agent(
    `For EACH id in ${JSON.stringify(g.intentIds || [])}, call the medesign MCP tool \`resolve_intent\` with ` +
      `{ id, status: "${status}", note: ${JSON.stringify(note || '')} }. Return "ok".`,
    { label: `resolve:${g.conflictKey || status}`, phase: 'Dispatch' },
  );
}

// Run one group's work in an isolated sub-flow, then resolve its intents. Same-key intents are already
// coalesced into one group by the router, so groups never edit the same file concurrently.
async function dispatchGroup(g) {
  try {
    let res;
    if (g.route === 'craft:update') {
      res = await workflow('design-loop', { name: g.target, instruction: g.instruction, mode: 'update' });
    } else if (g.route === 'craft:component') {
      res = await workflow('design-loop', { name: g.target, instruction: g.instruction });
    } else if (g.route === 'system:create') {
      const p = g.payload || {};
      await agent(
        `Call the medesign MCP tool \`create_design_system\` with ${JSON.stringify({ id: p.id, name: p.name, mode: p.mode, from: p.from })}. Return its JSON.`,
        { label: `scaffold:${p.id || g.target}`, phase: 'Dispatch' },
      );
      res = await workflow('design-system-loop', { id: p.id, mode: p.mode, from: p.from });
    } else {
      res = { skipped: true };
    }
    const summary = summarize(g, res);
    await resolveGroup(g, 'done', summary);
    log(`done ${g.conflictKey}: ${summary}`);
    return { conflictKey: g.conflictKey, route: g.route, target: g.target, ok: true, summary };
  } catch (e) {
    const note = `dispatch failed: ${(e && e.message) || e}`;
    await resolveGroup(g, 'error', note);
    log(`ERROR ${g.conflictKey}: ${note}`);
    return { conflictKey: g.conflictKey, route: g.route, target: g.target, ok: false, error: note };
  }
}

// ── Drain ────────────────────────────────────────────────────────────────────────────────────────
phase('Drain');
const batch = await agent(
  `Drain the medesign browser intent queue: repeatedly call the MCP tool \`poll_intent\` (no arguments) until it ` +
    `returns the literal "(none)". Parse EACH returned intent JSON and collect them, preserving order. ` +
    `Return { intents: <array> } (\`{ intents: [] }\` if the very first call is "(none)").`,
  { label: 'drain', phase: 'Drain', schema: BATCH },
);
const intents = (batch && batch.intents) || [];
if (!intents.length) return { drained: 0, processed: [], surfaced: [] };

// ── Classify ─────────────────────────────────────────────────────────────────────────────────────
phase('Classify');
const plan = await agent(
  `Classify and group this drained batch of browser intents into a routing plan.\n\nBATCH:\n${JSON.stringify(intents, null, 2)}`,
  { agentType: 'intent-router', schema: PLAN, label: 'classify', phase: 'Classify' },
);
const groups = (plan && plan.groups) || [];
const auto = groups.filter((g) => !g.needsHuman && g.route !== 'skip');
const skips = groups.filter((g) => g.route === 'skip');
const surfaced = groups.filter((g) => g.needsHuman);

// ── Dispatch ─────────────────────────────────────────────────────────────────────────────────────
phase('Dispatch');
// Independent groups run concurrently; same-target intents were coalesced into a single group upstream.
const processed = await parallel(auto.map((g) => () => dispatchGroup(g)));
// Non-actionable items: close them out with a note (no work to do).
for (const g of skips) await resolveGroup(g, 'done', `No action: ${g.reason || 'non-actionable'}`);

log(`inbox: drained=${intents.length} auto=${auto.length} surfaced=${surfaced.length} skipped=${skips.length}`);
return {
  drained: intents.length,
  processed: processed.filter(Boolean),
  surfaced: surfaced.map((g) => ({
    conflictKey: g.conflictKey,
    route: g.route,
    target: g.target || null,
    intentIds: g.intentIds,
    instruction: g.instruction,
    payload: g.payload || null,
    reason: g.reason,
  })),
};
