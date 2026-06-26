import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ensureDir, normalizeDsRef, type RepoPaths } from '@medesign/backend';
import type { Store } from '@medesign/backend';
import { resolveDesignSystem, composePrompt } from '@medesign/backend';
import { renderFindingsForAgent, countMustFix } from '@medesign/backend';
import { effectiveAdapter } from '@medesign/backend';
import { captureComponent } from '@medesign/backend';
import { runVisualTest, toStoryId } from '@medesign/backend';
import { findAffected, whereToFix, consistencyBrief, getContext, query } from '@medesign/graph';
import { buildAndSave, loadOrBuild, overlayGenerated } from '@medesign/backend';
import { scoreComponent } from '@medesign/backend';
import { recordEvidence } from '@medesign/backend';
import { standardCritique } from '@medesign/vision-critic';
import { createDesignSystem, scaffoldPrimitives, validateDesignSystem, listDesignSystems, listBases, applyDesignSystem } from '@medesign/backend';
import { runtimeFor } from '@medesign/backend';
import { gradeDesignSystem, renderSnapshot } from '@medesign/backend';
import type { RenderSnapshotOutput } from '@medesign/backend';

const STORYBOOK_URL = process.env.MEDESIGN_STORYBOOK_URL ?? 'http://localhost:6006';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

function activeDsId(store: Store): string {
  return store.get().activeDesignSystem ?? 'atelier';
}

function writeGenerated(paths: RepoPaths, name: string, source: string, story?: string): void {
  ensureDir(paths.generatedDir);
  const a = effectiveAdapter(paths);
  fs.writeFileSync(path.join(paths.generatedDir, `${name}${a.fileExt}`), source);
  if (story) fs.writeFileSync(path.join(paths.generatedDir, `${name}${a.storyExt}`), story);
}

function lintSource(paths: RepoPaths, store: Store, source: string) {
  const ds = resolveDesignSystem(paths, activeDsId(store));
  const findings = effectiveAdapter(paths).lint(source, {
    declaredTokens: ds.declaredTokens,
    exemptions: ds.exemptions,
    bindsDisplayFace: ds.bindsDisplayFace,
  });
  return { ds, findings, mustFix: countMustFix(findings), report: renderFindingsForAgent(findings) };
}

/** The medesign MCP server — the tool surface any agent drives the loop through. */
export function createMcpServer(store: Store, paths: RepoPaths): McpServer {
  const server = new McpServer({ name: 'medesign', version: '0.0.0' });

  server.registerTool(
    'get_design_context',
    {
      description: 'Get the active design system context (DESIGN.md + tokens + primitives + rules) to generate on-system, code-first UI.',
      inputSchema: { instruction: z.string().optional(), componentName: z.string().optional() },
    },
    async ({ instruction, componentName }) => {
      const id = activeDsId(store);
      const ds = resolveDesignSystem(paths, id);
      const name = componentName ?? 'Component';
      // Graph context: a node neighborhood if it already exists, else a build-new consistency brief.
      let graphContext: string | undefined;
      try {
        const { g } = graphWithCurrent();
        const nodeId = g.has(`art/${name}`) ? `art/${name}` : g.has(`${id}/${name}`) ? `${id}/${name}` : null;
        graphContext = JSON.stringify(
          nodeId ? getContext(g, nodeId) : consistencyBrief(g, { name, intent: instruction }),
          null,
          2,
        );
      } catch { /* graph optional */ }
      const codegenInstructions = effectiveAdapter(paths).codegenInstructions(ds);
      return text(composePrompt({ ds, componentName: name, instruction: instruction ?? '(describe the component)', graphContext, codegenInstructions }));
    },
  );

  server.registerTool(
    'create_component',
    {
      description: 'Create a generated React+Tailwind component (and its CSF story). Writes to apps/studio/src/generated/ and runs the consistency lint.',
      inputSchema: {
        name: z.string().describe('PascalCase component name'),
        source: z.string().describe('Full .tsx source; import primitives from "@ds"'),
        story: z.string().optional().describe('CSF story; title "Generated/<name>", Default export'),
      },
    },
    async ({ name, source, story }) => {
      writeGenerated(paths, name, source, story);
      const { findings, mustFix, report } = lintSource(paths, store, source);
      store.update({ currentComponent: name, lintPassing: mustFix === 0 });
      return text(`Wrote generated/${name}.tsx.\n${report}\n\nPreview: ${STORYBOOK_URL}/iframe.html?id=${toStoryId(name)}`);
    },
  );

  server.registerTool(
    'edit_component',
    {
      description: 'Replace a generated component with revised source (e.g. to fix lint findings or apply a change request).',
      inputSchema: { name: z.string(), source: z.string(), story: z.string().optional() },
    },
    async ({ name, source, story }) => {
      writeGenerated(paths, name, source, story);
      const { mustFix, report } = lintSource(paths, store, source);
      store.update({ currentComponent: name, lintPassing: mustFix === 0 });
      return text(report);
    },
  );

  server.registerTool(
    'lint_consistency',
    {
      description: 'Lint a generated component against the design system (anti-slop + token contract). Returns P0-first findings.',
      inputSchema: { name: z.string() },
    },
    async ({ name }) => {
      const src = fs.readFileSync(path.join(paths.generatedDir, `${name}.tsx`), 'utf8');
      const { mustFix, report } = lintSource(paths, store, src);
      store.update({ lintPassing: mustFix === 0 });
      return text(report);
    },
  );

  server.registerTool(
    'run_visual_test',
    {
      description: 'Screenshot the component story in Storybook and diff against the baseline. Establishes a baseline on first run.',
      inputSchema: { name: z.string() },
    },
    async ({ name }) => {
      const diff = await runVisualTest(paths, name);
      store.update({ lastDiff: diff, currentComponent: name });
      return text(`Visual test: ${diff.status}${diff.changedPixels != null ? ` (${diff.changedPixels} px changed)` : ''}.`);
    },
  );

  server.registerTool(
    'render_preview',
    { description: 'Get the Storybook preview URL for a generated component.', inputSchema: { name: z.string() } },
    async ({ name }) => text(`${STORYBOOK_URL}/iframe.html?id=${toStoryId(name)}&viewMode=story`),
  );

  server.registerTool(
    'capture_reusable_component',
    {
      description: 'Promote a generated component into a reusable, documented, git-tracked component under src/components/.',
      inputSchema: { name: z.string() },
    },
    async ({ name }) => {
      const out = await captureComponent(paths, name);
      return text(`Captured ${name} → ${out}`);
    },
  );

  server.registerTool(
    'apply_design_system',
    {
      description: 'Select the active design system and rewire the workspace: rebind tokens.css + @ds and rebuild the graph.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const r = applyDesignSystem(paths, id);
      store.update({ activeDesignSystem: id });
      return text(`Active design system → ${id}. ${r.graphRebuilt ? 'graph rebuilt; ' : ''}${r.note}`);
    },
  );

  server.registerTool(
    'create_design_system',
    {
      description: 'Create a design system. mode: blank (skeleton) | brief | extract (skeleton → author) | import (clone `from`). Scaffolds DESIGN.md + tokens.css + manifest + base primitives. For import, `from` may be a base ref from list_design_system_bases (e.g. open-design/brutalist) — the clone is re-id\'d, graph-built and validated.',
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        mode: z.enum(['blank', 'brief', 'import', 'extract']).optional(),
        from: z.string().optional().describe('for import: a design-system id or base ref (open-design/<id>) to clone; otherwise the primitives source (default atelier)'),
      },
    },
    async ({ id, name, mode, from }) => {
      const r = createDesignSystem(paths, { id, name, mode, from });
      return text(JSON.stringify(r, null, 2));
    },
  );

  server.registerTool(
    'scaffold_primitives',
    {
      description: 'Copy the base primitive set (Button/Card/Input/Badge/Heading/Stack + Showcase) into a design system, token-role-bound.',
      inputSchema: { id: z.string(), from: z.string().optional() },
    },
    async ({ id, from }) => text(scaffoldPrimitives(paths, id, from ?? 'atelier') ? `Scaffolded primitives into ${id}/code.` : `Skipped (code/ exists or source missing).`),
  );

  server.registerTool(
    'validate_design_system',
    {
      description: 'Validate a design system via the runtime: token contract + structural invariants (9 sections, required roles, var() resolution). Accepts a base ref (open-design/<id>). Returns ok + diagnostics.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => text(JSON.stringify(runtimeFor(paths).validate(normalizeDsRef(id)), null, 2)),
  );

  server.registerTool(
    'grade_design_system',
    {
      description: 'Grade a design system against the open-design quality/complexity rubric (ds doctor): token richness, type-scale depth, components-with-states, theming, doc depth, craft rules, conflicts. Returns a scorecard + letter grade + matchesGrade.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => text(JSON.stringify(await gradeDesignSystem(paths, normalizeDsRef(id)), null, 2)),
  );

  server.registerTool(
    'render_snapshot',
    {
      description: 'Capture a render-probe DOM snapshot of a generated component (light + dark themes). Returns the snapshot URL and a summary of element counts. The snapshot is persisted as <component>.render.json in the screenshots dir and can be consumed by plugin-core rendered lint rules.',
      inputSchema: { name: z.string(), themes: z.array(z.enum(['light', 'dark'])).optional().describe('Themes to capture (default ["light","dark"])') },
    },
    async ({ name, themes }) => {
      try {
        const snapshots = await renderSnapshot(paths, name, { themes: themes ?? ['light', 'dark'] });
        return text(`Captured ${snapshots.length} snapshot(s) for "${name}" (${snapshots.map((s) => s.theme).join(', ')}): ${snapshots[0]?.nodes.length ?? 0} DOM nodes extracted.`);
      } catch (e) {
        return text(`Error capturing render snapshot for "${name}": ${(e as Error).message}`);
      }
    },
  );

  server.registerTool(
    'ds_conflicts',
    {
      description: 'Detect conflicts in a design system: duplicate roles, orphan (unused) tokens, dangling theme overrides.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => text(JSON.stringify(runtimeFor(paths).conflicts(normalizeDsRef(id)), null, 2)),
  );

  server.registerTool(
    'ds_history',
    {
      description: 'Design-system history: committed snapshots + a structured diff of the working state vs the latest snapshot.',
      inputSchema: { id: z.string(), snapshot: z.boolean().optional().describe('also commit a new snapshot') },
    },
    async ({ id, snapshot }) => {
      const rt = runtimeFor(paths);
      if (snapshot) rt.snapshot(id);
      return text(JSON.stringify(rt.history(id), null, 2));
    },
  );

  server.registerTool(
    'list_design_systems',
    { description: 'List available design systems (id + name).', inputSchema: {} },
    async () => text(JSON.stringify(runtimeFor(paths).list(), null, 2)),
  );

  server.registerTool(
    'list_design_system_bases',
    {
      description:
        'List the prebuilt bases you can start a new design system FROM (vendored open-design systems). Each entry has a `ref` to pass as `from` in create_design_system mode:"import". Use this to offer a "pick a base, then customize" choice.',
      inputSchema: {},
    },
    async () => text(JSON.stringify(listBases(paths), null, 2)),
  );

  server.registerTool(
    'poll_change_request',
    {
      description: 'Fetch the next queued change request submitted from the Storybook panel (instruction to apply). Returns "(none)" if empty.',
      inputSchema: {},
    },
    async () => {
      const cr = store.nextQueued();
      if (!cr) return text('(none)');
      store.setChangeRequestStatus(cr.id, 'in_progress');
      return text(JSON.stringify({ id: cr.id, instruction: cr.instruction }));
    },
  );

  server.registerTool(
    'poll_intent',
    {
      description: 'Drain the next queued browser intent (the /mds:inbox bridge). Returns its {id, type, instruction, target, payload} and marks it in-progress; route by type to the matching /mds command. Returns "(none)" if empty.',
      inputSchema: {},
    },
    async () => {
      const cr = store.nextQueued();
      if (!cr) return text('(none)');
      store.setChangeRequestStatus(cr.id, 'in_progress');
      return text(JSON.stringify({ id: cr.id, type: cr.type ?? 'change-request', instruction: cr.instruction, target: cr.target, payload: cr.payload }));
    },
  );

  server.registerTool(
    'resolve_intent',
    {
      description: 'Mark a browser intent done (or error) after acting on it, so the panel reflects completion.',
      inputSchema: { id: z.string(), status: z.enum(['done', 'error']).optional(), note: z.string().optional() },
    },
    async ({ id, status, note }) => {
      store.setChangeRequestStatus(id, status ?? 'done', note);
      return text(`Intent ${id} → ${status ?? 'done'}.`);
    },
  );

  // ---- design-system knowledge graph ----

  /** Load/build the active DS graph and overlay the current generated component if present. */
  function graphWithCurrent() {
    const id = activeDsId(store);
    const g = loadOrBuild(paths, id);
    const current = store.get().currentComponent;
    if (current && fs.existsSync(path.join(paths.generatedDir, `${current}.tsx`))) {
      try { overlayGenerated(g, paths, id, current); } catch { /* artifact not parseable yet */ }
    }
    return { g, id };
  }

  server.registerTool(
    'graph_where_to_fix',
    {
      description: 'Given an artifact and a lint finding id, return the responsible token/spec and the exact file:line to fix.',
      inputSchema: { artifact: z.string(), findingId: z.string() },
    },
    async ({ artifact, findingId }) => {
      const { g } = graphWithCurrent();
      const res = whereToFix(g, `art/${artifact}`, findingId);
      return text(res ? JSON.stringify(res, null, 2) : `No '${findingId}' violation found on art/${artifact}.`);
    },
  );

  server.registerTool(
    'graph_find_affected',
    {
      description: 'Impact analysis: everything that transitively depends on a node (e.g. a token) — what a change would affect.',
      inputSchema: { node: z.string().describe('node id, e.g. atelier/--color-accent') },
    },
    async ({ node }) => {
      const { g } = graphWithCurrent();
      return text(JSON.stringify(findAffected(g, node), null, 2));
    },
  );

  server.registerTool(
    'graph_consistency_brief',
    {
      description: 'Build-new, on-system: composable primitives, relevant tokens, governing rules, and the vibe for a new component.',
      inputSchema: { name: z.string(), intent: z.string().optional() },
    },
    async ({ name, intent }) => {
      const { g } = graphWithCurrent();
      return text(JSON.stringify(consistencyBrief(g, { name, intent }), null, 2));
    },
  );

  server.registerTool(
    'graph_get_context',
    {
      description: 'Rich neighborhood of a node (its tokens, props, variants, stories, governing rules, spec sections).',
      inputSchema: { node: z.string() },
    },
    async ({ node }) => {
      const { g } = graphWithCurrent();
      const ctx = getContext(g, node);
      return text(ctx ? JSON.stringify(ctx, null, 2) : `Node not found: ${node}`);
    },
  );

  server.registerTool(
    'graph_query',
    {
      description: 'Generic property-filtered query. Nodes: {label, where}. Edges: {edgeLabel, from, to, where}.',
      inputSchema: {
        label: z.string().optional(),
        edgeLabel: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        where: z.record(z.unknown()).optional(),
      },
    },
    async (args) => {
      const { g } = graphWithCurrent();
      return text(JSON.stringify(query(g, args), null, 2));
    },
  );

  // ---- critique / feedback loop ----

  server.registerTool(
    'screenshot_path',
    {
      description: 'Absolute path of the latest screenshot for a component (for the vision-critic subagent to Read).',
      inputSchema: { component: z.string() },
    },
    async ({ component }) => {
      const p = path.join(paths.screenshotsDir, `${component}.actual.png`);
      return text(fs.existsSync(p) ? p : `No screenshot yet for ${component}. Run run_visual_test first.`);
    },
  );

  server.registerTool(
    'critique_score',
    {
      description: 'The authoritative quality gate. Combines feedback scores (0..1) + mustFix into a composite and decision (ship/continue), with a per-component no-regression ratchet.',
      inputSchema: {
        scores: z.object({
          visual: z.number().optional(),
          tokens: z.number().optional(),
          vision: z.number().optional(),
          llm: z.number().optional(),
          a11y: z.number().optional(),
        }),
        mustFix: z.number().int().nonnegative(),
        threshold: z.number().optional(),
        component: z.string().optional(),
      },
    },
    async ({ scores, mustFix, threshold, component }) => {
      const res = scoreComponent(paths, { scores, mustFix, threshold, component });
      // Surface the combined critique to the panel.
      store.update({ lastCritique: { scores, composite: res.composite, decision: res.decision, mustFix } });
      return text(JSON.stringify(res, null, 2));
    },
  );

  server.registerTool(
    'record_evidence',
    {
      description: 'Save a round of feedback (scores + screenshot) under design/changes/<slug>/evidence/.',
      inputSchema: {
        slug: z.string(),
        round: z.number().int(),
        scores: z.record(z.number()),
        mustFix: z.number().int(),
        composite: z.number(),
        decision: z.string(),
        component: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    async ({ slug, round, scores, mustFix, composite, decision, component, notes }) => {
      const file = recordEvidence(paths, slug, { round, scores, mustFix, composite, decision, notes }, component);
      return text(`Evidence saved: ${file}`);
    },
  );

  // ---- vision critique tools ----

  server.registerTool(
    'vision_critique',
    {
      description: 'Vision-based visual critique of a rendered component. Supports multiple LLM providers (claude, gemini, minimax) and ensemble mode. Returns per-axis scores + findings + visionScore for the critique gate.',
      inputSchema: {
        component: z.string(),
        provider: z.enum(['claude', 'gemini', 'minimax']).optional(),
        mode: z.enum(['standard', 'regression', 'reference', 'ensemble']).optional(),
        ensembleProviders: z.array(z.enum(['claude', 'gemini', 'minimax'])).optional(),
        referenceImagePath: z.string().optional(),
      },
    },
    async ({ component, provider, mode, ensembleProviders, referenceImagePath }) => {
      // Ensure a fresh screenshot before critiquing.
      try { await runVisualTest(paths, component); } catch { /* non-fatal — use existing if any */ }

      const opts = {
        component,
        mode: (mode ?? 'standard') as any,
        provider,
        referenceImagePath,
        ensemble: ensembleProviders ? { providers: ensembleProviders, strategy: 'average' as const } : undefined,
      };
      const result = await standardCritique(
        {
          root: paths.root,
          screenshotsDir: paths.screenshotsDir,
          designSystemsDir: paths.designSystemsDir,
          activeDsId: store.get().activeDesignSystem ?? undefined,
        },
        opts,
      );
      // Surface the vision score to the panel via lastCritique.
      const prev = store.get().lastCritique;
      store.update({
        lastCritique: {
          scores: { ...(prev?.scores ?? {}), vision: result.visionScore },
          composite: prev?.composite ?? 0,
          decision: prev?.decision ?? '',
          mustFix: (prev?.mustFix ?? 0) + result.mustFix,
        },
      });
      return text(JSON.stringify(result, null, 2));
    },
  );

  server.registerTool(
    'vision_compare',
    {
      description: 'Compare a rendered component screenshot against a reference image. Returns fidelity score + differences. Used in the "upload reference → analyze → implement → compare → revise" loop.',
      inputSchema: {
        component: z.string(),
        referenceImagePath: z.string(),
        provider: z.enum(['claude', 'gemini', 'minimax']).optional(),
      },
    },
    async ({ component, referenceImagePath, provider }) => {
      const result = await standardCritique(
        {
          root: paths.root,
          screenshotsDir: paths.screenshotsDir,
          designSystemsDir: paths.designSystemsDir,
          activeDsId: store.get().activeDesignSystem ?? undefined,
        },
        { component, mode: 'reference', provider, referenceImagePath },
      );
      return text(JSON.stringify(result, null, 2));
    },
  );

  server.registerTool(
    'vision_upload_reference',
    {
      description: 'Upload a reference image for comparison. Copies the image to __screenshots__/<component>.reference.png and returns the path for use with vision_compare.',
      inputSchema: {
        component: z.string(),
        imagePath: z.string().describe('Absolute path to the reference image on disk.'),
      },
    },
    async ({ component, imagePath }) => {
      if (!fs.existsSync(imagePath)) return text(`Reference image not found: ${imagePath}`);
      const dest = path.join(paths.screenshotsDir, `${component}.reference.png`);
      fs.copyFileSync(imagePath, dest);
      return text(dest);
    },
  );

  server.registerTool(
    'graph_rebuild',
    {
      description: 'Rebuild the active design system graph and write design-systems/<id>/graph.json.',
      inputSchema: { id: z.string().optional() },
    },
    async ({ id }) => {
      const dsId = id ?? activeDsId(store);
      const g = buildAndSave(paths, dsId);
      return text(`Rebuilt graph for ${dsId}: ${JSON.stringify(g.stats())}`);
    },
  );

  return server;
}
