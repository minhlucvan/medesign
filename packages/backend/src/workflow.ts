/**
 * Workflow — in-memory workflow store and orchestrator for design-system creation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveRepoPaths, ensureDir, setActiveDesignSystem } from './paths.js';
import { parseDeclaredTokens } from './designContext.js';
import { baseTokensCss, scaffoldPrimitives, validateDesignSystem, manifestJson } from './scaffold.js';
import { buildAndSave } from './graph.js';
import { extractProject, type ExtractionResult } from './project/extract.js';
import { adoptProject } from './project/adopt.js';
import type { AdoptionReport } from './project/report.js';

export type StageStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

export interface WorkflowStage {
  name: string;
  status: StageStatus;
  progress: number; // 0–100
  error?: string;
}

export interface WorkflowSession {
  sessionId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  stages: WorkflowStage[];
  startedAt: string;
  error?: string;
  cancelled?: boolean;
}

/**
 * In-memory workflow progress store — keyed by session ID.
 */
export class WorkflowStore {
  private sessions = new Map<string, WorkflowSession>();

  create(id: string, stages: WorkflowStage[]): WorkflowSession {
    const session: WorkflowSession = {
      sessionId: id,
      status: 'running',
      stages: stages.map(s => ({ ...s })),
      startedAt: new Date().toISOString(),
    };
    this.sessions.set(id, session);
    return session;
  }

  updateStage(id: string, name: string, status: StageStatus, progress: number, error?: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    const stage = session.stages.find(s => s.name === name);
    if (stage) {
      stage.status = status;
      stage.progress = progress;
      if (error !== undefined) stage.error = error;
    }
    // Update overall session status
    if (status === 'error') session.status = 'failed';
    else if (session.stages.every(s => s.status === 'done')) session.status = 'completed';
  }

  get(id: string): WorkflowSession | undefined {
    return this.sessions.get(id);
  }

  cancel(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.status = 'cancelled';
    session.cancelled = true;
    for (const stage of session.stages) {
      if (stage.status === 'pending' || stage.status === 'running') {
        stage.status = 'cancelled';
      }
    }
  }
}

export interface WorkflowOrchestratorOptions {
  timeout?: number; // ms, default 120_000
}

export interface RunFromPromptInput {
  prompt: string;
  name?: string;
  id?: string;
}

export interface RunFromDesignMdInput {
  content: string;
  name?: string;
  id?: string;
}

export interface RunFromProjectInput {
  /** Absolute path to the source project to reverse-engineer. */
  projectPath: string;
  /** Workspace root the new design system is written into (defaults to cwd). */
  workspaceRoot?: string;
  name?: string;
  id?: string;
}

export interface RunResult {
  sessionId: string;
  completed: boolean;
  artifacts?: Record<string, string>;
  /** The adoption report (ds-from-project flow). */
  report?: AdoptionReport;
  /** Human-readable notes: documented defaults + DESIGN.md/code divergences. */
  notes?: string[];
  /** The stage that failed, when `completed` is false. */
  failedStage?: string;
  /** The failure reason, when `completed` is false. */
  error?: string;
}

/** Ordered stages of the ds-from-project workflow. */
const PROJECT_STAGE_NAMES = [
  'scan',
  'extract',
  'synthesize DESIGN.md',
  'tokens',
  'primitives',
  'adopt',
  'graph',
  'validate',
] as const;

/** Parse `--role: #hex` color declarations out of a DESIGN.md body. */
function parseDesignMdTokens(md: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g;
  for (let m = re.exec(md); m; m = re.exec(md)) out.set(m[1], m[2]);
  return out;
}

/** Synthesize a minimal DESIGN.md from extracted evidence (no canonical present). */
function synthesizeDesignMd(name: string, extraction: ExtractionResult): string {
  const colorLines = extraction.proposedRoles
    .filter((r) => r.role.startsWith('color-'))
    .map((r) => `- \`--${r.role}\`: ${r.evidence[0]?.value ?? ''}${r.source === 'default' ? ' (documented default)' : ''}`)
    .join('\n');
  return `---
name: ${name}
category: Adopted
surface: web
---

# ${name}

Synthesized from the design decisions found in an existing project.

## 2. Color
${colorLines}
`;
}

/** Build a complete tokens.css from the neutral base, applying role overrides. */
function buildProjectTokensCss(overrides: Map<string, string>): string {
  let css = baseTokensCss();
  for (const [role, value] of overrides) {
    const re = new RegExp(`(--${role}\\s*:\\s*)[^;]+;`);
    if (re.test(css)) css = css.replace(re, `$1${value};`);
    else css = css.replace(/\n\}/, `\n  --${role}: ${value};\n}`);
  }
  return css;
}

/**
 * Multi-stage workflow orchestrator for design-system generation.
 */
export class WorkflowOrchestrator {
  private store: WorkflowStore;
  private options: Required<WorkflowOrchestratorOptions>;
  private timeouts = new Map<string, NodeJS.Timeout>();
  /** Adoption reports produced by ds-from-project runs, keyed by session id. */
  private reports = new Map<string, AdoptionReport>();

  constructor(storeOrOptions?: WorkflowStore | WorkflowOrchestratorOptions, options?: WorkflowOrchestratorOptions) {
    if (storeOrOptions instanceof WorkflowStore) {
      this.store = storeOrOptions;
      this.options = { timeout: options?.timeout ?? 120_000 };
    } else {
      this.store = new WorkflowStore();
      this.options = { timeout: (storeOrOptions as WorkflowOrchestratorOptions)?.timeout ?? 120_000 };
    }
  }

  /** Run the create-from-prompt workflow stages. */
  async runFromPrompt(input: RunFromPromptInput): Promise<RunResult> {
    const sessionId = input.id ?? `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const stages: WorkflowStage[] = [
      { name: 'analyze', status: 'pending', progress: 0 },
      { name: 'generate-design-md', status: 'pending', progress: 0 },
      { name: 'generate-tokens', status: 'pending', progress: 0 },
      { name: 'scaffold-primitives', status: 'pending', progress: 0 },
      { name: 'build-graph', status: 'pending', progress: 0 },
      { name: 'validate', status: 'pending', progress: 0 },
    ];

    this.store.create(sessionId, stages);

    // Set timeout
    this.setTimeout(sessionId);

    // Check for immediate timeout
    if (this.options.timeout === 0) {
      this.store.updateStage(sessionId, 'analyze', 'error', 0, 'Workflow timeout');
      const session = this.store.get(sessionId);
      if (session) {
        session.status = 'failed';
        session.error = 'Workflow timeout';
      }
      this.clearTimeout(sessionId);
      return { sessionId, completed: false };
    }

    try {
      // Execute each stage sequentially
      await this.runStage(sessionId, 'analyze', 10);
      await this.runStage(sessionId, 'generate-design-md', 30);
      await this.runStage(sessionId, 'generate-tokens', 50);
      await this.runStage(sessionId, 'scaffold-primitives', 70);
      await this.runStage(sessionId, 'build-graph', 85);
      await this.runStage(sessionId, 'validate', 100);

      this.store.updateStage(sessionId, 'validate', 'done', 100);
      const session = this.store.get(sessionId);
      if (session) session.status = 'completed';
      this.clearTimeout(sessionId);

      return {
        sessionId,
        completed: true,
        artifacts: {
          'DESIGN.md': 'Generated from analysis',
          'tokens.css': 'Generated from DESIGN.md',
        },
      };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      this.store.updateStage(sessionId, 'analyze', 'error', 0, errMsg);
      const session = this.store.get(sessionId);
      if (session) session.status = 'failed';
      this.clearTimeout(sessionId);
      return { sessionId, completed: false };
    }
  }

  /** Run the create-from-design-md workflow stages. */
  async runFromDesignMd(input: RunFromDesignMdInput): Promise<RunResult> {
    const sessionId = input.id ?? `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const stages: WorkflowStage[] = [
      { name: 'parse', status: 'pending', progress: 0 },
      { name: 'extract-tokens', status: 'pending', progress: 0 },
      { name: 'generate-tokens-css', status: 'pending', progress: 0 },
      { name: 'scaffold-primitives', status: 'pending', progress: 0 },
      { name: 'build-graph', status: 'pending', progress: 0 },
      { name: 'validate', status: 'pending', progress: 0 },
    ];

    this.store.create(sessionId, stages);

    // Check for immediate cancellation (timeout=0)
    if (this.options.timeout === 0) {
      this.store.updateStage(sessionId, 'parse', 'error', 0, 'Workflow timed out');
      const session = this.store.get(sessionId);
      if (session) session.status = 'failed';
      return { sessionId, completed: false };
    }

    try {
      await this.runStage(sessionId, 'parse', 15);
      await this.runStage(sessionId, 'extract-tokens', 35);
      await this.runStage(sessionId, 'generate-tokens-css', 55);
      await this.runStage(sessionId, 'scaffold-primitives', 75);
      await this.runStage(sessionId, 'build-graph', 90);
      await this.runStage(sessionId, 'validate', 100);

      const session = this.store.get(sessionId);
      if (session) session.status = 'completed';

      return { sessionId, completed: true };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      this.store.updateStage(sessionId, 'parse', 'error', 0, errMsg);
      const session = this.store.get(sessionId);
      if (session) session.status = 'failed';
      return { sessionId, completed: false };
    }
  }

  /**
   * Run the ds-from-project workflow: scan → extract → synthesize DESIGN.md →
   * tokens → primitives → adopt → graph → validate. Streams per-stage progress
   * into the store. Registers the system in `emdesign.config.json` (and writes a
   * `source.type: "project"` manifest) ONLY after `validate` passes; on any
   * stage failure it stops and registers nothing (removing any partial dir).
   */
  async runFromProject(sessionId: string, input: RunFromProjectInput): Promise<RunResult> {
    const stages: WorkflowStage[] = PROJECT_STAGE_NAMES.map((name) => ({
      name,
      status: 'pending' as StageStatus,
      progress: 0,
    }));
    this.store.create(sessionId, stages);

    const workspaceRoot = input.workspaceRoot ?? process.cwd();
    const paths = resolveRepoPaths(workspaceRoot);
    const id = input.id ?? `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const name = input.name ?? id;
    const dir = path.join(paths.designSystemsDir, id);

    const notes: string[] = [];
    const artifacts: Record<string, string> = {};
    let report: AdoptionReport | undefined;
    let extraction: ExtractionResult | undefined;
    let designMd = '';
    let canonical = false;
    let tokensCss = '';
    let currentStage: (typeof PROJECT_STAGE_NAMES)[number] = 'scan';

    const stage = async (
      n: (typeof PROJECT_STAGE_NAMES)[number],
      progress: number,
      fn: () => void | Promise<void>,
    ): Promise<void> => {
      currentStage = n;
      this.store.updateStage(sessionId, n, 'running', Math.max(0, progress - 5));
      await fn();
      this.store.updateStage(sessionId, n, 'done', progress);
    };

    try {
      await stage('scan', 5, () => {
        if (!fs.existsSync(input.projectPath) || !fs.statSync(input.projectPath).isDirectory()) {
          throw new Error(`Project path not found or not a directory: ${input.projectPath}`);
        }
      });

      await stage('extract', 15, () => {
        extraction = extractProject(input.projectPath);
      });

      await stage('synthesize DESIGN.md', 30, () => {
        const existing = path.join(input.projectPath, 'DESIGN.md');
        if (fs.existsSync(existing)) {
          designMd = fs.readFileSync(existing, 'utf8');
          canonical = true;
        } else {
          designMd = synthesizeDesignMd(name, extraction!);
        }
        artifacts['DESIGN.md'] = designMd;
        ensureDir(dir);
        fs.writeFileSync(path.join(dir, 'DESIGN.md'), designMd);
      });

      await stage('tokens', 45, () => {
        const overrides = new Map<string, string>();
        for (const r of extraction!.proposedRoles) {
          if (r.source === 'extracted' && r.evidence.length) {
            overrides.set(r.role, r.evidence[0].value);
          } else if (r.source === 'default') {
            notes.push(
              `--${r.role} could not be confidently inferred; using documented default ${r.evidence[0]?.value}.`,
            );
          }
        }
        if (canonical) {
          // The existing DESIGN.md is canonical: its values win and divergences are recorded.
          for (const [role, val] of parseDesignMdTokens(designMd)) {
            const codeVal = overrides.get(role);
            if (codeVal && codeVal.toLowerCase() !== val.toLowerCase()) {
              notes.push(`--${role}: DESIGN.md value ${val} overrides / diverges from code value ${codeVal}.`);
            }
            overrides.set(role, val);
          }
        }
        tokensCss = buildProjectTokensCss(overrides);
        artifacts['tokens.css'] = tokensCss;
        fs.writeFileSync(path.join(dir, 'tokens.css'), tokensCss);
      });

      await stage('primitives', 60, () => {
        scaffoldPrimitives(paths, id, 'atelier');
      });

      await stage('adopt', 75, () => {
        report = adoptProject({
          projectRoot: input.projectPath,
          componentsDir: paths.componentsDir,
          proposedRoles: extraction!.proposedRoles,
          declaredTokens: parseDeclaredTokens(tokensCss),
        });
      });

      await stage('graph', 88, () => {
        buildAndSave(paths, id);
      });

      await stage('validate', 100, () => {
        const v = validateDesignSystem(paths, id);
        if (!v.ok) throw new Error(`Design system validation failed: ${v.note}`);
      });

      // Register ONLY after validate passes: write the project-sourced manifest and
      // point the workspace config at the new system.
      fs.writeFileSync(
        path.join(dir, 'manifest.json'),
        manifestJson(id, name, {
          category: 'Adopted',
          description: `Adopted from an existing project (${input.projectPath}).`,
          source: { type: 'project', skill: 'ds-from-project', upstream: input.projectPath },
        }),
      );
      setActiveDesignSystem(paths.root, id);

      if (report) this.reports.set(sessionId, report);
      const session = this.store.get(sessionId);
      if (session) session.status = 'completed';

      return { sessionId, completed: true, artifacts, report, notes };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      this.store.updateStage(sessionId, currentStage, 'error', 0, errMsg);
      const session = this.store.get(sessionId);
      if (session) {
        session.status = 'failed';
        session.error = errMsg;
      }
      // Register nothing on failure: drop any partial system directory.
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* nothing to clean */ }
      return { sessionId, completed: false, failedStage: currentStage, error: errMsg, notes };
    }
  }

  /** The adoption report for a completed ds-from-project session, if any. */
  getReport(sessionId: string): AdoptionReport | undefined {
    return this.reports.get(sessionId);
  }

  /** Cancel a running workflow. */
  async cancel(sessionId: string): Promise<void> {
    this.store.cancel(sessionId);
    this.clearTimeout(sessionId);
  }

  /** Get the underlying session data. */
  getSession(sessionId: string): WorkflowSession | undefined {
    return this.store.get(sessionId);
  }

  /** Expose the underlying store for SSE streaming. */
  getStore(): WorkflowStore {
    return this.store;
  }

  private async runStage(sessionId: string, name: string, progress: number): Promise<void> {
    const session = this.store.get(sessionId);
    if (!session || session.cancelled || session.status === 'cancelled') {
      throw new Error('Workflow cancelled');
    }
    if (session.status === 'failed') {
      throw new Error(session.error || 'Workflow failed');
    }
    this.store.updateStage(sessionId, name, 'running', progress);
    // Simulate async work
    await new Promise(resolve => setImmediate(resolve));
    this.store.updateStage(sessionId, name, 'done', progress);
  }

  private setTimeout(sessionId: string): void {
    const timer = setTimeout(() => {
      const session = this.store.get(sessionId);
      if (session && session.status === 'running') {
        session.status = 'failed';
        session.error = 'Workflow timed out';
      }
    }, this.options.timeout);
    this.timeouts.set(sessionId, timer);
  }

  private clearTimeout(sessionId: string): void {
    const timer = this.timeouts.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.timeouts.delete(sessionId);
    }
  }
}
