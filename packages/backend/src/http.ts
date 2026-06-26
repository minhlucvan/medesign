import express from 'express';
import path from 'node:path';
import type { Store } from './state.js';
import type { RepoPaths } from './paths.js';
import fs from 'node:fs';
import { captureComponent } from './capture.js';
import { runVisualTest } from './visualTest.js';
import { PNG } from 'pngjs';
import { scoreComponent } from './critique/score.js';
import { standardCritique } from '@medesign/vision-critic';
import { resolveDesignSystem } from './designContext.js';
import { countMustFix } from './lint/index.js';
import { effectiveAdapter } from './adapters/index.js';
import { runtimeFor } from './runtime.js';
import { applyDesignSystem, listBases } from './scaffold.js';
import { loadOrBuild } from './graph.js';
import { evidenceDir } from './evidence.js';
import { normalizeDsRef } from './paths.js';
import type { IntentType, CommentTarget } from './state.js';

/**
 * HTTP bridge consumed by the Storybook addon panel. It reads/writes the same Store the
 * MCP tools use, so the panel reflects the agent's live progress. CORS is wide-open for
 * localhost dev only.
 */
export function createHttpBridge(store: Store, paths: RepoPaths) {
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

  app.get('/api/health', (_req, res) => {
    const s = store.get();
    res.json({
      ok: true,
      name: 'medesign',
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

  return app;
}

export function startHttpBridge(store: Store, paths: RepoPaths, port = 4321) {
  const app = createHttpBridge(store, paths);
  return app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.error(`[medesign] HTTP bridge on http://localhost:${port} (repo: ${path.basename(paths.root)})`);
  });
}
