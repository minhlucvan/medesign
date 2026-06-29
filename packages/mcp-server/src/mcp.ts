import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ensureDir,
  normalizeDsRef,
  type RepoPaths,
  resolveDesignSystem,
  composePrompt,
  renderFindingsForAgent,
  countMustFix,
  tokenScore,
  collectScores,
  effectiveAdapter,
  captureComponent,
  captureWithBaseline,
  runVisualTest,
  toStoryId,
  buildAndSave,
  loadOrBuild,
  overlayGenerated,
  scoreComponent,
  recordEvidence,
  createDesignSystem,
  scaffoldPrimitives,
  validateDesignSystem,
  listDesignSystems,
  listBases,
  runtimeFor,
  gradeDesignSystem,
  renderSnapshot,
  spatialAudit,
  extractProject,
  adoptProject,
} from '@emdesign/backend';
import type { Store } from '@emdesign/backend';
import { findAffected, whereToFix, consistencyBrief, getContext, query } from '@emdesign/graph';
import { standardCritique } from '@emdesign/vision-critic';
import { listAllStories, fetchStorybookIndex, parseCsfTitle } from './storybookCompat.js';

const STORYBOOK_URL = process.env.EMDESIGN_STORYBOOK_URL ?? 'http://localhost:6006';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

function writeGenerated(paths: RepoPaths, name: string, source: string, story?: string): void {
  ensureDir(paths.generatedDir);
  const a = effectiveAdapter(paths);
  fs.writeFileSync(path.join(paths.generatedDir, `${name}${a.fileExt}`), source);
  if (story) fs.writeFileSync(path.join(paths.generatedDir, `${name}${a.storyExt}`), story);
}

function lintSource(paths: RepoPaths, store: Store, source: string) {
  const ds = resolveDesignSystem(paths, paths.activeDesignSystem);
  const findings = effectiveAdapter(paths).lint(source, {
    declaredTokens: ds.declaredTokens,
    exemptions: ds.exemptions,
    bindsDisplayFace: ds.bindsDisplayFace,
  });
  return { ds, findings, mustFix: countMustFix(findings), report: renderFindingsForAgent(findings) };
}

function graphWithCurrent(store: Store, paths: RepoPaths) {
  const id = paths.activeDesignSystem;
  const g = loadOrBuild(paths, id);
  const current = store.get().currentComponent;
  if (current && fs.existsSync(path.join(paths.generatedDir, `${current}.tsx`))) {
    try { overlayGenerated(g, paths, id, current); } catch { /* artifact not parseable yet */ }
  }
  return { g, id };
}

/** ── 13 tools consolidated from 38 ──────────────────────────────── */

export async function createMcpServer(store: Store, paths: RepoPaths, _orch?: any): Promise<McpServer> {
  const server = new McpServer({ name: 'emdesign', version: '0.0.0' });

  // ── 1. Design context ──────────────────────────────────────────
  server.registerTool('get_design_context', {
    description: 'Understand the active design system before creating a component. Returns the DESIGN.md contract, available tokens, primitives, codegen rules, and anti-patterns. Call this FIRST — it tells you what tokens to use, what primitives exist, and what NOT to do.',
    inputSchema: {
      componentName: z.string().optional().describe('The component you intend to build, for contextual guidance'),
      instruction: z.string().optional().describe('What the component should do, for tailored context'),
    },
  }, async ({ instruction, componentName }) => {
    const id = paths.activeDesignSystem;
    const ds = resolveDesignSystem(paths, id);
    const name = componentName ?? 'Component';
    let graphContext: string | undefined;
    try {
      const { g } = graphWithCurrent(store, paths);
      const nodeId = g.has(`art/${name}`) ? `art/${name}` : g.has(`${id}/${name}`) ? `${id}/${name}` : null;
      graphContext = JSON.stringify(
        nodeId ? getContext(g, nodeId) : consistencyBrief(g, { name, intent: instruction }),
        null, 2,
      );
    } catch { /* graph optional */ }
    const codegenInstructions = effectiveAdapter(paths).codegenInstructions(ds);
    return text(composePrompt({ ds, componentName: name, instruction: instruction ?? '(describe the component)', graphContext, codegenInstructions }));
  });

  // ── 2. Generate / edit component ─────────────────────────────
  server.registerTool('generate_component', {
    description: 'Create a NEW component or EDIT an existing one. Writes the .tsx source (+ optional CSF story) to the generated directory, then automatically runs the consistency lint. Use `get_design_context` FIRST to understand the design system, then pass the source here.',
    inputSchema: {
      mode: z.enum(['create', 'edit']).describe('"create" for a brand-new component, "edit" to revise an existing one'),
      name: z.string().describe('PascalCase component name (e.g. "UserAvatar")'),
      source: z.string().describe('Full .tsx source. Import primitives from "@ds" (e.g. `import { Button } from "@ds/Button"`). Use semantic tokens only — no raw hex colors.'),
      story: z.string().optional().describe('CSF story file content. Title format: "Generated/<Name>". Include Default export + variant exports.'),
    },
  }, async ({ mode, name, source, story }) => {
    writeGenerated(paths, name, source, story);
    const { findings, mustFix, report } = lintSource(paths, store, source);
    store.update({ currentComponent: name, lintPassing: mustFix === 0 });
    const previewUrl = `${STORYBOOK_URL}/iframe.html?id=${toStoryId(name)}&viewMode=story`;
    return text(`${mode === 'create' ? 'Created' : 'Updated'} ${name}.\n${report}\n\nPreview: ${previewUrl}`);
  });

  // ── 3. Test component ────────────────────────────────────────
  server.registerTool('test_component', {
    description: 'Run visual diffs (pixelmatch screenshot vs baseline), interaction tests, and/or render-probe DOM snapshots for a component. Also returns the preview URL. Use to catch regressions before capturing.',
    inputSchema: {
      component: z.string().describe('Component name (PascalCase)'),
      tests: z.array(z.enum(['visual', 'snapshot'])).optional().describe('Which tests to run. Default: ["visual"]'),
    },
  }, async ({ component, tests }) => {
    const kinds = tests ?? ['visual'];
    const results: Record<string, unknown> = { component, preview: `${STORYBOOK_URL}/iframe.html?id=${toStoryId(component)}&viewMode=story` };

    if (kinds.includes('visual')) {
      try {
        const diff = await runVisualTest(paths, component);
        results.visual = { status: diff.status, changedPixels: diff.changedPixels, screenshotPath: diff.actualPng };
        store.update({ lastDiff: diff, currentComponent: component });
      } catch (e) {
        results.visual = { status: 'error', error: (e as Error).message };
      }
    }
    if (kinds.includes('snapshot')) {
      try {
        const snapshots = await renderSnapshot(paths, component, { themes: ['light', 'dark'] });
        results.snapshot = { count: snapshots.length, themes: snapshots.map(s => s.theme), nodes: snapshots[0]?.nodes.length ?? 0 };
      } catch (e) {
        results.snapshot = { error: (e as Error).message };
      }
    }
    return text(JSON.stringify(results, null, 2));
  });

  // ── 4. Lint component ────────────────────────────────────────
  server.registerTool('lint_component', {
    description: 'Check a generated component for design-system consistency: token binding compliance, anti-slop rules, and code conventions. Returns P0 (blocker) findings first and a numeric tokens score (0–1) for the critique gate. Use during iteration to catch issues early.',
    inputSchema: { name: z.string().describe('Component name (PascalCase)') },
  }, async ({ name }) => {
    const src = fs.readFileSync(path.join(paths.generatedDir, `${name}.tsx`), 'utf8');
    const { findings, mustFix, report } = lintSource(paths, store, src);
    const tScore = tokenScore(findings);
    store.update({ lintPassing: mustFix === 0 });
    return text(JSON.stringify({ report, mustFix, tokenScore: tScore, findings: findings.length }, null, 2));
  });

  // ── 5. Evaluate quality ──────────────────────────────────────
  server.registerTool('evaluate_component', {
    description: 'Run the full quality gate on a component. Combines all feedback scores into a composite with a ship/revise decision. Ships only when composite >= threshold AND mustFix === 0 AND every source score >= its floor. Returns unsatisfiedConditions listing what failed for targeted fixing. When `scores` is omitted, auto-collects lint + visual scores via ScoreCollector.',
    inputSchema: {
      component: z.string().optional().describe('Component name (for auto-collect source path and per-component ratchet tracking)'),
      scores: z.object({
        visual: z.number().optional(),
        tokens: z.number().optional(),
        vision: z.number().optional(),
        llm: z.number().optional(),
        a11y: z.number().optional(),
      }).optional().describe('Feedback scores (0–1). If omitted, auto-collects lint + visual scores via ScoreCollector.'),
      mustFix: z.number().int().nonnegative().optional().describe('Number of blocking (P0) issues. If omitted when scoring is omitted, extracted from auto-collect lint.'),
      threshold: z.number().optional().describe('Minimum composite to ship. Default: 0.8'),
      sourceFloors: z.object({
        visual: z.number().optional(),
        tokens: z.number().optional(),
        vision: z.number().optional(),
        llm: z.number().optional(),
        a11y: z.number().optional(),
      }).optional().describe('Per-source minimum floors. Default: vision 0.7, llm 0.7, tokens 0.8, visual 0.85, a11y 0.8'),
      evidenceSlug: z.string().optional().describe('If set, also persist this round as evidence under design/changes/<slug>/'),
    },
  }, async ({ component, scores, mustFix, threshold, sourceFloors, evidenceSlug }) => {
    // Auto-collect scores when the agent doesn't supply them
    let finalScores = scores ?? {};
    let finalMustFix = mustFix ?? 0;
    if (!scores && component) {
      const srcPath = path.join(paths.generatedDir, `${component}.tsx`);
      let source: string | undefined;
      try { source = fs.readFileSync(srcPath, 'utf8'); } catch { /* not generated yet */ }
      const ds = resolveDesignSystem(paths, paths.activeDesignSystem);
      const collected = await collectScores(paths, {
        component,
        source,
        lintOpts: {
          declaredTokens: ds.declaredTokens,
          exemptions: ds.exemptions,
          bindsDisplayFace: ds.bindsDisplayFace,
        },
        runVisual: true,
      });
      finalScores = collected.scores;
      finalMustFix = collected.mustFix;
      if (collected.errors.length > 0) {
        // Non-fatal — still gate with what we have
      }
    }
    const res = scoreComponent(paths, { scores: finalScores, mustFix: finalMustFix, threshold, sourceFloors, component });
    store.update({ lastCritique: { scores: finalScores, composite: res.composite, decision: res.decision, mustFix: finalMustFix } });
    let evidence = '';
    if (evidenceSlug) {
      const file = recordEvidence(paths, evidenceSlug, {
        round: 1, scores: finalScores, mustFix: finalMustFix, composite: res.composite, decision: res.decision, notes: undefined,
      }, component);
      evidence = `\nEvidence saved: ${file}`;
    }
    return text(JSON.stringify(res, null, 2) + evidence);
  });

  // ── 6. Manage design system ──────────────────────────────────
  server.registerTool('manage_design_system', {
    description: 'Unified tool for all design system operations: create, validate, grade, scaffold, conflicts, history, or list. The workspace has a single active DS configured in emdesign.config.json.',
    inputSchema: {
      action: z.enum(['create', 'validate', 'grade', 'scaffold', 'conflicts', 'history', 'list', 'list_bases'])
        .describe('What to do: create (new DS), apply (switch active), validate (check contract), grade (quality score), scaffold (copy primitives), conflicts (find issues), history (snapshots), list (available DS), list_bases (prebuilt templates)'),
      id: z.string().optional().describe('Design system ID (required for create)'),
      name: z.string().optional().describe('Display name (for create)'),
      mode: z.enum(['blank', 'brief', 'import', 'extract']).optional().describe('Creation mode (for create)'),
      from: z.string().optional().describe('Source base/template (for create/import or scaffold)'),
      snapshot: z.boolean().optional().describe('Also commit a new snapshot (for history)'),
    },
  }, async ({ action, id, name, mode, from, snapshot }) => {
    switch (action) {
      case 'create':
        if (!id) return text('id is required for create');
        return text(JSON.stringify(createDesignSystem(paths, { id, name, mode, from }), null, 2));
      case 'validate':
        return text(JSON.stringify(runtimeFor(paths).validate(normalizeDsRef(paths.activeDesignSystem)), null, 2));
      case 'grade':
        return text(JSON.stringify(await gradeDesignSystem(paths, normalizeDsRef(paths.activeDesignSystem)), null, 2));
      case 'scaffold':
        return text(scaffoldPrimitives(paths, paths.activeDesignSystem, from) ? `Scaffolded primitives.` : 'Skipped.');
      case 'conflicts':
        return text(JSON.stringify(runtimeFor(paths).conflicts(normalizeDsRef(paths.activeDesignSystem)), null, 2));
      case 'history': {
        const rt = runtimeFor(paths);
        if (snapshot) rt.snapshot(paths.activeDesignSystem);
        return text(JSON.stringify(rt.history(paths.activeDesignSystem), null, 2));
      }
      case 'list':
        return text(JSON.stringify(runtimeFor(paths).list(), null, 2));
      case 'list_bases':
        return text(JSON.stringify(listBases(paths), null, 2));
      default:
        return text(`Unknown action: ${action}`);
    }
  });

  // ── 7. Query knowledge graph ─────────────────────────────────
  server.registerTool('query_knowledge_graph', {
    description: 'Query the design system knowledge graph. Use `where_to_fix` to trace a lint finding to its source token/file, `impact` to see what a change would break, `context` to explore a node\'s neighborhood, `build_guidance` for guidance on a new component, or `query` for a generic property-filtered search.',
    inputSchema: {
      mode: z.enum(['where_to_fix', 'impact', 'context', 'build_guidance', 'query'])
        .describe('Query mode'),
      artifact: z.string().optional().describe('Component/artifact name (for where_to_fix)'),
      findingId: z.string().optional().describe('Lint finding ID (for where_to_fix)'),
      node: z.string().optional().describe('Graph node ID (for impact, context)'),
      name: z.string().optional().describe('New component name (for build_guidance)'),
      intent: z.string().optional().describe('Component intent (for build_guidance)'),
      label: z.string().optional().describe('Node label filter (for query)'),
      edgeLabel: z.string().optional().describe('Edge label filter (for query)'),
      from: z.string().optional().describe('Source node (for query)'),
      to: z.string().optional().describe('Target node (for query)'),
      where: z.record(z.unknown()).optional().describe('Property filter (for query)'),
    },
  }, async (args) => {
    const { g } = graphWithCurrent(store, paths);
    switch (args.mode) {
      case 'where_to_fix': {
        if (!args.artifact || !args.findingId) return text('artifact and findingId required');
        const res = whereToFix(g, `art/${args.artifact}`, args.findingId);
        return text(res ? JSON.stringify(res, null, 2) : `No '${args.findingId}' violation on art/${args.artifact}.`);
      }
      case 'impact': {
        if (!args.node) return text('node required');
        return text(JSON.stringify(findAffected(g, args.node), null, 2));
      }
      case 'context': {
        if (!args.node) return text('node required');
        const ctx = getContext(g, args.node);
        return text(ctx ? JSON.stringify(ctx, null, 2) : `Node not found: ${args.node}`);
      }
      case 'build_guidance':
        return text(JSON.stringify(consistencyBrief(g, { name: args.name ?? 'Component', intent: args.intent }), null, 2));
      case 'query':
        return text(JSON.stringify(query(g, { label: args.label, edgeLabel: args.edgeLabel, from: args.from, to: args.to, where: args.where }), null, 2));
      default:
        return text(`Unknown mode: ${args.mode}`);
    }
  });

  // ── 8. Rebuild graph ─────────────────────────────────────────
  server.registerTool('rebuild_graph', {
    description: 'Rebuild the design system knowledge graph from scratch. Run after adding new components, tokens, or primitives. Shows graph statistics (nodes, edges, artifacts).',
    inputSchema: {},
  }, async () => {
    const g = buildAndSave(paths, dsId);
    return text(`Rebuilt graph: ${JSON.stringify(g.stats())}`);
  });

  // ── 9. Vision review ─────────────────────────────────────────
  server.registerTool('vision_review', {
    description: 'Run a vision-based visual critique on a rendered component using an LLM (Claude, Gemini, or Minimax). Modes: `critique` (standard review), `compare` (vs a reference image), `upload_reference` (upload a reference image for future comparisons).',
    inputSchema: {
      mode: z.enum(['critique', 'compare', 'upload_reference']).describe('What to do'),
      component: z.string().describe('Component name'),
      provider: z.enum(['claude', 'gemini', 'minimax']).optional().describe('LLM provider (default: claude)'),
      referenceImagePath: z.string().optional().describe('Path to reference image (for compare mode, or path to upload for upload_reference)'),
      ensembleProviders: z.array(z.enum(['claude', 'gemini', 'minimax'])).optional().describe('Providers for ensemble mode'),
    },
  }, async ({ mode, component, provider, referenceImagePath, ensembleProviders }) => {
    if (mode === 'upload_reference') {
      if (!referenceImagePath) return text('referenceImagePath required for upload_reference');
      if (!fs.existsSync(referenceImagePath)) return text(`File not found: ${referenceImagePath}`);
      const dest = path.join(paths.screenshotsDir, `${component}.reference.png`);
      fs.copyFileSync(referenceImagePath, dest);
      return text(dest);
    }
    // Ensure a fresh screenshot before critiquing.
    try { await runVisualTest(paths, component); } catch { /* non-fatal */ }
    const critiqueMode = mode === 'compare' ? 'reference' as const : 'standard' as const;
    const result = await standardCritique(
      { root: paths.root, screenshotsDir: paths.screenshotsDir, designSystemsDir: paths.designSystemsDir, activeDsId: paths.activeDesignSystem },
      {
        component,
        mode: critiqueMode,
        provider,
        referenceImagePath: mode === 'compare' ? referenceImagePath : undefined,
        ensemble: ensembleProviders ? { providers: ensembleProviders, strategy: 'average' as const } : undefined,
      },
    );
    const prev = store.get().lastCritique;
    store.update({ lastCritique: { scores: { ...(prev?.scores ?? {}), vision: result.visionScore }, composite: prev?.composite ?? 0, decision: prev?.decision ?? '', mustFix: (prev?.mustFix ?? 0) + result.mustFix } });
    return text(JSON.stringify(result, null, 2));
  });

  // ── 10. Handle change requests ───────────────────────────────
  server.registerTool('handle_change_request', {
    description: 'Process the Storybook panel change-request queue. `poll` drains the next request and marks it in-progress. `resolve` marks it done/error. `changed_stories` shows which story files have changed since the last git commit. Use in a loop: poll → work → resolve.',
    inputSchema: {
      action: z.enum(['poll', 'resolve', 'changed_stories']).describe('What to do'),
      id: z.string().optional().describe('Request ID (required for resolve)'),
      status: z.enum(['done', 'error']).optional().describe('Resolution status (for resolve)'),
      note: z.string().optional().describe('Resolution note (for resolve)'),
      since: z.string().optional().describe('Git ref to check (for changed_stories, default: HEAD~1)'),
    },
  }, async ({ action, id, status, note, since }) => {
    switch (action) {
      case 'poll': {
        const cr = store.nextQueued();
        if (!cr) return text('(none)');
        store.setChangeRequestStatus(cr.id, 'in_progress');
        return text(JSON.stringify({ id: cr.id, type: cr.type ?? 'change-request', instruction: cr.instruction, target: cr.target, payload: cr.payload }));
      }
      case 'resolve': {
        if (!id) return text('id required for resolve');
        store.setChangeRequestStatus(id, status ?? 'done', note);
        return text(`Intent ${id} → ${status ?? 'done'}.`);
      }
      case 'changed_stories': {
        try {
          const ref = since ?? 'HEAD~1';
          const stdout = execSync(`git diff --name-only ${ref} -- '*.stories.*' 2>/dev/null || true`, { encoding: 'utf8', timeout: 5000 });
          const files = stdout.trim().split('\n').filter(Boolean);
          return text(files.length ? JSON.stringify(files, null, 2) : 'No changed story files.');
        } catch {
          return text('Could not check git diff.');
        }
      }
      default:
        return text(`Unknown action: ${action}`);
    }
  });

  // ── 11. Discover components ──────────────────────────────────
  server.registerTool('discover_components', {
    description: 'Discover available components, stories, design systems, and their preview URLs. Use to understand what already exists before creating new components. Reads from Storybook index.json (richest) or falls back to filesystem scan.',
    inputSchema: {
      source: z.enum(['generated', 'components', 'primitives', 'all', 'design_systems']).optional().describe('What to list. Default: all stories'),
      filter: z.string().optional().describe('Text search to filter results by name/title'),
    },
  }, async ({ source, filter }) => {
    if (source === 'design_systems') {
      const systems = runtimeFor(paths).list();
      return text(JSON.stringify(systems, null, 2));
    }
    // Try Storybook index.json first
    const sbEntries = await fetchStorybookIndex(STORYBOOK_URL);
    let entries;
    if (sbEntries) {
      entries = sbEntries;
      if (source && source !== 'all') {
        const prefix = source === 'primitives' ? 'design-systems-' : `${source}-`;
        entries = entries.filter(e => e.id.startsWith(prefix));
      }
    } else {
      const all = listAllStories(paths);
      entries = all.map(e => ({ id: e.id, title: e.title, name: e.name, kind: e.kind }));
      if (source && source !== 'all') entries = entries.filter(e => e.kind === source);
    }
    if (filter) {
      const f = filter.toLowerCase();
      entries = entries.filter(e => e.id.toLowerCase().includes(f) || e.title?.toLowerCase().includes(f));
    }
    // Attach preview URLs
    const withUrls = (entries as any[]).map(e => ({
      ...e,
      previewUrl: `${STORYBOOK_URL}/iframe.html?id=${e.id}&viewMode=story`,
    }));
    return text(JSON.stringify(withUrls, null, 2));
  });

  // ── 12. Component documentation ──────────────────────────────
  server.registerTool('get_component_documentation', {
    description: 'Get comprehensive documentation for a component or specific story. Returns design system context, DESIGN.md excerpts, knowledge graph node info, story metadata, and the preview URL. Use to understand a component before editing or reusing.',
    inputSchema: {
      target: z.string().describe('Component name (PascalCase) or story ID (e.g. "generated-button--default")'),
    },
  }, async ({ target }) => {
    const id = paths.activeDesignSystem;
    const ds = resolveDesignSystem(paths, id);
    const isStoryId = target.includes('--');
    const name = isStoryId ? target.split('--')[0]!.replace(/^(generated|components)-/i, '') : target.replace(/^generated-/i, '');

    let result: Record<string, unknown> = {
      component: name,
      designSystem: { id: ds.name ?? id, tokens: ds.declaredTokens?.length ?? 0, primitives: ds.primitives ?? [] },
      previewUrl: `${STORYBOOK_URL}/iframe.html?id=${toStoryId(name)}&viewMode=story`,
    };

    // DESIGN.md excerpt
    result.designMd = ds.designMd.slice(0, 1500) + (ds.designMd.length > 1500 ? '\n...(truncated)...' : '');

    // Knowledge graph context
    try {
      const { g } = graphWithCurrent(store, paths);
      const nodeId = g.has(`art/${name}`) ? `art/${name}` : null;
      if (nodeId) result.graphContext = getContext(g, nodeId);
    } catch { /* graph optional */ }

    // Story file metadata
    const storyFile = path.join(paths.generatedDir, `${name}${effectiveAdapter(paths).storyExt}`);
    if (fs.existsSync(storyFile)) {
      const source = fs.readFileSync(storyFile, 'utf8');
      const { title, exports: storyExports } = parseCsfTitle(source);
      result.story = { title, exports: storyExports };
    }

    // Story-specific details
    if (isStoryId) {
      const storyName = target.split('--')[1] ?? 'default';
      result.storyDetail = { storyId: target, storyName };
      const source = fs.existsSync(storyFile) ? fs.readFileSync(storyFile, 'utf8') : '';
      result.storyDetail = { ...result.storyDetail as any, hasInteractionTest: source.includes('play(') || source.includes('.play(') };
    }

    return text(JSON.stringify(result, null, 2));
  });

  // ── 13. Capture component ────────────────────────────────────
  server.registerTool('capture_component', {
    description: 'Promote a generated component into a reusable, documented, git-tracked component under src/components/. Run after the component passes evaluation (evaluate_component returns "ship"). This is the final step in the build loop.',
    inputSchema: { name: z.string().describe('Component name (PascalCase)') },
  }, async ({ name }) => {
    const out = await captureComponent(paths, name);
    return text(`Captured ${name} → ${out}`);
  });

  // ── 14. Capture component with baseline ──────────────────────
  server.registerTool('capture_component_with_baseline', {
    description: 'Atomic capture + visual baseline seeding. Promotes a generated component into a reusable, documented component AND takes a Playwright screenshot of its story as the visual baseline for future regression tests. Use instead of capture_component for production pipelines.',
    inputSchema: { name: z.string().describe('Component name (PascalCase)') },
  }, async ({ name }) => {
    const out = await captureWithBaseline(paths, name);
    return text(`Captured ${name} → ${out.componentDir}\nBaseline: ${out.baselinePath || '(no story — baseline skipped)'}`);
  });

  // ── 15. Capture baseline ─────────────────────────────────────
  server.registerTool('capture_baseline', {
    description: 'Seed a visual baseline for an already-captured component. Takes a Playwright screenshot of the component story and saves it as the baseline for future visual diffs. Useful when a component was captured before baseline support existed.',
    inputSchema: { name: z.string().describe('Component name (PascalCase)') },
  }, async ({ name }) => {
    const a = effectiveAdapter(paths);
    const safe = name.replace(/[^A-Za-z0-9]/g, '');
    const pascal = safe[0].toUpperCase() + safe.slice(1);
    const storyFile = path.join(paths.componentsDir, pascal, `${pascal}${a.storyExt}`);
    const fallbackStory = path.join(paths.generatedDir, `${pascal}${a.storyExt}`);

    if (!fs.existsSync(storyFile) && !fs.existsSync(fallbackStory)) {
      return text(`No story file found for ${name}. Cannot seed baseline.`);
    }

    const storyId = toStoryId(pascal, 'default', 'components');
    const url = `${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`;

    ensureDir(paths.screenshotsDir);
    const baselinePath = path.join(paths.screenshotsDir, `${pascal}.baseline.png`);

    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ deviceScaleFactor: 2 });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForSelector('#storybook-root', { timeout: 10_000 });
      await page.locator('#storybook-root').screenshot({ path: baselinePath });
    } finally {
      await browser.close();
    }
    return text(`Baseline seeded for ${name} → ${baselinePath}`);
  });

  // ── 16. Spatial audit (geometry charters) ──────────────────
  server.registerTool('spatial_audit', {
    description: 'Run framework-level geometry charters against a component\'s rendered DOM snapshot. Checks for element overlap (siblings intersecting) and child-overflows-parent. Returns structured findings with bounding-box coordinates, pixel measurements, and fix guidance — deterministic spatial feedback for the design loop, no screenshot needed.',
    inputSchema: {
      component: z.string().describe('Component name (PascalCase)'),
      story: z.string().optional().describe('Story name (default: "default")'),
      theme: z.enum(['light', 'dark']).optional().describe('Theme to render (default: light)'),
    },
  }, async ({ component, story, theme }) => {
    try {
      const result = await spatialAudit(paths, component, {
        story: story ?? undefined,
        themes: theme ? [theme] : ['light'],
      });
      return text(JSON.stringify(result, null, 2));
    } catch (err) {
      return text(`spatial_audit failed for "${component}": ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // ── 17. Evaluate story charters ────────────────────────────
  server.registerTool('evaluate_story_charters', {
    description: 'Evaluate all story-level charters defined on a component\'s CSF stories. Returns pass/fail for each charter, suitable for agent self-check before capture. Chartiers are assertions defined inline in CSF with `charters: [...]`.',
    inputSchema: {
      component: z.string().describe('Component name (PascalCase) — reads charters from the generated story file'),
      story: z.string().optional().describe('Specific story to evaluate (default: evaluates all stories in the CSF file)'),
    },
  }, async ({ component, story }) => {
    const a = effectiveAdapter(paths);
    const storyFile = path.join(paths.generatedDir, `${component}${a.storyExt}`);
    if (!fs.existsSync(storyFile)) {
      return text(`No story file found for "${component}" at ${storyFile}`);
    }
    const source = fs.readFileSync(storyFile, 'utf8');

    // Parse charters from the CSF source.
    // CSF charters are attached as `charters: [...]` on the default export (meta) or named exports (stories).
    // We look for `charters:` in the source and attempt to match component/story blocks.
    // NOTE: Full CSF parsing requires a JS parser — this is a best-effort heuristic.
    const lines = source.split('\n');
    const chartersFound: string[] = [];
    let inMeta = false;
    for (const line of lines) {
      const tr = line.trim();
      if (tr.startsWith('export default') || tr.startsWith('const meta')) inMeta = true;
      else if (tr.startsWith('export const')) inMeta = false;
      if (tr.includes('charters:') || tr.includes('charters :')) {
        chartersFound.push(`${inMeta ? 'meta/component' : 'story'}: ${tr.slice(0, 80)}`);
      }
    }

    const rendered = await import('@emdesign/dsr/charters/runner');
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const results: any[] = [];
    try {
      const page = await browser.newPage({ deviceScaleFactor: 2 });
      const baseUrl = paths.storybookUrl || process.env.EMDESIGN_STORYBOOK_URL || 'http://localhost:6006';
      const storyId = toStoryId(component, story ?? 'default');
      const url = `${baseUrl}/iframe.html?id=${storyId}&viewMode=story`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForSelector('#storybook-root', { timeout: 10_000 });
      await page.waitForTimeout(300);

      // Evaluate charters from the window.__EMDESIGN_CHARTERS__ global set by the preview decorator
      const charterResult = await page.evaluate(() => {
        const w = window as any;
        return w.__EMDESIGN_CHARTERS__?.lastResult ?? null;
      });
      if (charterResult) {
        results.push(charterResult);
      } else {
        // Fallback: charters not available — report what was found
      }
    } finally {
      await browser.close();
    }

    return text(JSON.stringify({
      component,
      story: story ?? 'all',
      chartersFound: chartersFound.length > 0 ? chartersFound : undefined,
      results,
      note: chartersFound.length === 0
        ? 'No charters found in CSF. Add `charters: [...]` to your story definition.'
        : results.length === 0
          ? 'Charters found in CSF but no results from preview. Ensure the charterDecorator is registered in .storybook/preview.ts'
          : undefined,
    }, null, 2));
  });

  // ── 17. Generate Tailwind config ─────────────────────────────
  server.registerTool('generate_tailwind_config', {
    description: 'Generate tailwind.config.js from the active design system\'s token contract. Parses ALL --color-* roles from tokens.css (not just a hardcoded subset) and emits dark: variant support when [data-theme="dark"] is present. Call after applying a design system.',
    inputSchema: {
      id: z.string().optional().describe('Design system ID (defaults to active)'),
    },
  }, async ({ id }) => {
    const dsId = id ?? paths.activeDesignSystem;
    const ds = resolveDesignSystem(paths, dsId);
    const adapter = effectiveAdapter(paths);
    const [file] = adapter.emitConfig(ds, paths);
    if (file) {
      fs.writeFileSync(path.join(paths.root, file.path), file.content);
      const hasDark = /\[data-theme\s*=\s*"dark"\]/.test(ds.tokensCss);
      const colorCount = ds.declaredTokens.filter((t) => t.startsWith('color-')).length;
      return text(`Wrote ${file.path} (${colorCount} color roles${hasDark ? ', dark mode enabled' : ''}).`);
    }
    return text('No config to generate.');
  });

  // ── 18. Analyze an existing project (ds-from-project) ────────
  server.registerTool('analyze_project', {
    description: 'Analyze an existing project to mine its design decisions. Returns a structured (machine-readable) extraction: raw observations with file:line provenance, proposed semantic token roles with confidence scores + supporting evidence, and tailwind/CSS conflicts. Use this to understand a project before adopting its components.',
    inputSchema: {
      path: z.string().describe('Absolute path to the project root to analyze'),
    },
  }, async ({ path: projectPath }) => {
    return text(JSON.stringify(extractProject(projectPath), null, 2));
  });

  // ── 19. Adopt components from an existing project ────────────
  server.registerTool('adopt_components', {
    description: 'Bring an existing project\'s components under emdesign management: place them, rebind unambiguous hardcoded values to semantic token roles, generate missing stories, and classify each as loop-ready or needs-manual-fix. Returns the structured adoption report. mode="run" writes files; mode="preview" (default) computes the same report without writing.',
    inputSchema: {
      path: z.string().describe('Absolute path to the source project to adopt components from'),
      mode: z.enum(['run', 'preview']).optional().describe('"run" performs adoption (writes placed components + stories); "preview" computes the report without writing. Defaults to "preview".'),
    },
  }, async ({ path: projectPath, mode }) => {
    const extraction = extractProject(projectPath);
    // Declared tokens come from the active design system when present; otherwise
    // fall back to the proposed roles so the readiness check still has a vocabulary.
    let declaredTokens: string[];
    try {
      declaredTokens = resolveDesignSystem(paths, paths.activeDesignSystem).declaredTokens;
    } catch {
      declaredTokens = extraction.proposedRoles.map((r) => r.role);
    }

    const run = (componentsDir: string) =>
      adoptProject({ projectRoot: projectPath, componentsDir, proposedRoles: extraction.proposedRoles, declaredTokens });

    if ((mode ?? 'preview') === 'run') {
      return text(JSON.stringify(run(paths.componentsDir), null, 2));
    }
    // Preview: adopt into a throwaway dir so the workspace is never written to.
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'emdesign-adopt-preview-'));
    try {
      return text(JSON.stringify(run(scratch), null, 2));
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });

  // Register session management tools if orchestrator is provided
  if (_orch) {
    try {
      const { registerSessionMcpTools } = await import('@emdesign/session');
      registerSessionMcpTools(server, _orch);
    } catch { /* @emdesign/session not available */ }
  }

  return server;
}
