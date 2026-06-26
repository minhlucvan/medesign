export const meta = {
  name: 'design-system-loop',
  description:
    'Create/update a design system: author the 9-section DESIGN.md + tokens.css → validate the token contract (loop until clean) → scaffold base primitives → rebuild the graph.',
  phases: [{ title: 'Author' }, { title: 'Validate' }, { title: 'Primitives' }, { title: 'Index' }],
};

// args: { id, mode?, brief?, from?, maxRounds? }
const ID = (args && args.id) || 'design-system';
const MODE = (args && args.mode) || 'blank';
const BRIEF = (args && args.brief) || '';
const MAX = (args && args.maxRounds) || 3;

const VALIDATE = {
  type: 'object',
  additionalProperties: true,
  properties: { ok: { type: 'boolean' }, missingRoles: { type: 'array' } },
  required: ['ok'],
};

phase('Author');
if (MODE === 'brief' || MODE === 'extract') {
  await agent(
    `Author the design system "${ID}" to the medesign quality bar (docs/spec.md + docs/authoring-design-systems.md). ` +
      `Source: ${MODE}${BRIEF ? ` — ${JSON.stringify(BRIEF)}` : ''}. ` +
      `Edit design-systems/${ID}/DESIGN.md (fill all 9 sections with EXACT values, semantic role names, and real anti-patterns) ` +
      `and re-value design-systems/${ID}/tokens.css for every required role. Use the design-system-author skill` +
      (MODE === 'extract' ? ' and brand-extract (read any provided reference images)' : '') +
      `. Token roles only; no off-system values.`,
    { agentType: 'design-reviewer', label: 'author', phase: 'Author' },
  );
} else {
  log(`mode=${MODE}: using scaffold/clone as-is (no authoring round).`);
}

phase('Validate');
let ok = false;
for (let round = 1; round <= MAX && !ok; round++) {
  const v = await agent(
    `Call the medesign MCP tool \`validate_design_system\` with id="${ID}". If not ok, EDIT design-systems/${ID}/tokens.css ` +
      `to declare every missing role (sensible on-brand values), then return the latest validate result.`,
    { schema: VALIDATE, label: `validate:r${round}`, phase: 'Validate' },
  );
  ok = !!(v && v.ok);
  log(`validate round ${round}: ok=${ok}${v && v.missingRoles && v.missingRoles.length ? ` missing=${v.missingRoles.join(',')}` : ''}`);
}

phase('Primitives');
await agent(
  `Ensure base primitives exist for "${ID}": call the medesign MCP tool \`scaffold_primitives\` with id="${ID}" ` +
    `(it skips if code/ already exists). Report what happened.`,
  { label: 'primitives', phase: 'Primitives' },
);

phase('Index');
await agent(
  `Rebuild the knowledge graph for "${ID}": call the medesign MCP tool \`graph_rebuild\` with id="${ID}". Report stats.`,
  { label: 'graph', phase: 'Index' },
);

return { id: ID, mode: MODE, tokenContractOk: ok };
