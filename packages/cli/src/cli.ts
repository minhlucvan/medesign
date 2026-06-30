#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import type { RepoPaths, Store } from '@emdesign/backend';
import {
  resolveRepoPaths,
  Store as StoreClass,
  createHttpBridge,
  startHttpBridge,
  effectiveAdapter,
} from '@emdesign/backend';
import { formatError } from './lib/format.js';
import { cmdDesign } from './commands/design.js';
import { cmdGenerate } from './commands/generate.js';
import { cmdDoctor } from './commands/doctor.js';
import { cmdVision } from './commands/vision.js';
import { cmdCapture, cmdCaptureBaseline } from './commands/capture.js';
import { cmdDiscover, cmdDoc } from './commands/discover.js';
import { cmdDs } from './commands/ds.js';
import { cmdGraph } from './commands/graph.js';
import { cmdInit, cmdAttach, cmdUpdate } from './commands/init.js';
import { cmdCompose } from './commands/compose.js';
import { cmdSpatialAudit } from './commands/spatial.js';
import { cmdRenderAnalyze } from './commands/render.js';
import { cmdA11y, cmdComponentTest, cmdComponentDiff } from './commands/component.js';
import { cmdStoryAuto } from './commands/story.js';
import { cmdScreenCreate, cmdScreenList } from './commands/screen.js';
import { cmdLoop } from './commands/loop.js';
import type { TraceContext } from './lib/trace.js';
import { cmdStorybookHealth } from './commands/storybook.js';
import { cmdExplore } from './commands/explore.js';
import { cmdSession, cmdLogs } from './commands/session.js';
import { cmdIntent, cmdChat } from './commands/intent.js';

const PORT = Number(process.env.EMDESIGN_PORT ?? 4321);

/**
 * Extract the next positional arg (doesn't start with --) from an array.
 */
function positional(argv: string[], offset = 0): string | undefined {
  let idx = 0;
  for (const a of argv) {
    if (a.startsWith('--')) continue;
    if (idx++ === offset) return a;
  }
  return undefined;
}

/**
 * Check if `dir` looks like the emdesign monorepo root (as opposed to a consumer workspace).
 * The monorepo root has `package.json` with `name: "emdesign"` and workspaces including `packages/*`.
 * This is used to prevent accidentally running workspace commands from the wrong directory.
 */
function detectMonorepoRoot(dir: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return pkg.name === 'emdesign'
      && Array.isArray(pkg.workspaces)
      && pkg.workspaces.includes('packages/*');
  } catch {
    return false;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--version') || argv.includes('-V')) {
    const { version } = JSON.parse(
      await fs.promises.readFile(new URL('../package.json', import.meta.url), 'utf8')
    ) as { version: string };
    process.stdout.write(`emdesign v${version}\n`);
    return;
  }
  if (argv.includes('--completion')) {
    const shellIdx = argv.indexOf('--completion');
    const shell = shellIdx >= 0 && shellIdx + 1 < argv.length && !argv[shellIdx + 1].startsWith('--') ? argv[shellIdx + 1] : 'bash';
    const commands = ['init','attach','update','serve','up','health','ds','design','generate','doctor','vision','capture','capture-baseline','discover','doc','graph','explore','compose','help','session','logs','intent','chat'];
    const dsSubs = ['list','create','use','validate','grade','scaffold','customize','update','diff','compare','conflicts','history','bases','base-detail','context','prompt'];
    if (shell === 'zsh') {
      process.stdout.write(`#compdef emdesign
_emdesign() {
  local -a commands
  commands=(${commands.map(c => `'${c}:emdesign command'`).join(' ')})
  _arguments \\
    '--json[Structured JSON output]' \\
    '--gate[Exit code verdict]' \\
    '--quiet[Suppress stderr]' \\
    '--version[Show version]' \\
    '--completion[Generate completion]:shell:(bash zsh)' \\
    '1: :->command' \\
    '*: :->args'
  case $state in
    command) _describe 'command' commands ;;
    args) case $words[1] in
      ds) _describe 'ds subcommand' (${dsSubs.join(' ')}) ;;
    esac ;;
  esac
}
compdef _emdesign emdesign
`);
    } else {
      // bash completion
      process.stdout.write(`_emdesign_completions() {
  local cur=\${COMP_WORDS[COMP_CWORD]}
  local prev=\${COMP_WORDS[COMP_CWORD-1]}
  case $prev in
    ds) COMPREPLY=($(compgen -W "${dsSubs.join(' ')}" -- $cur)) ;;
    --completion) COMPREPLY=($(compgen -W "bash zsh" -- $cur)) ;;
    *) COMPREPLY=($(compgen -W "${commands.join(' ')} --json --gate --quiet --version" -- $cur)) ;;
  esac
}
complete -F _emdesign_completions emdesign
`);
    }
    return;
  }
  const [cmd = 'help', ...rest] = argv;

  // Guard: detect accidental usage inside the emdesign monorepo root.
  // Only `help` is safe from the SDK root — all other commands scaffold
  // or mutate consumer workspace files that don't belong here.
  if (cmd !== 'help' && detectMonorepoRoot(process.cwd())) {
    console.error('[emdesign] This looks like the emdesign monorepo root.');
    console.error('  To develop the emdesign SDK itself, run commands from an app directory:');
    console.error('    cd apps/workspace-react/');
    console.error('  To use emdesign as a consumer, run from an example directory:');
    console.error('    cd examples/ledger-console/');
    process.exit(1);
  }

  const paths = resolveRepoPaths(process.cwd());
  const store = new StoreClass(paths);

  const json = rest.includes('--json');
  const gate = rest.includes('--gate');
  const quiet = rest.includes('--quiet');
  const trace = rest.includes('--trace');
  const logLevel = rest.includes('--log-level') ? rest[rest.indexOf('--log-level') + 1] : undefined;

  // Create trace context if --trace is set
  let traceCtx: TraceContext | undefined;
  if (trace) {
    const { createTraceContext } = await import('./lib/trace.js');
    traceCtx = createTraceContext(process.cwd(), { logLevel });
  }

  // ── Top-level --help dispatch ──────────────────────────────────────────
  if (rest.includes('--help') || rest.includes('-h')) {
    const subHelps: Record<string, () => void> = {
      ds: () => showDsHelp(),
      doctor: () => showDoctorHelp(),
      spatial: () => showSpatialHelp(),
      render: () => showRenderHelp(),
      component: () => showComponentHelp(),
      screen: () => showScreenHelp(),
      story: () => showStoryHelp(),
      graph: () => showGraphHelp(),
      explore: () => showExploreHelp(),
    };
    if (subHelps[cmd]) { subHelps[cmd](); return; }
    // fall through to main help
  }

  switch (cmd) {
    // ── Workspace / Project ──────────────────────────────────────────────
    case 'init': {
      const framework = rest[0];
      const dirIdx = rest.indexOf('--dir');
      const dir = dirIdx >= 0 ? rest[dirIdx + 1] : undefined;
      await cmdInit({ framework, dir });
      break;
    }

    case 'attach': {
      const dir = rest[0] && !rest[0].startsWith('--') ? rest[0] : undefined;
      await cmdAttach({ dir });
      break;
    }

    case 'update': {
      const dir = rest[0] && !rest[0].startsWith('--') ? rest[0] : undefined;
      await cmdUpdate({
        dir,
        force: rest.includes('--force'),
        prune: rest.includes('--prune'),
        dryRun: rest.includes('--dry-run'),
        storybook: rest.includes('--storybook'),
      });
      break;
    }

    // ── Server ──────────────────────────────────────────────────────────
    case 'serve': {
      // Check for port conflict before starting
      const net = await import('node:net');
      const inUse = await new Promise<boolean>((resolve) => {
        const srv = net.createServer();
        srv.once('error', () => resolve(true));
        srv.once('listening', () => { srv.close(); resolve(false); });
        srv.listen(PORT);
      });
      if (inUse) {
        console.error(`[emdesign] Port ${PORT} is already in use — another backend may be running.\n` +
          `  To stop it: kill $(lsof -ti:${PORT})`);
        process.exit(1);
      }

      let orch: any;
      try {
        const { PlatformManager } = await import('@emdesign/agent-manager');
        orch = new PlatformManager(paths);
      } catch { /* session not available */ }

      const app = await createHttpBridge(store, paths, orch);
      const server = app.listen(PORT, () => {
        console.error(`[emdesign] Server running on http://localhost:${PORT}`);
      });
      if (orch) {
        try {
          const { attachWebSocket } = await import('@emdesign/agent-manager');
          attachWebSocket(server as any, orch.bus);
        } catch { /* ws not supported */ }
        orch.services.startHealthChecks();
      }
      break;
    }

    case 'up': {
      let orch: any;
      try {
        const { PlatformManager, attachWebSocket } = await import('@emdesign/agent-manager');
        orch = new PlatformManager(paths);
        const server = await startHttpBridge(store, paths, PORT, orch);
        try { attachWebSocket(server as any, orch.bus); } catch { /* ws not available */ }
        orch.startService('storybook').catch(() => {});
        orch.services.startHealthChecks();
        console.error('[emdesign] Platform running. Ctrl+C to stop.');
      } catch (e) {
        console.error('[emdesign] up failed:', (e as Error).message);
        process.exit(1);
      }
      break;
    }

    case 'health': {
      try {
        const r = await fetch(`http://localhost:${PORT}/api/health`, { signal: AbortSignal.timeout(1000) });
        const data = await r.json();
        if (json) process.stdout.write(JSON.stringify(data, null, 2) + '\n');
        else console.error(`[emdesign] Server: ${data.ok ? 'ok' : 'unhealthy'}`);
      } catch {
        if (json) { formatError('Server not reachable'); process.exit(1); }
        else { console.error('[emdesign] Server not reachable'); process.exit(1); }
      }
      break;
    }

    // ── Design system ────────────────────────────────────────────────────
    case 'ds': {
      const [subcommand = 'list', ...dsArgs] = rest;
      await cmdDs({ subcommand, args: dsArgs, argv: rest, json, gate, trace: traceCtx }, paths, store);
      break;
    }

    // ── Component lifecycle ─────────────────────────────────────────────
    case 'design':
    case 'design-context': {
      const comp = positional(rest);
      const instruction = positional(rest, 1);
      await cmdDesign({ component: comp, instruction, json }, paths, store);
      break;
    }

    case 'generate': {
      // Batch mode: generate each entry from a JSON file
      if (rest.includes('--batch')) {
        const batchFile = rest[rest.indexOf('--batch') + 1];
        let entries: { name: string; source: string; story?: string; mode?: string }[];
        try {
          entries = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
          if (!Array.isArray(entries)) throw new Error('batch file must contain a JSON array');
        } catch (e) {
          formatError(`batch file error: ${(e as Error).message}`);
          process.exit(1);
        }
        for (const entry of entries) {
          process.stderr.write(`Generating ${entry.name}...\n`);
          await cmdGenerate({
            name: entry.name, mode: (entry.mode as any) ?? 'create',
            content: entry.source, json,
          }, paths, store);
        }
        break;
      }
      const name = positional(rest);
      if (!name) { formatError('usage: emdesign generate <name> [--content <source>] [--mode create|edit] [--source <file>] [--stdin]'); process.exit(1); }
      const mode = rest.includes('--mode') ? (rest[rest.indexOf('--mode') + 1] as 'create' | 'edit') : 'create';
      const content = rest.includes('--content') ? rest[rest.indexOf('--content') + 1] : undefined;
      const source = rest.includes('--source') ? rest[rest.indexOf('--source') + 1] : undefined;
      const story = rest.includes('--story') ? rest[rest.indexOf('--story') + 1] : undefined;
      await cmdGenerate({
        name, mode, content, source, story,
        stdin: rest.includes('--stdin'),
        stdinStory: rest.includes('--stdin-story'),
        json,
      }, paths, store);
      break;
    }

    // ── Doctor: `doctor <kind> <component>` — kind is optional (default: all) ──
    case 'doctor':
    case 'lint':
    case 'visual-test':
    case 'score':
    case 'spatial-audit':
    case 'render-lint':
    case 'spatial': {
      // Route to spatial audit command if subcommand is audit/grid
      const spatialSub = rest[0];
      if (spatialSub === 'audit' || spatialSub === 'grid') {
        const [, ...spatialRest] = rest;
        const component = positional(spatialRest);
        if (!component) { formatError('usage: emdesign spatial audit|grid <component> [--grid] [--story <name>] [--viewport <WxH>]'); process.exit(1); }
        const story = spatialRest.includes('--story') ? spatialRest[spatialRest.indexOf('--story') + 1] : undefined;
        const theme = spatialRest.includes('--theme') ? spatialRest[spatialRest.indexOf('--theme') + 1] as 'light' | 'dark' : undefined;
        const viewport = spatialRest.includes('--viewport') ? spatialRest[spatialRest.indexOf('--viewport') + 1] : undefined;
        await cmdSpatialAudit({ component, story, theme, grid: spatialSub === 'grid', viewport, json }, paths);
        break;
      }

      // Parse: first positional could be a kind (lint/visual/etc) or a component name.
      // The doctor check-kinds are: lint, visual, snapshot, spatial, charters, react.
      const KINDS = new Set(['lint', 'visual', 'snapshot', 'spatial', 'charters', 'react']);
      const first = positional(rest) ?? '';
      const second = positional(rest, 1);

      let kind: string;
      let component: string | undefined;

      // Explicit --kind flag takes precedence over positional parsing
      if (rest.includes('--kind')) {
        kind = rest[rest.indexOf('--kind') + 1];
        component = first;
      } else if (KINDS.has(first)) {
        kind = first;
        component = second;
      } else {
        // Legacy aliases set the kind implicitly
        kind = cmd === 'lint' ? 'lint'
          : cmd === 'visual-test' ? 'visual'
          : cmd === 'score' ? 'all'
          : cmd === 'spatial-audit' || cmd === 'spatial' || cmd === 'render-lint' ? 'spatial'
          : 'all';
        component = first || (cmd === 'score' ? (rest.includes('--component') ? rest[rest.indexOf('--component') + 1] : undefined) : undefined);
      }

      if (!component) {
        formatError(`usage: emdesign doctor [kind] <component> [--gate] [--json]\n  kinds: lint, visual, snapshot, spatial, charters, react`);
        process.exit(1);
      }

      const story = rest.includes('--story') ? rest[rest.indexOf('--story') + 1] : undefined;
      const theme = rest.includes('--theme') ? rest[rest.indexOf('--theme') + 1] as 'light' | 'dark' : undefined;
      const timeout = rest.includes('--timeout') ? Number(rest[rest.indexOf('--timeout') + 1]) : undefined;
      await cmdDoctor({
        component,
        kind,
        story,
        theme,
        timeout,
        detail: rest.includes('--detail'),
        quiet: rest.includes('--quiet'),
        evidence: rest.includes('--evidence') ? rest[rest.indexOf('--evidence') + 1] : undefined,
        gate,
        json,
      }, paths, store);
      break;
    }

    // ── Vision ───────────────────────────────────────────────────────────
    case 'vision':
    case 'vision-critique': {
      const component = positional(rest);
      if (!component) { formatError('usage: emdesign vision <component> [--mode] [--provider]'); process.exit(1); }
      const mode = rest.includes('--mode') ? rest[rest.indexOf('--mode') + 1] as 'standard' | 'compare' : 'standard';
      const provider = rest.includes('--provider') ? rest[rest.indexOf('--provider') + 1] as 'claude' | 'gemini' | 'minimax' : undefined;
      const reference = rest.includes('--reference') ? rest[rest.indexOf('--reference') + 1] : undefined;
      await cmdVision({ component, mode, provider, reference, json }, paths, store);
      break;
    }

    // ── Capture ──────────────────────────────────────────────────────────
    case 'capture': {
      // Batch capture all generated components
      if (rest.includes('--all')) {
        const adapter = effectiveAdapter(paths);
        const ext = adapter.fileExt;
        const files = fs.readdirSync(paths.generatedDir).filter(f => f.endsWith(ext) && !f.endsWith('.stories' + ext));
        const names = [...new Set(files.map(f => f.replace(ext, '')))];
        for (const comp of names) {
          process.stderr.write(`Capturing ${comp}...\n`);
          await cmdCapture({ component: comp, baseline: rest.includes('--baseline'), json }, paths);
        }
        break;
      }
      const name = positional(rest);
      if (!name) { formatError('usage: emdesign capture <component> [--baseline] [--all]'); process.exit(1); }
      if (rest.includes('--baseline')) {
        await cmdCapture({ component: name, baseline: true, json }, paths);
      } else {
        await cmdCapture({ component: name, json }, paths);
      }
      break;
    }

    case 'capture-baseline': {
      const name = positional(rest);
      if (!name) { formatError('usage: emdesign capture-baseline <component>'); process.exit(1); }
      await cmdCaptureBaseline({ component: name, json }, paths);
      break;
    }

    // ── Compose / View ──────────────────────────────────────────────────
    case 'compose': {
      const compName = positional(rest);
      if (!compName) { formatError('usage: emdesign compose <name> --components "Comp1,Comp2,..." [--layout stack|grid|sidebar]'); process.exit(1); }
      const compsArg = rest.includes('--components') ? rest[rest.indexOf('--components') + 1] : '';
      const components = compsArg.split(',').map(s => s.trim()).filter(Boolean);
      const layout = rest.includes('--layout') ? rest[rest.indexOf('--layout') + 1] as 'stack' | 'grid' | 'sidebar' : 'stack';
      await cmdCompose({ name: compName, components, layout, json }, paths);
      break;
    }

    // ── Browse ───────────────────────────────────────────────────────────
    case 'discover': {
      const kind = rest.includes('--kind') ? rest[rest.indexOf('--kind') + 1] : 'all';
      const filter = rest.includes('--filter') ? rest[rest.indexOf('--filter') + 1] : undefined;
      await cmdDiscover({ kind, filter, json }, paths, store);
      break;
    }

    case 'doc': {
      const target = positional(rest);
      if (!target) { formatError('usage: emdesign doc <target>'); process.exit(1); }
      await cmdDoc({ target, json }, paths, store);
      break;
    }

    // ── Knowledge graph ──────────────────────────────────────────────────
    case 'graph': {
      const [subcommand = 'build', ...graphArgs] = rest;
      await cmdGraph({ subcommand, args: graphArgs, argv: rest, json }, paths, store);
      break;
    }

    // ── Explore ──────────────────────────────────────────────────────────
    case 'explore': {
      const topic = positional(rest);
      const name = positional(rest, 1);
      const ds = rest.includes('--ds') ? rest[rest.indexOf('--ds') + 1] : undefined;
      await cmdExplore({ topic, name, ds, json }, paths, store);
      break;
    }

    // ── Render Analyze ──────────────────────────────────────────────────
    case 'render': {
      const [renderSub, ...renderRest] = rest;
      if (renderSub === 'analyze' || renderSub === 'snapshot') {
        const component = positional(renderRest);
        if (!component) { formatError('usage: emdesign render analyze|snapshot <component> [--story <name>] [--theme light|dark] [--viewport <WxH>]'); process.exit(1); }
        const story = renderRest.includes('--story') ? renderRest[renderRest.indexOf('--story') + 1] : undefined;
        const theme = renderRest.includes('--theme') ? renderRest[renderRest.indexOf('--theme') + 1] as 'light' | 'dark' : undefined;
        const viewport = renderRest.includes('--viewport') ? renderRest[renderRest.indexOf('--viewport') + 1] : undefined;
        await cmdRenderAnalyze({ component, story, theme, viewport, json }, paths);
      } else {
        formatError('usage: emdesign render analyze|snapshot <component>');
        process.exit(1);
      }
      break;
    }

    // ── Component Intelligence ──────────────────────────────────────────
    case 'component': {
      const [compSub, ...compRest] = rest;
      const component = positional(compRest);
      if (compSub === 'a11y') {
        if (!component) { formatError('usage: emdesign component a11y <component> [--story <name>] [--theme light|dark] [--viewport <WxH>]'); process.exit(1); }
        const story = compRest.includes('--story') ? compRest[compRest.indexOf('--story') + 1] : undefined;
        const theme = compRest.includes('--theme') ? compRest[compRest.indexOf('--theme') + 1] as 'light' | 'dark' : undefined;
        const viewport = compRest.includes('--viewport') ? compRest[compRest.indexOf('--viewport') + 1] : undefined;
        await cmdA11y({ component, story, theme, viewport, json }, paths);
      } else if (compSub === 'test') {
        if (!component) { formatError('usage: emdesign component test <component>'); process.exit(1); }
        await cmdComponentTest({ component, json }, paths);
      } else if (compSub === 'diff') {
        if (!component) { formatError('usage: emdesign component diff <component>'); process.exit(1); }
        await cmdComponentDiff({ component, json }, paths);
      } else {
        formatError('usage: emdesign component a11y|test|diff <component>');
        process.exit(1);
      }
      break;
    }

    // ── Story Auto ──────────────────────────────────────────────────────
    case 'story': {
      const [storySub, ...storyRest] = rest;
      if (storySub === 'auto') {
        const component = positional(storyRest);
        if (!component) { formatError('usage: emdesign story auto <component>'); process.exit(1); }
        await cmdStoryAuto({ component, json }, paths);
      } else {
        formatError('usage: emdesign story auto <component>');
        process.exit(1);
      }
      break;
    }

    // ── Screen / Page ───────────────────────────────────────────────────
    case 'screen': {
      const [screenSub, ...screenRest] = rest;
      if (screenSub === 'create') {
        const name = positional(screenRest);
        if (!name) { formatError('usage: emdesign screen create <name> [--route <path>] [--layout <layout>]'); process.exit(1); }
        const route = screenRest.includes('--route') ? screenRest[screenRest.indexOf('--route') + 1] : undefined;
        const layout = screenRest.includes('--layout') ? screenRest[screenRest.indexOf('--layout') + 1] : undefined;
        await cmdScreenCreate({ name, route, layout, json }, paths);
      } else if (screenSub === 'list') {
        await cmdScreenList({ json }, paths);
      } else {
        formatError('usage: emdesign screen create|list ...');
        process.exit(1);
      }
      break;
    }

    // ── Loop ────────────────────────────────────────────────────────────
    case 'loop': {
      const component = positional(rest);
      if (!component) { formatError('usage: emdesign loop <component> [--max-iterations <n>]'); process.exit(1); }
      const maxIterations = rest.includes('--max-iterations') ? Number(rest[rest.indexOf('--max-iterations') + 1]) : 10;
      await cmdLoop({ component, maxIterations, json }, paths, store);
      break;
    }

    // ── Storybook Health ───────────────────────────────────────────────────
    case 'storybook': {
      const [storybookSub, ...sbRest] = rest;
      if (storybookSub === 'health' || storybookSub === 'check') {
        const story = sbRest.includes('--story') ? sbRest[sbRest.indexOf('--story') + 1] : undefined;
        await cmdStorybookHealth({
          verbose: sbRest.includes('--verbose'),
          json: sbRest.includes('--json'),
          story,
          all: sbRest.includes('--all'),
        }, paths, store);
      } else {
        formatError('usage: emdesign storybook health|check [--story <id>] [--all] [--verbose] [--json]');
        process.exit(1);
      }
      break;
    }

    // ── Session tracing ────────────────────────────────────────────────────
    case 'session': {
      const [sessionSub, ...sessionRest] = rest;
      const limit = sessionRest.includes('--limit') ? Number(sessionRest[sessionRest.indexOf('--limit') + 1]) : undefined;
      const tail = sessionRest.includes('--tail');
      const fmt = sessionRest.includes('--format') ? sessionRest[sessionRest.indexOf('--format') + 1] as 'text' | 'json' : undefined;
      const id = (sessionSub === 'show' || sessionSub === 'logs') ? sessionRest[0] : undefined;

      if (!sessionSub || !['list', 'show', 'logs'].includes(sessionSub)) {
        formatError('usage: emdesign session list|show|logs [args]\n  list [--limit N]  show <id>  logs <id> [--tail] [--format text|json]');
        process.exit(1);
      }

      await cmdSession({
        subcommand: sessionSub as 'list' | 'show' | 'logs',
        args: sessionRest,
        limit,
        id,
        tail,
        format: fmt,
      }, paths);
      break;
    }

    // ── Logs ──────────────────────────────────────────────────────────────
    case 'logs': {
      const level = rest.includes('--level') ? rest[rest.indexOf('--level') + 1] : undefined;
      const session = rest.includes('--session') ? rest[rest.indexOf('--session') + 1] : undefined;
      const since = rest.includes('--since') ? rest[rest.indexOf('--since') + 1] : undefined;
      const until = rest.includes('--until') ? rest[rest.indexOf('--until') + 1] : undefined;
      const follow = rest.includes('--follow');
      const fmt = rest.includes('--format') ? rest[rest.indexOf('--format') + 1] as 'json' | 'text' : undefined;

      await cmdLogs({ level, session, since, until, follow, format: fmt }, paths);
      break;
    }

    // ── Intent ─────────────────────────────────────────────────────────────
    case 'intent': {
      const intentType = positional(rest);
      const instruction = positional(rest, 1);
      if (!intentType || !instruction) {
        formatError('usage: emdesign intent <type> <instruction> [--selector <css>]');
        process.exit(1);
      }
      const selector = rest.includes('--selector') ? rest[rest.indexOf('--selector') + 1] : undefined;
      await cmdIntent({ type: intentType, instruction, selector }, paths);
      break;
    }

    // ── Chat ───────────────────────────────────────────────────────────────
    case 'chat': {
      const chatMsg = positional(rest);
      const chatType = rest.includes('--type') ? rest[rest.indexOf('--type') + 1] : undefined;
      if (!chatMsg || !chatType) {
        formatError('usage: emdesign chat <message> --type <intent-type> [--wait] [--interactive]');
        process.exit(1);
      }
      const wait = rest.includes('--wait');
      const interactive = rest.includes('--interactive');
      await cmdChat({ message: chatMsg, type: chatType, wait, interactive }, paths);
      break;
    }

    // ── Help ─────────────────────────────────────────────────────────────
    case 'help':
    default: {
      showMainHelp();
      break;
    }
  }

  // Teardown trace context after command completes
  if (traceCtx) {
    traceCtx.teardown();
  }
}

// ── Help functions ───────────────────────────────────────────────────────

function showMainHelp(): void {
  process.stdout.write(`
emdesign — design-engineering CLI

Usage: emdesign <command> [args] [flags]
Run 'emdesign <command> --help' for per-command details.

═══ What do you want to do? ═══

🔧  Set up a project
    init <framework> [--dir .]        Scaffold a new workspace
    attach [--dir .]                  Attach to existing project
    serve [--port 4321]               Start HTTP bridge
    up                                Start everything (bridge + Storybook)

🎨  Create or customize a design system
    ds search <query>                 Search registries for matching systems
    ds import awesome|git <id>        Import from awesome-design-md or git
    ds create <id> [--mode]           Create a new design system from scratch
    ds customize <id> [--primary]     Clone + customize with brand tokens
    ds validate [id] --strict         Validate token contract completeness

📦  Compile and publish a design system
    ds compile <id>                   Compile tokens → TypeScript types + CSS
    ds export <id>                    Export as consumable npm package
    ds version <id> <bump>            Semantic version bump
    ds changelog <id>                 Auto-generate changelog

🏗️  Build a component
    ds context <comp> [instruction]   Get design context prompt for AI agent
    generate <name> [--content]       Create/edit a component from source
    story auto <comp>                 Auto-generate CSF stories from props
    capture <comp> [--baseline]       Promote to reusable git-tracked component

✅  Verify and test
    doctor lint <comp>                Fast token-rule compliance check
    doctor visual <comp>              Pixel diff vs baseline (needs Storybook)
    doctor spatial <comp>             Geometry audit (overlaps, spacing)
    doctor charters <comp>            Story charter evaluation
    doctor all <comp> --gate          Full composite gate (ship/revise)

🔍  Deep analysis (needs Storybook)
    render analyze <comp>             Headless render -> semantic DOM tree
    spatial audit <comp> [--grid]     Full geometry breakdown + grid check
    component a11y <comp>             Deep axe-core accessibility audit
    component test <comp>             Generate vitest tests from props
    vision <comp> [--provider]        AI vision critique (5-axis scoring)

📐  Compose views, screens, and pages
    compose <name> --components "..." Compose components into a layout
    ds blueprint list                 List composition blueprints
    ds blueprint apply <id> <name>    Create component from a blueprint
    screen create <name> [--route]    Create a screen with routing
    screen list                       List all screens

💬  Agent
    intent <type> <instruction>       Submit a design intent
    chat <message> --type <type>      Chat with the design agent

    🧵  Session tracing and logs
    session list [--limit N]          List Claude sessions
    session show <id>                 Show session details
    session logs <id> [--tail]        View session log entries
    logs [--level] [--session]        Query trace logs

⚙️  Configure lint rules
    ds lint-rules list [id]           Show active lint rules
    ds lint-rules preset <id> <name>  Apply a rule preset
    ds lint-rules set <id> <rule> <s> Set rule severity (P0|P1|P2|off)

🤖  Automate
    loop <comp> [--max-iterations]    Double-loop until gate passes
    generate --batch <file.json>      Batch-generate from manifest
    capture --all [--baseline]        Capture all generated components
    doctor all <comp> --gate          CI-ready composite gate

🔎  Explore and discover
    explore [overview|ds|tokens|...]  Explore workspace state
    discover [--kind] [--filter]      List stories, components, systems
    doc <target>                      Component/story documentation

🔄  Knowledge graph
    graph build [ds-id]               Rebuild the knowledge graph
    graph context <node-id>           Full node context from the graph
    graph impact <node-id>            Blast radius / affected dependents
    graph where-to-fix <artifact> <f> Find fix location for a lint finding
    graph guidance [name] --intent    Consistency brief for building

── Common flags ────────────────────────────────────────────────────
    --version, -V           Show version
    --completion [bash|zsh] Generate shell completion script
    --json                  Structured JSON on stdout
    --gate                  Exit code = verdict (0 ship, 1 fail)
    --quiet                 Suppress stderr messages

── All commands ────────────────────────────────────────────────────
    capture  chat  compose  design  discover  doc  doctor  ds  explore
    generate  graph  health  init  intent  loop  logs  render  screen
    session  spatial  story  storybook  update  use  vision

Legacy aliases: lint, visual-test, score, vision-critique, spatial-audit
`);
}

function showDsHelp(): void {
  process.stdout.write(`
emdesign ds — Design system operations

Usage: emdesign ds <subcommand> [args] [--json] [--gate]

Registry:
  search <query> [--limit N]          Search registries (vendor + awesome)
  info [id]                           Show detailed system info
  list                                List all local design systems
  bases                               List vendored base systems
  base-detail <id>                    Show base system details
  import awesome <brand> [--name]     Import from awesome-design-md (74 brands)
  import git <url> [--path] [--ref]   Import from a git repository
  import vendor <id> [--name]         Import from vendored base

Lifecycle:
  create <id> [--mode] [--from] [--name] [--description]  Create new DS
  customize <id> [--primary] [--body-font] [--spacing]     Clone + customize
  update <id> [--name] [--description]                     Update metadata
  use <id>                            Switch active design system
  validate [id] [--strict] [--gate]   Validate token contract + DSR rules
  grade [id] [--timeout] [--gate]     Grade DS quality against rubric
  diff <id1> <id2>                    Compare two design systems
  conflicts [id]                      List orphan/unused token conflicts
  history [id] [--snapshot]           Show version history / take snapshot

Compilation:
  compile <id> [--out <dir>]          Compile tokens -> TypeScript types + CSS
  export <id> [--out <dir>]           Export as npm-consumable package
  version <id> <major|minor|patch>    Semantic version bump on manifest
  changelog <id> [--snapshot]         Show or create changelog entry

Content:
  scaffold <id> [--from <base>]       Copy base primitives into DS
  scaffold <id> --blocks <list>       Scaffold specific building blocks
  block list [--tags <tags>]          List all building blocks (27 available)
  blueprint list [--category <cat>]   List composition blueprints (14)
  blueprint apply <id> <target>       Generate component from a blueprint
  context <comp> [instruction]        Design context prompt for AI agent
  prompt <comp> [instruction]         Alias for context

Lint rules:
  lint-rules list [id]                Show active rules, preset, exemptions
  lint-rules preset <id> <name>       Apply a named rule preset
  lint-rules set <id> <rule> <sev>    Change rule severity

Run 'emdesign ds <subcommand> --help' for subcommand-specific help.
`);
}

function showDoctorHelp(): void {
  process.stdout.write(`
emdesign doctor — Multi-axis component verification

Usage: emdesign doctor [kind] <component> [--gate] [--timeout N] [--detail] [--quiet]

Check kinds (default: all):
  lint                Token-rule compliance          ~100ms  (fastest)
  visual              Pixel diff vs baseline          ~2s    (needs Storybook)
  spatial             Geometry audit                  ~500ms (needs Storybook)
  snapshot            DOM render snapshot              ~2s   (needs Storybook)
  charters            Story charter evaluation        ~100ms
  react               React anti-pattern scan          ~1s

Examples:
  emdesign doctor lint StatsCard           Fast token check
  emdesign doctor visual StatsCard         Visual diff only
  emdesign doctor all StatsCard --gate     Full composite gate (CI-ready)
  emdesign doctor lint,visual StatsCard    Multiple kinds

Flags:
  --gate              Exit code = verdict (0 ship, 1 fail)
  --timeout <ms>      Kill check if it runs too long
  --detail            Show all findings with remediation
  --quiet             Suppress stderr output
  --json              Structured JSON output
`);
}

function showSpatialHelp(): void {
  process.stdout.write(`
emdesign spatial — Spatial/geometry analysis

Usage: emdesign spatial audit|grid <component> [--story <name>] [--theme light|dark]

Subcommands:
  audit               Full geometry breakdown: bounding boxes, overlaps, spacing
  grid                Overlay design grid (8px) and measure adherence

Examples:
  emdesign spatial audit StatsCard
  emdesign spatial grid StatsCard --grid

Flags:
  --json              Structured JSON output
`);
}

function showRenderHelp(): void {
  process.stdout.write(`
emdesign render — Headless render analysis

Usage: emdesign render analyze|snapshot <component> [--story <name>] [--theme light|dark]

Subcommands:
  analyze             Render -> semantic DOM tree + coordinates + computed styles
  snapshot            Capture render as structured JSON

Examples:
  emdesign render analyze StatsCard
  emdesign render analyze StatsCard --theme dark --out ./analysis.json

Flags:
  --story <name>      Story variant to render (default: default)
  --theme light|dark  Color theme (default: light)
  --out <file>        Write output to file instead of stdout
  --json              Structured JSON output
`);
}

function showComponentHelp(): void {
  process.stdout.write(`
emdesign component — Component intelligence commands

Usage: emdesign component <subcommand> <component> [args]

Subcommands:
  a11y                Deep axe-core accessibility audit (needs Storybook)
  test                Generate vitest test file from component props
  diff                Compare generated vs captured versions

Examples:
  emdesign component a11y StatsCard
  emdesign component test StatsCard
  emdesign component diff StatsCard

Flags:
  --story <name>      Story variant (for a11y)
  --theme light|dark  Color theme (for a11y)
  --json              Structured JSON output
`);
}

function showScreenHelp(): void {
  process.stdout.write(`
emdesign screen — Screen/page management

Usage: emdesign screen create|list [args]

Subcommands:
  create <name>       Create a new screen with component, story, and routing
  list                List all screens with routes and layouts

Examples:
  emdesign screen create Dashboard --route /dashboard
  emdesign screen create Settings --route /settings --layout sidebar
  emdesign screen list

Flags:
  --route <path>      URL route for the screen
  --layout <name>     Layout component to wrap the screen
  --json              Structured JSON output
`);
}

function showStoryHelp(): void {
  process.stdout.write(`
emdesign story — Story auto-generation

Usage: emdesign story auto <component>

Auto-generates CSF stories from component props interface.
Parses the component source, creates Default + variant stories for boolean props.

Examples:
  emdesign story auto StatsCard

Flags:
  --json              Structured JSON output
`);
}

function showGraphHelp(): void {
  process.stdout.write(`
emdesign graph — Knowledge graph operations

Usage: emdesign graph <subcommand> [args]

Subcommands:
  build [ds-id]                   Rebuild knowledge graph from scratch
  context <node-id>               Full node context (neighbors, properties)
  impact <node-id>                Blast radius / affected dependents
  where-to-fix <artifact> <find>  Pinpoint fix location for a lint finding
  guidance [name] --intent <text> Consistency brief for building a component
  query [--label] [--from] [--to] [--where <json>]  Flexible graph queries

Examples:
  emdesign graph build atelier
  emdesign graph impact art/StatsCard
  emdesign graph where-to-fix StatsCard off-token-color

Flags:
  --json              Structured JSON output
`);
}

function showExploreHelp(): void {
  process.stdout.write(`
emdesign explore — Workspace exploration

Usage: emdesign explore [topic] [name] [--json]

Topics:
  (no topic) / overview     Workspace summary (DS, tokens, primitives, counts)
  ds                        Design system details
  tokens [name]             All tokens by kind, optional name filter
  primitives [name]         All primitives with props, variants, states
  components [name]         Generated + captured components
  hierarchy <name>          Composition tree (what it composes, what uses it)
  rules                     All lint rules by severity
  charters                  All element charters
  sections                  All DESIGN.md sections
  stats                     Graph node/edge counts

Examples:
  emdesign explore
  emdesign explore components StatsCard
  emdesign explore tokens --json

Flags:
  --json              Structured JSON output
  --ds <id>           Specify design system (default: active)
`);
}

main().catch((err) => {
  console.error('[emdesign] fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
