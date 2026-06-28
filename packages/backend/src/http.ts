import express from 'express';
import multer from 'multer';
import path from 'node:path';
import type { Store } from './state.js';
import type { RepoPaths } from './paths.js';
import fs from 'node:fs';
import { captureComponent } from './capture.js';
import { runVisualTest } from './visualTest.js';
import { renderSnapshot } from './renderProbe.js';
import { PNG } from 'pngjs';
import { scoreComponent } from './critique/score.js';
import { standardCritique } from '@emdesign/vision-critic';
import { resolveDesignSystem } from './designContext.js';
import { countMustFix } from './lint/index.js';
import { effectiveAdapter } from './adapters/index.js';
import { runtimeFor } from './runtime.js';
import { applyDesignSystem, listBases, listBaseCategories, baseDetail, basePreviewHtml, customizeDesignSystem } from './scaffold.js';
import { loadOrBuild, buildAndSave } from './graph.js';
import { RULES, RULES_BY_ID } from '@emdesign/graph';
import { lintFrameworkCharters, lintDesignSystem, lintRendered, mergeReports } from '@emdesign/doctor';
import type { RenderSnapshot, RenderedReviewContext } from '@emdesign/dsr';
import { detectConflicts } from '@emdesign/dsr';
import { evidenceDir } from './evidence.js';
import { normalizeDsRef } from './paths.js';
import type { IntentType, CommentTarget, CommentStored } from './state.js';

// ── In-memory cache for /api/surface ──────────────────────────────────

// ── Pending question state for AskUserQuestion integration ──────────

interface PendingQuestionEntry {
  toolUseId: string;
  questions: Array<{
    question: string;
    header?: string;
    options: Array<{ label: string; description: string; preview?: string }>;
    multiSelect?: boolean;
  }>;
  resolve: (answer: Record<string, string | string[]>) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  createdAt: number;
  handle: { sessionId: string; sendRaw: (data: object) => Promise<void>; cancel: () => Promise<void> };
}

const pendingQuestions = new Map<string, PendingQuestionEntry>();

interface SurfaceData {
  activeComponent: string | null;
  activeStory: string | null;
  activeDesignSystem: string | null;
  viewport: { width: number; height: number } | null;
  compositionTree: string[];
  tokenUsage: Array<{ role: string; count: number }>;
  lintFindings: Array<{ ruleId: string; severity: string; message: string }>;
  lastCritique: {
    composite: number;
    decision: string;
    mustFix: number;
    scores: Record<string, number>;
  } | null;
  cachedAt: number;
}

let surfaceCache: { data: SurfaceData | null; expiresAt: number } = { data: null, expiresAt: 0 };
const SURFACE_TTL_MS = 5_000;

function computeSurface(store: Store, paths: RepoPaths): SurfaceData {
  const state = store.get();
  const ds = state.activeDesignSystem ? resolveDesignSystem(paths, state.activeDesignSystem) : null;

  // Read composition from generated components directory
  let compositionTree: string[] = [];
  try {
    if (fs.existsSync(paths.generatedDir)) {
      compositionTree = fs.readdirSync(paths.generatedDir)
        .filter((f) => f.endsWith('.tsx'))
        .map((f) => f.replace(/\.tsx$/, ''));
    }
  } catch { /* ignore */ }

  // Count token usage from generated files
  const tokenCounts = new Map<string, number>();
  for (const comp of compositionTree) {
    const src = readComponentSource(paths, comp);
    if (src) {
      // Match semantic token classes (bg-*, text-*, border-*, rounded-*, etc.)
      const tokens = src.match(/[a-z]+-(?:primary|secondary|accent|surface|muted|destructive|info|success|warning|border|background|foreground)/g);
      if (tokens) {
        for (const t of tokens) tokenCounts.set(t, (tokenCounts.get(t) || 0) + 1);
      }
    }
  }
  const tokenUsage = Array.from(tokenCounts.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  // Gather lint findings from the last lint run
  const lintFindings: Array<{ ruleId: string; severity: string; message: string }> = [];
  if (ds) {
    try {
      const lintResult = lintDesignSystem(ds, { strict: false });
      if (lintResult.failed.length) {
        for (const f of lintResult.failed) {
          lintFindings.push({
            ruleId: f.ruleId || 'lint',
            severity: f.level === 'error' ? 'P0' : 'P1',
            message: f.message,
          });
        }
      }
    } catch { /* lint may fail on incomplete DS */ }
  }

  return {
    activeComponent: state.currentComponent,
    activeStory: null,
    activeDesignSystem: state.activeDesignSystem,
    viewport: null,
    compositionTree,
    tokenUsage,
    lintFindings,
    lastCritique: state.lastCritique ? {
      composite: state.lastCritique.composite,
      decision: state.lastCritique.decision,
      mustFix: state.lastCritique.mustFix,
      scores: state.lastCritique.scores,
    } : null,
    cachedAt: Date.now(),
  };
}

/** Read a component's source from the generated dir, falling back to a captured component dir. */
function readComponentSource(paths: RepoPaths, name: string): string | null {
  if (!name) return null;
  const candidates = [
    path.join(paths.generatedDir, `${name}.tsx`),
    path.join(paths.componentsDir, name, `${name}.tsx`),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8'); } catch { /* ignore */ }
  }
  return null;
}

/**
 * HTTP bridge consumed by the Storybook addon panel. It reads/writes the same Store the
 * MCP tools use, so the panel reflects the agent's live progress. CORS is wide-open for
 * localhost dev only.
 */
export async function createHttpBridge(store: Store, paths: RepoPaths, orch?: any) {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    next();
  });
  app.options('*', (_req, res) => res.sendStatus(204));

  // Serve visual-test images so the panel can display the diff.
  app.use('/screenshots', express.static(paths.screenshotsDir));

  app.get('/api/surface', (_req, res) => {
    const now = Date.now();
    if (surfaceCache.data && now < surfaceCache.expiresAt) {
      res.json(surfaceCache.data);
      return;
    }
    surfaceCache.data = computeSurface(store, paths);
    surfaceCache.expiresAt = now + SURFACE_TTL_MS;
    res.json(surfaceCache.data);
  });

  app.get('/api/health', (_req, res) => {
    const s = store.get();
    res.json({
      ok: true,
      name: 'emdesign',
      version: '0.0.0',
      activeDesignSystem: s.activeDesignSystem,
      currentComponent: s.currentComponent,
      lintPassing: s.lintPassing,
      paths: { root: paths.root, designSystems: paths.designSystemsDir, generated: paths.generatedDir },
    });
  });

  app.get('/api/state', (_req, res) => res.json(store.get()));

  // Prebuilt bases to clone-and-customize (the Create wizard's base picker). Vendored under _vendor/.
  app.get('/api/bases', (_req, res) => {
    try {
      res.json({ bases: listBases(paths) });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Base categories with counts (for the catalog filter pills).
  app.get('/api/bases/categories', (_req, res) => {
    try { res.json({ categories: listBaseCategories(paths) }); }
    catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // Full base detail (tokens, fonts, accent color, preview availability).
  app.get('/api/bases/:id/detail', (req, res) => {
    try {
      const detail = baseDetail(paths, req.params.id);
      if (!detail) return res.status(404).json({ error: `Base '${req.params.id}' not found.` });
      res.json(detail);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // Token palette only (lighter weight than full detail).
  app.get('/api/bases/:id/tokens', (req, res) => {
    try {
      const detail = baseDetail(paths, req.params.id);
      if (!detail) return res.status(404).json({ error: `Base '${req.params.id}' not found.` });
      res.json({ id: detail.id, tokens: detail.tokens });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // Serve reference-example.html with optional CSS override query params.
  app.get('/api/bases/:id/preview', (req, res) => {
    try {
      const overrides: Record<string, string> = {};
      for (const [key, val] of Object.entries(req.query)) {
        if (key !== 'id' && typeof val === 'string') overrides[key] = val;
      }
      const html = basePreviewHtml(paths, req.params.id, overrides);
      if (!html) return res.status(404).json({ error: `No preview available for '${req.params.id}'.` });
      res.type('html').send(html);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // Customize a base and create a new design system.
  app.post('/api/design-systems/customize', (req, res) => {
    try {
      const { baseRef, id, name, customizations } = req.body;
      if (!baseRef || !id) return res.status(400).json({ error: 'baseRef and id are required.' });
      const result = customizeDesignSystem(paths, { baseRef, id, name: name ?? id, customizations: customizations ?? {} });
      const apply = applyDesignSystem(paths, id);
      res.json({ ...result, apply });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // Programmatic/rule feedback for a generated component (used by the CLI + lint gate).
  app.post('/api/lint', (req, res) => {
    const name = String(req.body?.component ?? store.get().currentComponent ?? '').trim();
    const dsId = store.get().activeDesignSystem ?? 'atelier';
    try {
      const source = fs.readFileSync(path.join(paths.generatedDir, `${name}.tsx`), 'utf8');
      const ds = resolveDesignSystem(paths, dsId);
      const findings = effectiveAdapter(paths).lint(source, {
        declaredTokens: ds.declaredTokens,
        exemptions: ds.exemptions,
        bindsDisplayFace: ds.bindsDisplayFace,
      });
      res.json({ component: name, mustFix: countMustFix(findings), findings });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Unified "Charter contract" for a component, spanning three tiers:
  //   core (engine lint + system invariants) · designSystem (Element Charters) · component (story charters).
  // The addon's Charters panel posts the component name + a live DOM snapshot; story-charter
  // results are merged in client-side (tier `component` is returned empty here).
  app.post('/api/charters', async (req, res) => {
    const name = String(req.body?.component ?? store.get().currentComponent ?? '').trim();
    const dsId = store.get().activeDesignSystem ?? 'atelier';
    const render = req.body?.render;

    type TierItem = { id: string; title: string; severity: 'P0' | 'P1' | 'P2'; pass: boolean; message?: string; fix?: string; target?: string };
    const core: TierItem[] = [];
    const designSystem: TierItem[] = [];

    // ── Tier 1: core engine rules ──────────────────────────────────────────
    try {
      const ds = resolveDesignSystem(paths, dsId);
      // Component anti-slop + token lint (generated or captured source).
      const source = readComponentSource(paths, name);
      const findings = source
        ? effectiveAdapter(paths).lint(source, {
            declaredTokens: ds.declaredTokens,
            exemptions: ds.exemptions,
            bindsDisplayFace: ds.bindsDisplayFace,
          })
        : [];
      const byId = new Map(findings.map((f) => [f.id, f]));
      // The full rule catalog — every rule shown pass/fail (the "contract").
      for (const rule of RULES) {
        const hit = byId.get(rule.id);
        core.push({
          id: rule.id,
          title: rule.id,
          severity: rule.severity,
          pass: !hit,
          message: hit ? hit.message : rule.message,
          fix: hit?.fix ?? rule.remediation.text,
          target: hit?.snippet,
        });
      }
      // Findings whose id isn't in the catalog (keep nothing hidden).
      for (const f of findings) {
        if (!RULES_BY_ID[f.id]) {
          core.push({ id: f.id, title: f.id, severity: f.severity, pass: false, message: f.message, fix: f.fix, target: f.snippet });
        }
      }
      // System invariants (token contract + structural) — failures only.
      const sys = runtimeFor(paths).validate(dsId);
      for (const d of sys.diagnostics) {
        core.push({ id: d.ruleId, title: d.ruleId, severity: d.severity, pass: false, message: d.message, fix: d.fix, target: d.target });
      }
      if (!source) {
        core.push({ id: 'source', title: 'component-source', severity: 'P2', pass: false, message: `No source found for "${name}" in generated/ or components/.` });
      }
    } catch (e) {
      core.push({ id: 'core-error', title: 'core', severity: 'P2', pass: false, message: (e as Error).message });
    }

    // ── Tier 2: design-system Element Charters ─────────────────────────────
    try {
      const rt = runtimeFor(paths);
      await rt.loadCharters(dsId);
      const catalog = rt.listCharters(); // full set (name, severity, description, layer)
      const { charters } = rt.evaluateCharters(dsId, render ? [render] : undefined);
      // Group findings by charter name (ruleId === `ec/<name>/<finding.id>`).
      const byCharter = new Map<string, typeof charters>();
      for (const d of charters) {
        const charterName = d.ruleId.split('/')[1] ?? d.ruleId;
        const list = byCharter.get(charterName);
        if (list) list.push(d);
        else byCharter.set(charterName, [d]);
      }
      for (const c of catalog) {
        const hits = byCharter.get(c.name) ?? [];
        if (hits.length === 0) {
          designSystem.push({ id: c.name, title: c.name, severity: c.severity as TierItem['severity'], pass: true, message: c.description });
        } else {
          for (const d of hits) {
            designSystem.push({
              id: d.ruleId,
              title: c.name,
              severity: d.severity,
              pass: false,
              message: d.message.replace(/^\[EC:[^\]]+\]\s*/, ''),
              fix: d.fix,
              target: d.target,
            });
          }
        }
      }
    } catch (e) {
      designSystem.push({ id: 'ds-error', title: 'design-system', severity: 'P2', pass: false, message: (e as Error).message });
    }

    // ── Auto-capture render snapshot if not provided ──────────────────────
    let _render = render;
    if (!_render && name) {
      try {
        const snaps = await renderSnapshot(paths, name, { story: 'default', themes: ['light'] });
        if (snaps.length > 0) {
          _render = {
            root: snaps[0].root,
            nodes: snaps[0].nodes,
          };
        }
      } catch {
        // non-fatal — render-dependent tiers simply won't have data
      }
    }

    // ── Framework-level geometry charters (always-on) ────────────────────────
    try {
      if (_render && _render.nodes && _render.nodes.length > 0) {
        const snap: RenderSnapshot = {
          component: name,
          storyId: String(req.body?.storyId ?? ''),
          url: '',
          theme: 'light',
          viewport: { width: 0, height: 0, deviceScaleFactor: 1 },
          root: _render.root ?? { x: 0, y: 0, width: 0, height: 0 },
          nodes: _render.nodes,
        };
        const fwReport = lintFrameworkCharters('framework', [snap]);
        for (const f of fwReport.findings) {
          core.push({ id: f.ruleId, title: f.ruleId, severity: f.severity, pass: false, message: f.detail ?? f.title, fix: f.fix, target: f.target });
        }
        for (const f of fwReport.passes) {
          core.push({ id: f.ruleId, title: f.ruleId, severity: 'P2' as const, pass: true, message: f.detail ?? f.title });
        }
      }
    } catch {
      // non-fatal — framework charters are advisory
    }

    // ── Tier 3: Doctor rules (production-readiness) ─────────────────────────
    const doctor: TierItem[] = [];
    try {
      buildAndSave(paths, dsId);
      const ds = runtimeFor(paths).load(dsId);
      const conflicts = detectConflicts(ds);
      const stats = ds.graph.stats();
      const adapter = effectiveAdapter(paths);
      const dr = adapter.doctorRules();
      if (dr.length > 0) {
        const report = lintDesignSystem(`${dsId}/doctor`, { ds, conflicts, stats }, dr);
        for (const f of report.findings) {
          doctor.push({ id: f.ruleId, title: f.title, severity: f.severity as TierItem['severity'], pass: false, message: f.detail, fix: f.fix, target: f.target });
        }
        for (const f of report.passes) {
          doctor.push({ id: f.ruleId, title: f.title, severity: f.severity as TierItem['severity'], pass: true, message: f.detail, fix: f.fix, target: f.target });
        }
      }
    } catch (e) {
      doctor.push({ id: 'doctor-error', title: 'doctor', severity: 'P2', pass: false, message: (e as Error).message });
    }

    // ── Tier 4: Rendered DOM rules (requires render snapshot) ──────────────
    const rendered: TierItem[] = [];
    try {
      if (_render && _render.nodes && _render.nodes.length > 0) {
        const adapter = effectiveAdapter(paths);
        const renderedRules = adapter.renderedDoctorRules();
        if (renderedRules.length > 0) {
          const ds = runtimeFor(paths).load(dsId);
          const snap: RenderSnapshot = {
            component: name,
            storyId: String(req.body?.storyId ?? ''),
            url: '',
            theme: 'light',
            viewport: { width: 0, height: 0, deviceScaleFactor: 1 },
            root: _render.root ?? { x: 0, y: 0, width: 0, height: 0 },
            nodes: _render.nodes,
          };
          const rctx: RenderedReviewContext = { ds, renders: [snap] };
          const rr = lintRendered(`${dsId}/rendered`, rctx, renderedRules);
          for (const f of rr.findings) {
            rendered.push({ id: f.ruleId, title: f.title, severity: f.severity as TierItem['severity'], pass: false, message: f.detail, fix: f.fix, target: f.target });
          }
          for (const f of rr.passes) {
            rendered.push({ id: f.ruleId, title: f.title, severity: f.severity as TierItem['severity'], pass: true, message: f.detail });
          }
        }
      }
    } catch {
      // non-fatal — rendered rules are advisory
    }

    const renderViewport = _render && _render.nodes && _render.nodes.length > 0
      ? { width: 1280, height: 720 }
      : undefined;
    surfaceCache.expiresAt = 0; // charters eval = state refresh → invalidate surface cache
    res.json({ component: name, dsId, renderViewport, tiers: { core, doctor, rendered, designSystem, component: [] } });
  });

  // The authoritative gate (used by the CLI + the loop).
  app.post('/api/score', (req, res) => {
    try {
      const input = req.body ?? {};
      const r = scoreComponent(paths, input);
      store.update({ lastCritique: { scores: input.scores ?? {}, composite: r.composite, decision: r.decision, mustFix: input.mustFix ?? 0 } });
      res.json(r);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get('/api/screenshot-path', (req, res) => {
    const component = String(req.query.component ?? '');
    const p = path.join(paths.screenshotsDir, `${component}.actual.png`);
    res.json({ path: fs.existsSync(p) ? p : null });
  });

  app.post('/api/change-request', (req, res) => {
    const instruction = String(req.body?.instruction ?? '').trim();
    if (!instruction) return res.status(400).json({ error: 'instruction required' });
    store.enqueueChangeRequest(instruction);
    res.json(store.get());
  });

  // Typed intent from the browser (comment / create-component / create-design-system / …).
  // The agent drains these via the `poll_intent` MCP tool (`/mds:inbox`).
  app.post('/api/intent', (req, res) => {
    const type = String(req.body?.type ?? 'change-request') as IntentType;
    const instruction = String(req.body?.instruction ?? '').trim();
    if (!instruction) return res.status(400).json({ error: 'instruction required' });
    store.enqueueIntent({ type, instruction, target: req.body?.target as CommentTarget | undefined, payload: req.body?.payload });
    surfaceCache.expiresAt = 0; // invalidate surface cache
    res.json(store.get());
  });

  // Design-system management (read + switch) — for the panel's System tab.
  app.get('/api/design-systems', (_req, res) => {
    try {
      res.json({ active: store.get().activeDesignSystem, systems: runtimeFor(paths).list() });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get('/api/design-system/:id', (req, res) => {
    try {
      const rt = runtimeFor(paths);
      const ds = rt.load(req.params.id);
      const tokens = ds.tokens().map((t) => ({ role: t.role, kind: t.kind, value: t.value }));
      res.json({
        id: ds.id,
        name: ds.name,
        tokens,
        components: ds.components().map((c) => c.name),
        sections: ds.sections().map((s) => s.title),
        validation: rt.validate(req.params.id),
        conflicts: rt.conflicts(req.params.id).length,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Rich design-system detail for the Design System tab: full conflicts + manifest + raw source.
  app.get('/api/design-system/:id/full', (req, res) => {
    try {
      const rt = runtimeFor(paths);
      const id = req.params.id;
      const ds = rt.load(id);
      const dir = path.join(paths.designSystemsDir, ...normalizeDsRef(id).split('/'));
      const read = (f: string) => {
        try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return ''; }
      };
      let manifest: unknown = null;
      try { manifest = JSON.parse(read('manifest.json') || '{}'); } catch { manifest = null; }
      res.json({
        id: ds.id,
        name: ds.name,
        tokens: ds.tokens().map((t) => ({ role: t.role, kind: t.kind, value: t.value })),
        components: ds.components().map((c) => c.name),
        sections: ds.sections().map((s) => s.title),
        validation: rt.validate(id),
        conflicts: rt.conflicts(id),
        manifest,
        designMd: read('DESIGN.md'),
        tokensCss: read('tokens.css'),
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Knowledge-graph stats for a design system (System tab).
  app.get('/api/graph/:id/stats', (req, res) => {
    try {
      res.json({ id: req.params.id, stats: loadOrBuild(paths, req.params.id).stats() });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Recent design-loop evidence rounds + the live activity queue (System tab's logs).
  app.get('/api/logs', (_req, res) => {
    const rounds: Array<{ slug: string; round: number; scores: Record<string, number>; mustFix: number; composite: number; decision: string; mtime: number }> = [];
    try {
      const changesDir = path.join(paths.root, 'design', 'changes');
      for (const slug of fs.existsSync(changesDir) ? fs.readdirSync(changesDir) : []) {
        const dir = evidenceDir(paths, slug);
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir)) {
          if (!/^round-\d+\.json$/.test(f)) continue;
          try {
            const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
            rounds.push({ slug, round: r.round, scores: r.scores ?? {}, mustFix: r.mustFix ?? 0, composite: r.composite ?? 0, decision: r.decision ?? '', mtime: fs.statSync(path.join(dir, f)).mtimeMs });
          } catch { /* skip malformed */ }
        }
      }
    } catch { /* no evidence yet */ }
    rounds.sort((a, b) => b.mtime - a.mtime);
    res.json({ rounds: rounds.slice(0, 40), activity: store.get().changeRequests });
  });

  // Switch the active design system (deterministic; no agent needed).
  app.post('/api/use', (req, res) => {
    const id = String(req.body?.id ?? '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
      const r = applyDesignSystem(paths, id);
      store.update({ activeDesignSystem: id });
      res.json(r);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Crop the latest screenshot to a pointed-at element's box (for the comment overlay preview).
  app.post('/api/element-crop', (req, res) => {
    const component = String(req.body?.component ?? store.get().currentComponent ?? '').trim();
    const box = req.body?.box as { x: number; y: number; width: number; height: number } | undefined;
    const scale = Number(req.body?.scale ?? 2); // run_visual_test uses deviceScaleFactor: 2
    const src = path.join(paths.screenshotsDir, `${component}.actual.png`);
    if (!box || !fs.existsSync(src)) return res.json({ url: null });
    try {
      const img = PNG.sync.read(fs.readFileSync(src));
      const x = Math.max(0, Math.round(box.x * scale));
      const y = Math.max(0, Math.round(box.y * scale));
      const w = Math.min(img.width - x, Math.round(box.width * scale));
      const h = Math.min(img.height - y, Math.round(box.height * scale));
      if (w <= 0 || h <= 0) return res.json({ url: null });
      const crop = new PNG({ width: w, height: h });
      PNG.bitblt(img, crop, x, y, w, h, 0, 0);
      const outName = `${component}.crop.png`;
      fs.writeFileSync(path.join(paths.screenshotsDir, outName), PNG.sync.write(crop));
      res.json({ url: `${req.protocol}://${req.get('host')}/screenshots/${outName}` });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post('/api/capture', async (req, res) => {
    const name = String(req.body?.name ?? store.get().currentComponent ?? '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
      const out = await captureComponent(paths, name);
      res.json({ ok: true, path: out });
    } catch (e) {
      res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });

  app.post('/api/visual-test', async (req, res) => {
    const component = String(req.body?.component ?? store.get().currentComponent ?? '').trim();
    try {
      const diff = await runVisualTest(paths, component);
      res.json(store.update({ lastDiff: diff }));
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ---- file upload ----
  const uploadDir = path.join(paths.root, 'uploads');
  const upload = multer({ dest: uploadDir });
  app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'no file provided' });
    // Multer saves to uploadDir with a random filename. Keep original name.
    const ext = path.extname(req.file.originalname);
    const saved = path.join(uploadDir, `${req.file.filename}${ext}`);
    fs.renameSync(req.file.path, saved);
    res.json({
      ok: true,
      path: saved,
      originalName: req.file.originalname,
      size: req.file.size,
      url: `/api/uploads/${path.basename(saved)}`,
    });
  });
  // Serve uploaded files
  app.use('/api/uploads', express.static(uploadDir));

  // ---- vision critique endpoints ----

  app.post('/api/vision-critique', async (req, res) => {
    try {
      const component = String(req.body?.component ?? store.get().currentComponent ?? '').trim();
      const result = await standardCritique(
        {
          root: paths.root,
          screenshotsDir: paths.screenshotsDir,
          designSystemsDir: paths.designSystemsDir,
          activeDsId: store.get().activeDesignSystem ?? undefined,
        },
        { component, provider: req.body?.provider, mode: req.body?.mode },
      );
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post('/api/vision-compare', async (req, res) => {
    try {
      const component = String(req.body?.component ?? store.get().currentComponent ?? '').trim();
      const result = await standardCritique(
        {
          root: paths.root,
          screenshotsDir: paths.screenshotsDir,
          designSystemsDir: paths.designSystemsDir,
          activeDsId: store.get().activeDesignSystem ?? undefined,
        },
        { component, mode: 'reference', provider: req.body?.provider, referenceImagePath: req.body?.referenceImagePath },
      );
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ---- comment pins (persist across story reloads) ----
  app.post('/api/comments', (req, res) => {
    const { storyId, selector, text, tag, component, sessionId } = req.body;
    if (!storyId || !sessionId) return res.status(400).json({ error: 'storyId and sessionId required' });
    const state = store.get();
    const pins = state.comments[storyId] || [];
    const pin: CommentStored = { n: pins.length + 1, selector, text: text || '', tag, component, storyId, sessionId, createdAt: new Date().toISOString() };
    pins.push(pin);
    store.update({ comments: { ...state.comments, [storyId]: pins } });
    res.json({ ok: true, pin });
  });

  app.get('/api/comments', (req, res) => {
    const storyId = req.query.storyId as string;
    if (!storyId) return res.status(400).json({ error: 'storyId query param required' });
    const state = store.get();
    res.json({ pins: state.comments[storyId] || [] });
  });

  // ---- question answer endpoints (AskUserQuestion integration) ----
  app.post('/api/chat/answer', (req, res) => {
    const { sessionId, answers } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    if (!answers) return res.status(400).json({ error: 'answers required' });
    const entry = pendingQuestions.get(sessionId);
    if (!entry) return res.status(404).json({ error: 'No pending question for this session' });
    clearTimeout(entry.timeout);
    pendingQuestions.delete(sessionId);
    entry.resolve(answers);
    res.json({ ok: true });
  });

  app.post('/api/chat/answer/cancel', (req, res) => {
    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const entry = pendingQuestions.get(sessionId);
    if (!entry) return res.status(404).json({ error: 'No pending question for this session' });
    clearTimeout(entry.timeout);
    pendingQuestions.delete(sessionId);
    entry.reject(new Error('Cancelled'));
    res.json({ ok: true });
  });

  // ---- chat stream (SSE) ----
  app.post('/api/chat/stream', async (req, res) => {
    const message = String(req.body?.message ?? '').trim();
    if (!message) return res.status(400).json({ error: 'message required' });
    const interactive = !!req.body?.interactive;
    const sessionIdHint = String(req.body?.sessionId ?? '').trim() || `chat_${Date.now()}`;
    const intentType = String(req.body?.intentType ?? '').trim() || 'chat';

    // Build context from current state
    const state = store.get();
    let dsContext = '';
    if (state.activeDesignSystem) {
      try {
        const ds = resolveDesignSystem(paths, state.activeDesignSystem);
        const excerpt = ds.designMd.slice(0, 1000);
        const tokens = ds.declaredTokens.slice(0, 20).join(', ');
        dsContext = `\n\nActive design system: ${ds.name}\nDesign principles: ${excerpt.substring(0, 300)}\nKey tokens: ${tokens}`;
      } catch {}
    }

    // Build system prompt with context
    const systemPrompt = `You are emdesign's design engineer, connected to a live Storybook instance.${dsContext}\n\nAvailable commands: /mds:craft:component (build component), /mds:craft:update (edit component), /mds:system:update (edit tokens), /mds:review (audit component), emdesign generate, emdesign doctor.`;
    const enrichedMessage = message; // Context is in system prompt, not appended to message

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    try {
      const { AgentRunner } = await import('@emdesign/session');
      const { claudeAdapter } = await import('@emdesign/backend');
      const runner = new AgentRunner();

      // System context first, then user message
      const fullPrompt = systemPrompt + '\n\n## User request\n' + enrichedMessage;
      const handle = await runner.spawn({
        def: claudeAdapter,
        cwd: paths.root,
        prompt: fullPrompt,
        permissionMode: interactive ? 'interactive' : undefined,
        allowedDirs: [paths.root],
      });

      let questionDetected = false;

      // Cancel if client disconnects; clean up any pending question
      req.on('close', () => {
        const entry = pendingQuestions.get(sessionIdHint);
        if (entry) {
          clearTimeout(entry.timeout);
          pendingQuestions.delete(sessionIdHint);
          entry.reject(new Error('Stream closed'));
        }
        handle.cancel().catch(() => {});
      });

      handle.onLog((line) => {
        try {
          const ev = JSON.parse(line);
          if (ev.type === 'assistant' && ev.message?.content) {
            for (const block of ev.message.content) {
              if (block.type === 'text' && block.text) {
                res.write(`data: ${JSON.stringify({ type: 'text', text: block.text })}\n\n`);
              }
            }
          } else if (ev.type === 'error') {
            res.write(`data: ${JSON.stringify({ type: 'error', error: ev.error?.message || JSON.stringify(ev) })}\n\n`);
          }
        } catch { /* non-JSON line */ }
      });

      const { exitCode, text } = await handle.waitForExit();
      res.write(`data: ${JSON.stringify({ type: 'done', exitCode, finalText: text?.slice(0, 500) })}\n\n`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[emdesign] Chat stream error:', msg);
      try { res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`); } catch {}
    }
    res.end();
  });

  // Mount session/service routes if orchestrator is provided
  if (orch) {
    try {
      // Dynamic import to avoid hard dependency on @emdesign/session
      const { createSessionRouter } = await import('@emdesign/session');
      const router = createSessionRouter(orch);
      app.use('/api', router);
    } catch {
      // @emdesign/session not available — skip session routes
    }
  }

  return app;
}

export async function startHttpBridge(store: Store, paths: RepoPaths, port = 4321, orch?: any) {
  const app = await createHttpBridge(store, paths, orch);
  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.error(`[emdesign] HTTP bridge on http://localhost:${port} (repo: ${path.basename(paths.root)})`);
  });
  return server;
}
