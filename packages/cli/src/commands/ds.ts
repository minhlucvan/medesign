import fs from 'node:fs';
import path from 'node:path';
import type { RepoPaths, Store } from '@emdesign/backend';
import {
  createDesignSystem,
  applyDesignSystem,
  listDesignSystems,
  listBases,
  gradeDesignSystem,
  renderGrade,
  runtimeFor,
  normalizeDsRef,
  validateDesignSystem,
  updateDesignSystem,
  diffDesignSystems,
  compileDesignSystem,
  exportDesignSystem,
  resolveDesignSystem,
  composePrompt,
  effectiveAdapter,
  loadOrBuild,
  overlayGenerated,
  ensureDir,
  searchDesignSystems,
  importAwesomeDesign,
  importGitDesign,
  importProjectDesign,
  summarizeReport,
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
      const id = paths.activeDesignSystem;
      const tokenCheck = validateDesignSystem(paths, id);
      const dsrCheck = runtimeFor(paths).validate(id);
      const enriched = {
        id,
        ok: tokenCheck.ok && dsrCheck.ok,
        declared: tokenCheck.declared,
        missingRoles: tokenCheck.missingRoles,
        note: tokenCheck.note,
        diagnostics: dsrCheck.diagnostics,
      };
      if (ds.json) {
        formatJson(enriched);
      } else {
        process.stdout.write(
          `Design system: ${id}\n` +
          `Token contract: ${tokenCheck.ok ? '✅ complete' : '❌ incomplete'} (${tokenCheck.declared} declared roles)\n` +
          (tokenCheck.missingRoles.length > 0 ? `  Missing roles: ${tokenCheck.missingRoles.join(', ')}\n` : '') +
          `DSR diagnostics: ${dsrCheck.diagnostics.length} issues (${dsrCheck.diagnostics.filter(d => d.severity === 'P0').length} P0)\n`
        );
      }
      if (ds.gate && !enriched.ok) process.exit(1);
      // Strict mode: fail on warnings too
      if (ds.argv.includes('--strict') && (tokenCheck.missingRoles.length > 0 || dsrCheck.diagnostics.length > 0)) {
        process.exit(1);
      }
      break;
    }

    case 'audit': {
      const auditId = a1 || paths.activeDesignSystem;
      if (!auditId) { formatError('usage: emdesign ds audit <id> [--fix] [--json]'); process.exit(1); }
      const fixMode = ds.argv.includes('--fix');
      const strictMode = ds.argv.includes('--strict');
      const report = auditDesignSystem(paths, auditId, { fix: fixMode });
      if (ds.json) {
        formatJson(report);
      } else {
        process.stdout.write(
          `═══ Audit: ${auditId} ═══\n\n` +
          `Token Contract:        ${report.summary.tokens.pass === report.summary.tokens.total ? '✅' : '❌'} ${report.summary.tokens.pass}/${report.summary.tokens.total}\n` +
          `DESIGN.md Quality:     ${report.summary.designMd.pass === report.summary.designMd.total ? '✅' : '❌'} ${report.summary.designMd.pass}/${report.summary.designMd.total}\n` +
          `Taste Alignment:       ${report.summary.taste.pass === report.summary.taste.total ? '✅' : '❌'} ${report.summary.taste.pass}/${report.summary.taste.total}\n` +
          `Lint Rules:            ${report.summary.lint.pass === report.summary.lint.total ? '✅' : '❌'} ${report.summary.lint.pass}/${report.summary.lint.total}\n` +
          `Preview:               ${report.summary.preview.pass === report.summary.preview.total ? '✅' : '❌'} ${report.summary.preview.pass}/${report.summary.preview.total}\n` +
          `\nScore: ${report.score}/100 — ${report.ok ? '✅ PASS' : '❌ FAIL'}\n`
        );
        const failing = report.findings.filter(f => !f.pass).slice(0, 5);
        if (failing.length > 0) {
          process.stdout.write(`\nIssues (${report.findings.filter(f => !f.pass).length} total, showing first ${failing.length}):\n`);
          for (const f of failing) {
            process.stdout.write(`  [${f.severity}] ${f.dimension}: ${f.message}\n`);
            if (f.fix) process.stdout.write(`         → Fixed: ${f.fix}\n`);
          }
        } else {
          process.stdout.write(`\nNo issues found.\n`);
        }
      }
      if ((strictMode || ds.gate) && !report.ok) process.exit(1);
      break;
    }

    case 'compile': {
      const id = paths.activeDesignSystem;
      const r = compileDesignSystem(paths, id);
      const outDir = ds.argv.includes('--out') ? ds.argv[ds.argv.indexOf('--out') + 1] : undefined;
      if (outDir) {
        ensureDir(outDir);
        fs.writeFileSync(path.join(outDir, 'tokens.ts'), r.files.tokensTs);
        fs.writeFileSync(path.join(outDir, 'types.ts'), r.files.typesTs);
        fs.writeFileSync(path.join(outDir, 'tokens.css'), r.files.tokensCss);
      }
      if (ds.json) {
        formatJson(r);
      } else {
        process.stdout.write(`${id}: ${r.note}\n`);
        for (const [cat, toks] of Object.entries(r.categories)) {
          process.stdout.write(`  ${cat}: ${toks!.length} tokens\n`);
        }
      }
      break;
    }

    case 'export': {
      const id = paths.activeDesignSystem;
      const outDir = ds.argv.includes('--out') ? ds.argv[ds.argv.indexOf('--out') + 1] : undefined;
      const r = exportDesignSystem(paths, id, outDir);
      out(r, ds.json);
      break;
    }

    case 'version': {
      const bump = a1 as 'major' | 'minor' | 'patch' | undefined;
      if (!bump || !['major', 'minor', 'patch'].includes(bump)) {
        formatError('usage: emdesign ds version <major|minor|patch>');
        process.exit(1);
      }
      const id = paths.activeDesignSystem;
      // Read manifest from the design system directory
      const dsPath = path.join(process.cwd(), 'design-systems', ...normalizeDsRef(id).split('/'));
      const manifestFile = path.join(dsPath, 'manifest.json');
      if (!fs.existsSync(manifestFile)) {
        formatError(`No manifest found for ${id} at ${manifestFile}`);
        process.exit(1);
      }
      const m = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      const current = m.version ?? '0.1.0';
      const parts = current.split('.').map(Number);
      if (bump === 'major') parts[0]++; else if (bump === 'minor') parts[1]++; else parts[2]++;
      m.version = parts.join('.');
      fs.writeFileSync(manifestFile, JSON.stringify(m, null, 2) + '\n');
      const r = { id, previousVersion: current, version: m.version };
      out(r, ds.json);
      break;
    }

    case 'changelog': {
      const id = paths.activeDesignSystem;
      const rt = runtimeFor(paths);
      const h = rt.history(id);
      if (ds.json) {
        formatJson({ id, history: h });
      } else {
        if (!h || (Array.isArray(h) && h.length === 0)) {
          process.stdout.write(`No changelog entries for ${id}. Use --snapshot to create one.\n`);
        } else {
          process.stdout.write(`Changelog for ${id}:\n`);
          for (const entry of (Array.isArray(h) ? h : [h])) {
            process.stdout.write(`  - ${JSON.stringify(entry)}\n`);
          }
        }
      }
      break;
    }

    case 'grade': {
      const id = paths.activeDesignSystem;
      const timeoutIdx = ds.argv.indexOf('--timeout');
      const timeoutMs = timeoutIdx >= 0 ? Number(ds.argv[timeoutIdx + 1]) : 120_000;
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(new Error(`grade timed out after ${timeoutMs}ms`)), timeoutMs);
      try {
        const r = await gradeDesignSystem(paths, id, { signal: ac.signal });
        const report = renderGrade(r);
        if (ds.json) {
          formatJson({ grade: r.grade, matchesGrade: r.matchesGrade, report });
        } else {
          process.stdout.write(report + '\n');
        }
        if (ds.gate && !r.matchesGrade) process.exit(1);
      } finally {
        clearTimeout(timer);
      }
      break;
    }

    // ── V3: Registry & Search ─────────────────────────────────────────
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
      if (importSrc === 'awesome') {
        if (ds.trace) {
          const { withWorkflowSession } = await import('../lib/trace.js');
          await withWorkflowSession(ds.trace.bus, 'import-awesome', ['fetch', 'parse', 'apply', 'compile'], async (emitStage) => {
            emitStage('fetch', `Fetching "${importId}" from awesome registry...`);
            const r = await importAwesomeDesign(paths, importId, { name: importName });
            emitStage('parse', 'Parsing design tokens...');
            emitStage('apply', 'Applying token overrides...');
            emitStage('compile', 'Compiling output...');
            out(r, ds.json);
          });
        } else {
          const r = await importAwesomeDesign(paths, importId, { name: importName });
          out(r, ds.json);
        }
      } else if (importSrc === 'git') {
        const ref = ds.argv.includes('--ref') ? ds.argv[ds.argv.indexOf('--ref') + 1] : undefined;
        const subPath = ds.argv.includes('--path') ? ds.argv[ds.argv.indexOf('--path') + 1] : undefined;
        const r = await importGitDesign(paths, importId, { ref, path: subPath, name: importName });
        out(r, ds.json);
      } else if (importSrc === 'vendor') {
        // Reuse existing --mode import
        const fromBase = `open-design/${importId}`;
        const r = createDesignSystem(paths, { id: importName ?? importId, mode: 'import', from: fromBase });
        out(r, ds.json);
      } else if (importSrc === 'project') {
        // Reverse-engineer an existing project into a design system + adopt its components.
        const projectPath = path.resolve(importId);
        const idIdx = ds.argv.indexOf('--id');
        const idOpt = idIdx >= 0 ? ds.argv[idIdx + 1] : undefined;
        // Stage progress goes to stderr in --json mode so stdout stays clean JSON.
        const progress = ds.json ? process.stderr : process.stdout;
        let result;
        try {
          result = await importProjectDesign(paths, projectPath, { name: importName, id: idOpt });
        } catch (e) {
          formatError(`ds import project failed: ${e instanceof Error ? e.message : String(e)}`);
          process.exit(1);
          return;
        }
        for (const s of result.stages) {
          progress.write(`  ${s.name}: ${s.status}\n`);
        }
        if (ds.json) {
          formatJson(result.report);
        } else {
          process.stdout.write(summarizeReport(result.report) + '\n');
        }
        if (ds.gate && result.gate !== 'pass') process.exit(1);
      } else {
        formatError(`Unknown import source: ${importSrc}. Use: awesome, git, vendor, project`);
        process.exit(1);
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
    case 'compare': {
      const id1 = a1 ? normalizeDsRef(a1) : normalizeDsRef(paths.activeDesignSystem);
      const id2 = a2 ? normalizeDsRef(a2) : a1 ? normalizeDsRef(a1) : normalizeDsRef(paths.activeDesignSystem);
      if (!id1 || !id2 || id1 === id2) {
        formatError('usage: emdesign ds diff — removed in single-DS mode');
        process.exit(1);
      }
      const r = diffDesignSystems(paths, id1, id2);
      if (ds.json) {
        formatJson(r);
      } else {
        process.stdout.write(r.note + '\n');
        if (r.onlyIn1.length > 0) process.stdout.write(`Only in ${id1}: ${r.onlyIn1.join(', ')}\n`);
        if (r.onlyIn2.length > 0) process.stdout.write(`Only in ${id2}: ${r.onlyIn2.join(', ')}\n`);
      }
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

    case 'conflicts': {
      const id = paths.activeDesignSystem;
      const r = runtimeFor(paths).conflicts(normalizeDsRef(id));
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
      const systems = listDesignSystems(paths);
      out(systems, ds.json);
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
