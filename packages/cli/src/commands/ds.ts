import fs from 'node:fs';
import path from 'node:path';
import type { RepoPaths, Store } from '@emdesign/backend';
import {
  createDesignSystem,
  applyDesignSystem,
  listBases,
  gradeDesignSystem,
  renderGrade,
  runtimeFor,
  normalizeDsRef,
  validateDesignSystem,
  updateDesignSystem,
  compileDesignSystem,
  exportDesignSystem,
  resolveDesignSystem,
  composePrompt,
  effectiveAdapter,
  loadOrBuild,
  overlayGenerated,
  ensureDir,
  searchDesignSystems,
  getDesignSystemInfo,
  getLintRules,
  setLintRule,
  applyLintPreset,
  LINT_RULE_PRESETS,
  listBlocks,
  scaffoldBlocks,
  listBlueprints,
  applyBlueprint,
  auditDesignSystem,
} from '@emdesign/backend';
import { getContext, consistencyBrief } from "@emdesign/graph";
import { formatJson, formatError } from '../lib/format.js';
import type { TraceContext } from '../lib/trace.js';

export interface DsArgs {
  subcommand: string;
  args: string[];
  argv: string[];
  json?: boolean;
  gate?: boolean;
  trace?: TraceContext;
}

export async function cmdDs(ds: DsArgs, paths: RepoPaths, store: Store): Promise<void> {
  const [a1, a2, a3] = ds.args;

  switch (ds.subcommand) {
    case 'create': {
      if (!a1) {
        formatError('usage: emdesign ds create <id> [--mode blank|brief|import|extract] [--from <base>] [--name <name>] [--description <text>]');
        process.exit(1);
      }
      const modeIdx = ds.argv.indexOf('--mode');
      const mode = modeIdx >= 0 ? ds.argv[modeIdx + 1] as any : 'blank';
      const fromIdx = ds.argv.indexOf('--from');
      const from = fromIdx >= 0 ? ds.argv[fromIdx + 1] : undefined;
      const nameIdx = ds.argv.indexOf('--name');
      const name = nameIdx >= 0 ? ds.argv[nameIdx + 1] : undefined;
      const descIdx = ds.argv.indexOf('--description');
      const description = descIdx >= 0 ? ds.argv[descIdx + 1] : undefined;
      const result = createDesignSystem(paths, { id: a1, mode, from, name, description });
      // Auto-apply: wire CSS import, rebuild graph, set in config
      try { applyDesignSystem(paths, a1); } catch { /* may be mid-authoring */ }
      out(result, ds.json);
      break;
    }

    case 'bases': {
      const result = listBases(paths);
      out(result, ds.json);
      break;
    }

    case 'validate': {
      // Replaced by: emdesign test validate [<id>] --json
      const testCmd = await import('./test.js');
      await testCmd.cmdTest({
        subcommand: 'validate',
        args: [a1 || paths.activeDesignSystem].filter(Boolean) as string[],
        json: ds.json,
        gate: ds.gate,
      }, paths);
      break;
    }

    case 'audit': {
      // Replaced by: emdesign test audit [<id>] --json
      const testCmd2 = await import('./test.js');
      await testCmd2.cmdTest({
        subcommand: 'audit',
        args: [a1 || paths.activeDesignSystem].filter(Boolean) as string[],
        json: ds.json,
      }, paths);
      break;
    }

    case 'grade': {
      // Replaced by: emdesign test grade [<id>] --json
      const testCmd3 = await import('./test.js');
      await testCmd3.cmdTest({
        subcommand: 'grade',
        args: [a1 || paths.activeDesignSystem].filter(Boolean) as string[],
        json: ds.json,
        gate: ds.gate,
      }, paths);
      break;
    }

    case 'search': {
      // The first positional that's not a flag
      const rawArgs = ds.args.filter((a: string) => !a.startsWith('--'));
      const query = rawArgs[0];
      const limitIdx = ds.argv.indexOf('--limit');
      const limit = limitIdx >= 0 ? Number(ds.argv[limitIdx + 1]) : 20;
      const systems = await searchDesignSystems(query, { limit });
      if (ds.json) {
        formatJson({ query, total: systems.length, systems });
      } else {
        process.stdout.write(`Search results${query ? ` for "${query}"` : ''} (${systems.length}):\n`);
        for (const s of systems) {
          process.stdout.write(`  ${s.id.padEnd(25)} ${s.category.padEnd(15)} ${s.source.padEnd(25)} ${s.tokens} tokens\n`);
        }
      }
      break;
    }

    case 'info': {
      const id = paths.activeDesignSystem;
      const info = getDesignSystemInfo(paths, id);
      if (ds.json) {
        formatJson(info);
      } else {
        process.stdout.write(`═══ ${info.name} ═══\n`);
        process.stdout.write(`  ID: ${info.id}\n`);
        process.stdout.write(`  Category: ${info.category}\n`);
        process.stdout.write(`  Version: ${info.version}\n`);
        process.stdout.write(`  Description: ${info.description}\n`);
        process.stdout.write(`  Tokens: ${info.tokens} (missing: ${info.missingRoles.length > 0 ? info.missingRoles.join(', ') : 'none'})\n`);
        process.stdout.write(`  Primitives: ${info.primitives.length > 0 ? info.primitives.join(', ') : 'none'}\n`);
        process.stdout.write(`  Lint preset: ${info.preset}\n`);
        process.stdout.write(`  Blueprints: ${info.blueprints.length}\n`);
      }
      break;
    }

    case 'import': {
      const importSrc = a1; // awesome | git | vendor | npm | url
      const importId = a2;
      if (!importSrc || !importId) {
        formatError('usage: emdesign ds import <awesome|git|vendor|project> <id|path> [--name <name>] [--id <id>] [--ref <branch>] [--path <dir>]');
        process.exit(1);
      }
      const importNameIdx = ds.argv.indexOf('--name');
      const importName = importNameIdx >= 0 ? ds.argv[importNameIdx + 1] : undefined;

      if (importSrc === 'vendor') {
        // Synchronous: clone from a vendored base
        const fromBase = `open-design/${importId}`;
        const r = createDesignSystem(paths, { id: importName ?? importId, mode: 'import', from: fromBase });
        out(r, ds.json);
        break;
      }

      // Queue full ds-import workflow (handles fetch → tokens → skills → primitives → compose overview)
      if (importSrc === 'awesome') {
        const displayName = importName || importId;
        process.stdout.write(`\n  ⏳ Queued ds-import workflow for "${displayName}"\n`);
        process.stdout.write(`     Run from Claude Code:\n`);
        process.stdout.write(`     Workflow({ scriptPath: 'apps/workspace/templates/claude/workflows/ds-import.js', args: { source: "awesome/${importId}", id: "${importId}", name: "${displayName}" } })\n`);
        process.stdout.write(`\n     This will: fetch DESIGN.md → generate tokens → skills → primitives → compose overview → verify\n`);

        if (ds.json) {
          formatJson({ ok: true, note: `Run ds-import workflow for "${displayName}"` });
        } else {
          out({ ok: true, name: displayName, id: importId }, ds.json);
        }
        break;
      }

      // Queue intent for agent processing (git, project)
      const displayName = importName || importId;
      const ref = ds.argv.includes('--ref') ? ds.argv[ds.argv.indexOf('--ref') + 1] : undefined;
      const subPath = ds.argv.includes('--path') ? ds.argv[ds.argv.indexOf('--path') + 1] : undefined;
      const projectPath = importSrc === 'project' ? path.resolve(importId) : undefined;

      const cr = store.enqueueIntent({
        type: 'create-design-system',
        instruction: importSrc === 'git'
          ? `Import the "${importId}" design system from git. Run the ds-import workflow with source "git/${importId}", ref "${ref ?? 'main'}", path "${subPath ?? ''}", and name "${displayName}". After import, run ds-generate-preview for the rich preview HTML.`
          : `Import the design system from project at "${projectPath}". Run the ds-import workflow with source "project/${projectPath}" and name "${displayName}". After import, adopt components and generate preview.`,
      });

      if (ds.json) {
        formatJson({ ok: true, changeRequestId: cr.id, note: `Intent queued. Agent will import and generate preview.` });
        break;
      }

      process.stdout.write(`\n  ⏳ Queued import (${cr.id})\n`);

      // Check if backend is running on port 4321
      let backendRunning = false;
      try {
        const { createConnection } = await import('node:net');
        backendRunning = await new Promise<boolean>((resolve) => {
          const sock = createConnection(4321, '127.0.0.1', () => { sock.end(); resolve(true); });
          sock.on('error', () => resolve(false));
        });
      } catch { /* net not available */ }

      if (backendRunning) {
        process.stdout.write(`  🔄 Backend running (port 4321) — watching for progress...\n`);
        // Poll state file for status changes
        let lastStatus = '';
        const startTime = Date.now();
        await new Promise<void>((resolve) => {
          const iv = setInterval(() => {
            const state = store.get();
            const item = state.changeRequests.find((c: any) => c.id === cr.id);
            if (!item) { clearInterval(iv); resolve(); return; }
            if (item.status !== lastStatus) {
              const elapsed = Math.round((Date.now() - startTime) / 1000);
              const icon = item.status === 'pending' ? '⏳' : item.status === 'in_progress' ? '🔄' : item.status === 'done' ? '✅' : '❌';
              process.stdout.write(`  ${icon} ${item.status}${item.note ? ': ' + item.note : ''} (${elapsed}s)\n`);
              lastStatus = item.status;
            }
            if (item.status === 'done' || item.status === 'error') { clearInterval(iv); resolve(); }
          }, 2000);
          setTimeout(() => { clearInterval(iv); resolve(); }, 300_000);
        });
        const finalState = store.get();
        const finalItem = finalState.changeRequests.find((c: any) => c.id === cr.id);
        if (finalItem?.status === 'done') {
          process.stdout.write(`\n  ✅ Import complete: "${displayName}"\n`);
        } else if (finalItem?.status === 'error') {
          process.stdout.write(`\n  ❌ Import failed: ${finalItem.note || 'unknown error'}\n`);
        }
      } else {
        process.stdout.write(`  📁 Design system will appear at: design-systems/${importId}/\n`);
        process.stdout.write(`  \n`);
        process.stdout.write(`  To process this import, start the backend:\n`);
        process.stdout.write(`    emdesign serve\n`);
        process.stdout.write(`  \n`);
        process.stdout.write(`  The backend's agent manager will detect this intent,\n`);
        process.stdout.write(`  spawn Claude Code, and run the ds-import workflow.\n`);
      }
      break;
    }

    // ── V3: Lint Rules ─────────────────────────────────────────────────
    case 'lint-rules': {
      const ruleSub = a1;
      const ruleId = a2 ?? paths.activeDesignSystem;
      if (ruleSub === 'list' || !ruleSub) {
        const rules = getLintRules(paths, ruleId);
        if (ds.json) {
          formatJson(rules);
        } else {
          process.stdout.write(`Lint rules for ${ruleId} (preset: ${rules.preset}):\n`);
          process.stdout.write(`  Applies (${rules.applies.length}): ${rules.applies.join(', ') || 'none'}\n`);
          process.stdout.write(`  Exemptions (${rules.exemptions.length}): ${rules.exemptions.join(', ') || 'none'}\n`);
        }
      } else if (ruleSub === 'set') {
        const ruleName = a3;
        const severity = ds.args[3]; // fourth positional
        if (!ruleName || !severity) {
          formatError('usage: emdesign ds lint-rules set <rule> <P0|P1|P2|off>');
          process.exit(1);
        }
        const r = setLintRule(paths, ruleId, ruleName, severity);
        out(r, ds.json);
      } else if (ruleSub === 'preset') {
        const presetName = a3;
        if (!presetName || !LINT_RULE_PRESETS[presetName]) {
          formatError(`usage: emdesign ds lint-rules preset  <${Object.keys(LINT_RULE_PRESETS).join('|')}>`);
          process.exit(1);
        }
        const r = applyLintPreset(paths, ruleId, presetName);
        out(r, ds.json);
      } else {
        formatError('usage: emdesign ds lint-rules list|set|preset ...');
        process.exit(1);
      }
      break;
    }

    // ── V3: Blocks ─────────────────────────────────────────────────────
    case 'block': {
      const blockSub = a1;
      if (blockSub === 'list' || !blockSub) {
        const tag = ds.argv.includes('--tags') ? ds.argv[ds.argv.indexOf('--tags') + 1] : undefined;
        const blocks = listBlocks(tag);
        if (ds.json) {
          formatJson({ total: blocks.length, blocks });
        } else {
          process.stdout.write(`Building blocks (${blocks.length}):\n`);
          for (const b of blocks) {
            process.stdout.write(`  ${b.id.padEnd(20)} variants: ${b.variants.padEnd(30)} states: ${b.states || '—'}\n`);
          }
        }
      } else {
        formatError('usage: emdesign ds block list [--tags form,data,navigation]');
        process.exit(1);
      }
      break;
    }

    // ── V3: Blueprints ─────────────────────────────────────────────────
    case 'blueprint': {
      const bpSub = a1;
      const bpId = a2;
      if (bpSub === 'list' || !bpSub) {
        const cat = ds.argv.includes('--category') ? ds.argv[ds.argv.indexOf('--category') + 1] : undefined;
        const bps = listBlueprints(cat);
        if (ds.json) {
          formatJson({ total: bps.length, blueprints: bps });
        } else {
          process.stdout.write(`Blueprints (${bps.length}):\n`);
          for (const b of bps) {
            process.stdout.write(`  ${b.id.padEnd(20)} ${b.description.padEnd(50)} [${b.composes.join(', ')}]\n`);
          }
        }
      } else if (bpSub === 'apply') {
        if (!bpId || !a3) {
          formatError('usage: emdesign ds blueprint apply <blueprint-id> <target-name>');
          process.exit(1);
        }
        const r = applyBlueprint(paths, bpId, a3, { dir: paths.generatedDir });
        out(r, ds.json);
      } else {
        formatError('usage: emdesign ds blueprint list|apply ...');
        process.exit(1);
      }
      break;
    }

    case 'context':
    case 'prompt': {
      const compName = a1 ?? 'Component';
      const instruction = a2 ?? '(describe the component)';
      const id = paths.activeDesignSystem;
      const designSystem = resolveDesignSystem(paths, id);
      let graphContext: string | undefined;
      try {
        const g = loadOrBuild(paths, id);
        const nodeId = g.has(`art/${compName}`) ? `art/${compName}` : g.has(`${id}/${compName}`) ? `${id}/${compName}` : null;
        if (nodeId) {
          graphContext = JSON.stringify(getContext(g, nodeId), null, 2);
        } else {
          graphContext = JSON.stringify(consistencyBrief(g, { name: compName, intent: instruction }), null, 2);
        }
      } catch { /* graph optional */ }
      const codegenInstructions = effectiveAdapter(paths).codegenInstructions(designSystem);
      const prompt = composePrompt({ ds: designSystem, componentName: compName, instruction, graphContext, codegenInstructions });
      if (ds.json) {
        formatJson({ prompt, designSystem: { id: designSystem.name ?? id, tokens: designSystem.declaredTokens?.length ?? 0 } });
      } else {
        process.stdout.write(prompt + '\n');
      }
      break;
    }

    case 'scaffold': {
      if (!a1) {
        formatError('usage: emdesign ds scaffold [--from <base>] [--blocks Button,Card,...]');
        process.exit(1);
      }
      // If --blocks is specified, scaffold specific blocks
      if (ds.argv.includes('--blocks')) {
        const blocks = ds.argv[ds.argv.indexOf('--blocks') + 1].split(',').map((b: string) => b.trim());
        const r = scaffoldBlocks(paths, paths.activeDesignSystem, blocks);
        if (ds.json) {
          formatJson(r);
        } else {
          process.stdout.write(`${r.note}: ${r.blocks.join(', ')}\n`);
        }
        break;
      }
      const fromIdx = ds.argv.indexOf('--from');
      const from = fromIdx >= 0 ? ds.argv[fromIdx + 1] : undefined;
      const { scaffoldPrimitives: sp } = await import('@emdesign/backend');
      const ok = sp(paths, paths.activeDesignSystem, from);
      if (ds.json) {
        formatJson({ id: paths.activeDesignSystem, scaffolded: ok });
      } else {
        process.stdout.write(ok ? `Scaffolded primitives into ${paths.activeDesignSystem}/code.\n` : 'Skipped.\n');
      }
      break;
    }

    case 'diff':
    case 'compare':
    case 'conflicts':
    case 'use': {
      formatError('ds ' + ds.subcommand + ' — removed: each workspace has one design system. Use ds create/import to set it up.');
      process.exit(1);
      break;
    }

    case 'update': {
      const id = paths.activeDesignSystem;
      const nameIdx = ds.argv.indexOf('--name');
      const name = nameIdx >= 0 ? ds.argv[nameIdx + 1] : undefined;
      const descIdx = ds.argv.indexOf('--description');
      const description = descIdx >= 0 ? ds.argv[descIdx + 1] : undefined;
      if (!name && !description) {
        formatError('usage: emdesign ds update [--name <name>] [--description <text>]');
        process.exit(1);
      }
      const r = updateDesignSystem(paths, id, { name, description });
      out(r, ds.json);
      break;
    }

    case 'history': {
      const id = paths.activeDesignSystem;
      const rt = runtimeFor(paths);
      if (ds.argv.includes('--snapshot')) rt.snapshot(id);
      const h = rt.history(id);
      out(h, ds.json);
      break;
    }

    case 'customize': {
      const { customizeDesignSystem } = await import('@emdesign/backend');
      const nameIdx = ds.argv.indexOf('--name');
      const colorIdx = ds.argv.indexOf('--color');
      const fontIdx = ds.argv.indexOf('--font');
      const idIdx = ds.argv.indexOf('--id');
      // Brand-aware customization: allow --primary, --secondary, --body-font, --spacing
      const primaryIdx = ds.argv.indexOf('--primary');
      const secondaryIdx = ds.argv.indexOf('--secondary');
      const bodyFontIdx = ds.argv.indexOf('--body-font');
      const spacingIdx = ds.argv.indexOf('--spacing');

      const customizeOpts = {
        baseRef: normalizeDsRef(a1),
        id: idIdx >= 0 ? ds.argv[idIdx + 1] : a1,
        name: nameIdx >= 0 ? ds.argv[nameIdx + 1] : a1,
        customizations: {
          accentColor: colorIdx >= 0 ? ds.argv[colorIdx + 1] : primaryIdx >= 0 ? ds.argv[primaryIdx + 1] : undefined,
          headlineFont: fontIdx >= 0 ? ds.argv[fontIdx + 1] : undefined,
          bodyFont: bodyFontIdx >= 0 ? ds.argv[bodyFontIdx + 1] : undefined,
          surfaceColor: secondaryIdx >= 0 ? ds.argv[secondaryIdx + 1] : undefined,
          spacing: spacingIdx >= 0 ? Number(ds.argv[spacingIdx + 1]) : undefined,
        },
      };

      if (ds.trace) {
        const { withWorkflowSession } = await import('../lib/trace.js');
        await withWorkflowSession(ds.trace.bus, 'customize', ['fetch-base', 'apply-customizations', 'compile'], async (emitStage) => {
          const baseRef = customizeOpts.baseRef;
          emitStage('fetch-base', `Fetching base design system "${baseRef}"...`);
          const c = customizeDesignSystem(paths, customizeOpts);
          emitStage('apply-customizations', 'Applying brand customizations...');
          emitStage('compile', 'Compiling customized design tokens...');
          out(c, ds.json);
        });
      } else {
        const c = customizeDesignSystem(paths, customizeOpts);
        out(c, ds.json);
      }
      break;
    }

    case 'base-detail': {
      if (!a1) {
        formatError('usage: emdesign ds base-detail <id>');
        process.exit(1);
      }
      const { baseDetail } = await import('@emdesign/backend');
      const detail = baseDetail(paths, normalizeDsRef(a1));
      out(detail, ds.json);
      break;
    }

    case 'list':
    default: {
      const id = paths.activeDesignSystem;
      try {
        const info = getDesignSystemInfo(paths, id);
        if (ds.json) {
          formatJson(info);
        } else {
          process.stdout.write(`Active design system: "${info.name}" (${info.id})\n`);
          process.stdout.write(`  Tokens: ${info.tokens} · Primitives: ${info.primitives.length} · Lint: ${info.preset}\n`);
        }
      } catch {
        formatError(`No design system configured. Use 'ds create' or 'ds import'.`);
        process.exit(1);
      }
      break;
    }
  }
}

function out(v: unknown, json?: boolean): void {
  if (json) {
    formatJson(v);
  } else {
    process.stdout.write(typeof v === 'string' ? v + '\n' : JSON.stringify(v, null, 2) + '\n');
  }
}
