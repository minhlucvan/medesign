#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  resolveRepoPaths,
  type RepoPaths,
  Store,
  createHttpBridge,
  startHttpBridge,
  resolveDesignSystem,
  composePrompt,
  countMustFix,
  renderFindingsForAgent,
  runVisualTest,
  renderSnapshot,
  captureComponent,
  scoreComponent,
  buildAndSave,
  effectiveAdapter,
  availablePlugins,
  createDesignSystem,
  listDesignSystems,
  listBases,
  applyDesignSystem,
  runtimeFor,
  normalizeDsRef,
} from '@emdesign/backend';
import { createMcpServer, createMcpHttpRouter } from '@emdesign/mcp-server';
import { standardCritique } from '@emdesign/vision-critic';

const PORT = Number(process.env.EMDESIGN_PORT ?? 4321);
const BASE = process.env.EMDESIGN_BACKEND_URL ?? `http://localhost:${PORT}`;

/**
 * emdesign CLI — the client the agent (and workspace commands/gates) invoke.
 *
 *   serve | mcp | use <id> | graph build <id>          (server / one-shot)
 *   init <framework> [dir] | attach [dir]              (opt-in workspace install)
 *   design-context [component] [instruction]           (compose the agent prompt)
 *   lint <component>            exit 1 if any P0 (gate)
 *   visual-test <component>     exit 1 on 'changed' (gate)
 *   score '<json>'              { scores, mustFix, ... } -> gate decision
 *   frameworks | capture <component>
 *
 * Stateful commands prefer a RUNNING SERVER (HTTP) when one is up; otherwise they embed the
 * @emdesign/backend engine for a stateless one-shot.
 */
async function serverUp(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(600) });
    return r.ok;
  } catch {
    return false;
  }
}

async function post(route: string, body: unknown): Promise<any> {
  const r = await fetch(`${BASE}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${route} ${r.status}: ${await r.text()}`);
  return r.json();
}

function out(v: unknown): void {
  process.stdout.write(typeof v === 'string' ? v + '\n' : JSON.stringify(v, null, 2) + '\n');
}

function activeDs(store: Store): string {
  return store.get().activeDesignSystem ?? 'atelier';
}

async function lint(paths: RepoPaths, store: Store, component: string) {
  if (await serverUp()) return post('/api/lint', { component });
  const ds = resolveDesignSystem(paths, activeDs(store));
  const ext = effectiveAdapter(paths).fileExt;
  const source = fs.readFileSync(path.join(paths.generatedDir, `${component}${ext}`), 'utf8');
  const findings = effectiveAdapter(paths).lint(source, {
    declaredTokens: ds.declaredTokens,
    exemptions: ds.exemptions,
    bindsDisplayFace: ds.bindsDisplayFace,
  });
  return { component, mustFix: countMustFix(findings), findings };
}

async function main() {
  const argv = process.argv.slice(2);
  const [cmd = 'serve', a1, a2, a3] = argv;
  const paths = resolveRepoPaths(process.cwd());
  const store = new Store(paths);

  switch (cmd) {
    case 'mcp': {
      (await createMcpServer(store, paths)).connect(new StdioServerTransport());
      console.error('[emdesign] MCP server ready on stdio.');
      break;
    }
    case 'serve': {
      if (!store.get().activeDesignSystem) store.update({ activeDesignSystem: 'atelier' });
      // Create platform orchestrator and mount session/service routes if available
      let orch: any;
      try {
        const { PlatformManager } = await import('@emdesign/session');
        orch = new PlatformManager(paths);
      } catch { /* session package not available — proceed without orchestrator */ }

      const app = await createHttpBridge(store, paths, orch);
      // Mount MCP over HTTP so any MCP-capable agent can connect via http://localhost:4321/mcp
      try {
        const mcpRouter = await createMcpHttpRouter({ store, paths });
        app.use(mcpRouter);
        console.error(`[emdesign] MCP HTTP endpoint at http://localhost:${PORT}/mcp`);
      } catch (e) {
        console.error('[emdesign] Could not mount MCP HTTP transport:', e);
      }
      const server = app.listen(PORT, () => {
        console.error(`[emdesign] Server running on http://localhost:${PORT}`);
      });
      // Attach WebSocket and health checks if orchestrator available
      if (orch) {
        try {
          const { attachWebSocket } = await import('@emdesign/session');
          attachWebSocket(server as any, orch.bus);
        } catch { /* ws not supported */ }
        orch.services.startHealthChecks();
      }
      break;
    }
    case 'use': {
      if (!a1) throw new Error('usage: emdesign use <design-system-id>');
      resolveDesignSystem(paths, a1);
      store.update({ activeDesignSystem: a1 });
      console.error(`[emdesign] active design system → ${a1}`);
      break;
    }
    case 'graph': {
      if (a1 !== 'build') throw new Error('usage: emdesign graph build <id>');
      const g = buildAndSave(paths, a2 ?? activeDs(store));
      console.error(`[emdesign] graph: ${JSON.stringify(g.stats())}`);
      break;
    }
    case 'ds': {
      // emdesign ds create <id> [mode] [from] | use <id> | validate <id> | bases | list
      switch (a1) {
        case 'create': {
          if (!a2) throw new Error('usage: emdesign ds create <id> [blank|brief|import|extract] [from]');
          out(createDesignSystem(paths, { id: a2, mode: (a3 as any) ?? 'blank', from: argv[4] }));
          break;
        }
        case 'bases': {
          out(listBases(paths));
          break;
        }
        case 'use': {
          if (!a2) throw new Error('usage: emdesign ds use <id>');
          const r = applyDesignSystem(paths, a2);
          store.update({ activeDesignSystem: a2 });
          out(r);
          break;
        }
        case 'validate': {
          if (!a2) throw new Error('usage: emdesign ds validate <id|open-design/base>');
          const r = runtimeFor(paths).validate(normalizeDsRef(a2));
          out(r);
          if (!r.ok) process.exit(1); // gate
          break;
        }
        case 'conflicts': {
          if (!a2) throw new Error('usage: emdesign ds conflicts <id>');
          out(runtimeFor(paths).conflicts(a2));
          break;
        }
        case 'doctor': {
          if (!a2) throw new Error('usage: emdesign ds doctor <id> [--gate]');
          const { gradeDesignSystem, renderGrade } = await import('@emdesign/backend');
          const r = await gradeDesignSystem(paths, a2);
          out(renderGrade(r));
          if (argv.includes('--gate') && !r.matchesGrade) process.exit(1); // gate: exit code = verdict
          break;
        }
        case 'history': {
          if (!a2) throw new Error('usage: emdesign ds history <id> [--snapshot]');
          const rt = runtimeFor(paths);
          if (a3 === '--snapshot') rt.snapshot(a2);
          out(rt.history(a2));
          break;
        }
        case 'list':
        default:
          out(listDesignSystems(paths));
      }
      break;
    }
    case 'frameworks': {
      const { availableFrameworks } = await import('@emdesign/backend');
      out(availableFrameworks());
      break;
    }
    case 'plugins': {
      out(availablePlugins());
      break;
    }
    case 'init': {
      if (!a1) throw new Error('usage: emdesign init <framework> [dir]');
      const { init } = await import('@emdesign/workspace');
      const r = init(a1, path.resolve(a2 ?? '.'));
      out({ framework: r.framework, filesWritten: r.wrote.length, notes: r.notes });
      break;
    }
    case 'attach': {
      const { attach } = await import('@emdesign/workspace');
      const r = attach(path.resolve(a1 ?? '.'));
      out({ framework: r.framework, filesWritten: r.wrote.length, notes: r.notes });
      break;
    }
    case 'update': {
      const { update } = await import('@emdesign/workspace');
      const dirArg = a1 && !a1.startsWith('--') ? a1 : undefined;
      const flags = new Set(argv.filter(a => a.startsWith('--')));
      const result = update({
        targetDir: dirArg ? path.resolve(dirArg) : undefined,
        force: flags.has('--force'),
        prune: flags.has('--prune'),
        dryRun: flags.has('--dry-run'),
        checkStorybook: flags.has('--storybook'),
      });
      if (result.added.length)   out({ added: result.added });
      if (result.updated.length) out({ updated: result.updated });
      for (const s of result.skipped) out({ skipped: s });
      if (result.removed.length) out({ removed: result.removed });
      for (const n of result.notes) out({ note: n });
      if (!result.added.length && !result.updated.length && !result.removed.length && !result.skipped.length)
        out({ ok: 'Workspace is up to date with the latest emdesign templates.' });
      break;
    }
    case 'design-context': {
      const ds = resolveDesignSystem(paths, activeDs(store));
      const codegenInstructions = effectiveAdapter(paths).codegenInstructions(ds);
      out(composePrompt({ ds, componentName: a1 ?? 'Component', instruction: a2 ?? '(describe the component)', codegenInstructions }));
      break;
    }
    case 'lint': {
      if (!a1) throw new Error('usage: emdesign lint <component>');
      const res = await lint(paths, store, a1);
      out(renderFindingsForAgent(res.findings));
      if (res.mustFix > 0) process.exit(1); // gate: exit code = verdict
      break;
    }
    case 'visual-test': {
      if (!a1) throw new Error('usage: emdesign visual-test <component>');
      const diff = (await serverUp()) ? (await post('/api/visual-test', { component: a1 })).lastDiff : await runVisualTest(paths, a1);
      out(diff);
      if (diff?.status === 'changed') process.exit(1); // gate
      break;
    }
    case 'score': {
      const input = JSON.parse(a1 ?? '{}');
      const res = (await serverUp()) ? await post('/api/score', input) : scoreComponent(paths, input);
      out(res);
      if (res.decision !== 'ship') process.exit(1); // gate
      break;
    }
    case 'capture': {
      if (!a1) throw new Error('usage: emdesign capture <component>');
      const r = (await serverUp()) ? await post('/api/capture', { name: a1 }) : { path: await captureComponent(paths, a1) };
      out(r);
      break;
    }
    case 'render-lint': {
      if (!a1) throw new Error('usage: emdesign render-lint <component> [--themes light,dark]');
      const rlThemesArg = argv.includes('--themes') ? argv[argv.indexOf('--themes') + 1]?.split(',').filter((t): t is 'light' | 'dark' => t === 'light' || t === 'dark') : undefined;
      const rlThemes: ('light' | 'dark')[] = rlThemesArg?.length ? rlThemesArg : ['light', 'dark'];
      try {
        const snapshots = await renderSnapshot(paths, a1, { themes: rlThemes });
        out({ component: a1, snapshots: snapshots.length, themes: snapshots.map((s) => s.theme), nodes: snapshots[0]?.nodes.length ?? 0 });
      } catch (e) {
        console.error(`[emdesign] render-lint failed for "${a1}":`, (e as Error).message);
        process.exit(1);
      }
      break;
    }
    case 'vision-critique': {
      if (!a1) throw new Error('usage: emdesign vision-critique <component> [--provider claude|gemini|minimax] [--mode standard|regression|reference]');
      const vcProvider = argv.includes('--provider') ? argv[argv.indexOf('--provider') + 1] : undefined;
      const vcMode = argv.includes('--mode') ? argv[argv.indexOf('--mode') + 1] : 'standard';
      const result = (await serverUp())
        ? await post('/api/vision-critique', { component: a1, provider: vcProvider, mode: vcMode })
        : await standardCritique(
            { root: paths.root, screenshotsDir: paths.screenshotsDir, designSystemsDir: paths.designSystemsDir, activeDsId: activeDs(store) },
            { component: a1, provider: vcProvider, mode: vcMode as any },
          );
      out(result);
      break;
    }
    case 'vision-compare': {
      if (!a1 || !a2) throw new Error('usage: emdesign vision-compare <component> <referenceImagePath> [--provider claude|gemini|minimax]');
      const cmpProvider = argv.includes('--provider') ? argv[argv.indexOf('--provider') + 1] : undefined;
      const cmpResult = (await serverUp())
        ? await post('/api/vision-compare', { component: a1, referenceImagePath: a2, provider: cmpProvider })
        : await standardCritique(
            { root: paths.root, screenshotsDir: paths.screenshotsDir, designSystemsDir: paths.designSystemsDir, activeDsId: activeDs(store) },
            { component: a1, mode: 'reference', provider: cmpProvider, referenceImagePath: a2 },
          );
      out(cmpResult);
      break;
    }
    case 'session': {
      const { PlatformManager } = await import('@emdesign/session');
      const orch = new PlatformManager(paths);
      switch (a1) {
        case 'list':
          out(orch.listSessions());
          break;
        case 'create': {
          if (!a2) throw new Error('usage: emdesign session create <type> [--instruction "..."]');
          const session = await orch.createSession({
            type: a2 as any,
            workflow: a2,
            args: { instruction: argv.includes('--instruction') ? argv[argv.indexOf('--instruction') + 1] : undefined },
            instruction: argv.includes('--instruction') ? argv[argv.indexOf('--instruction') + 1] : undefined,
          });
          out(session);
          break;
        }
        case 'cancel':
          if (!a2) throw new Error('usage: emdesign session cancel <id>');
          await orch.cancelSession(a2);
          out({ ok: true });
          break;
        case 'claude':
          out(await orch.getClaudeSessions());
          break;
        default:
          throw new Error('usage: emdesign session list|create|cancel|claude');
      }
      break;
    }
    case 'service': {
      const { PlatformManager } = await import('@emdesign/session');
      const orch = new PlatformManager(paths);
      switch (a1) {
        case 'start':
          if (!a2) throw new Error('usage: emdesign service start <type>');
          out(await orch.startService(a2 as any));
          break;
        case 'stop':
          if (!a2) throw new Error('usage: emdesign service stop <type>');
          await orch.stopService(a2 as any);
          out({ ok: true });
          break;
        case 'restart':
          if (!a2) throw new Error('usage: emdesign service restart <type>');
          out(await orch.restartService(a2 as any));
          break;
        case 'status':
          out(orch.listServices());
          break;
        default:
          throw new Error('usage: emdesign service start|stop|restart|status');
      }
      break;
    }
    case 'up': {
      // Single-command: start everything
      const { PlatformManager, attachWebSocket, createSessionRouter } = await import('@emdesign/session');
      const orch = new PlatformManager(paths);
      if (!store.get().activeDesignSystem) store.update({ activeDesignSystem: 'atelier' });

      // Start HTTP bridge with orchestrator
      const server = await startHttpBridge(store, paths, PORT, orch);

      // Attach WebSocket
      try { attachWebSocket(server as any, orch.bus); } catch { /* ws not available */ }

      // Start MCP server
      try {
        const { createMcpServer } = await import('@emdesign/mcp-server');
        const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
        (await createMcpServer(store, paths, orch)).connect(new StdioServerTransport());
      } catch (e) {
        console.error('[emdesign] Failed to start MCP server:', e);
      }


      // Start Storybook
      orch.startService('storybook').catch(() => {});

      // Start health checks
      orch.services.startHealthChecks();

      console.error('[emdesign] Platform running. Ctrl+C to stop.');
      break;
    }
    default:
      throw new Error(`unknown command: ${cmd}`);
  }
}

main().catch((err) => {
  console.error('[emdesign] fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
