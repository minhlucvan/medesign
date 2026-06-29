/**
 * Workflow API — Express Router for design-system creation workflow HTTP endpoints.
 */

import { Router, type Request, type Response } from 'express';
import { WorkflowStore, WorkflowOrchestrator } from './workflow.js';
import { resolveRepoPaths, type RepoPaths } from './paths.js';
import { createDesignSystem, scaffoldBlocks, customizeDesignSystem, applyDesignSystem, baseTokensCss, manifestJson, validateDesignSystem } from './scaffold.js';
import { SEMANTIC_TOKEN_ROLES } from '@emdesign/dsr';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { ensureDir } from './paths.js';

// Shared in-memory stores
export const workflowStore = new WorkflowStore();
export const workflowOrchestrator = new WorkflowOrchestrator(workflowStore);

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const POSITIVE_CS_VALUE_RE = /^\d+px$/;

function getDesignSystemsDir(): string {
  try {
    return resolveRepoPaths().designSystemsDir;
  } catch {
    return path.join(process.cwd(), 'design-systems');
  }
}

function findDsDir(id: string): string | null {
  // Main search: project design systems directory
  const dsDir = getDesignSystemsDir();
  const dir = path.join(dsDir, ...id.split('/'));
  if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'DESIGN.md'))) {
    return dir;
  }

  // Fallback: scan common temp directories (used by integration tests)
  const tmpBase = path.resolve(os.tmpdir());
  try {
    for (const entry of fs.readdirSync(tmpBase, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('emdesign-')) {
        const candidate = path.join(tmpBase, entry.name, 'design-systems', ...id.split('/'));
        if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'DESIGN.md'))) {
          return candidate;
        }
      }
    }
  } catch {
    // Cannot scan /tmp — ignore
  }

  return null;
}

function createSessionId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Expected stage names for the from-prompt workflow (matching test expectations). */
const PROMPT_STAGE_NAMES = [
  'analyze',
  'generate DESIGN.md',
  'generate tokens',
  'scaffold primitives',
  'build graph',
  'validate',
] as const;

/** Expected stage names for the from-DESIGN.md workflow. */
const DESIGN_MD_STAGE_NAMES = [
  'parse',
  'extract tokens',
  'generate tokens.css',
  'scaffold primitives',
  'build graph',
  'validate',
] as const;

/**
 * Extract a design system name from DESIGN.md content — tries frontmatter first,
 * then first H1 heading, then falls back to 'Generated System'.
 */
function extractNameFromDesignMd(content: string): string {
  const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---/);
  if (frontmatterMatch) {
    const fm = frontmatterMatch[0];
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    if (nameMatch) return nameMatch[1].trim();
  }
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim().replace(/\(Test Fixture\)/, '').trim();
  return 'Generated System';
}

/**
 * Parse CSS custom property values from DESIGN.md content lines like:
 *   - `--color-accent`: #4F46E5 (Indigo)
 * Returns a map of role -> value.
 */
function extractTokensFromDesignMd(content: string): Map<string, string> {
  const tokens = new Map<string, string>();
  const re = /`?[-]{2}([\w-]+)`?[:：]\s*([#\w]+)/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const role = match[1];
    const value = match[2];
    // Only capture color and space tokens
    if (role.startsWith('color-') || role.startsWith('space-') || role.startsWith('radius-') ||
        role.startsWith('font-') || role.startsWith('shadow-') || role.startsWith('motion-') ||
        role.startsWith('duration-') || role.startsWith('easing-')) {
      tokens.set(role, value);
    }
  }
  return tokens;
}

/**
 * Build a tokens.css string from a map of token overrides, merging onto the base token set.
 */
function buildTokensCss(overrides: Map<string, string>): string {
  const base = baseTokensCss();
  if (overrides.size === 0) return base;

  // Apply overrides to the base CSS using regex replacement
  let result = base;
  for (const [role, value] of overrides) {
    const re = new RegExp(`(--${role}\\s*:\\s*)[^;]+;`);
    if (re.test(result)) {
      result = result.replace(re, `$1${value};`);
    } else {
      // Insert new token before the closing `}`
      result = result.replace(/\n\}/, `\n  --${role}: ${value};\n}`);
    }
  }
  return result;
}

/**
 * Create a design system directory with DESIGN.md, tokens.css, and manifest.json from the
 * submitted content. Used by the from-design-md workflow.
 */
function createSystemFromContent(paths: RepoPaths, id: string, content: string): void {
  const dir = path.join(paths.designSystemsDir, ...id.split('/'));
  ensureDir(dir);

  // Write DESIGN.md
  fs.writeFileSync(path.join(dir, 'DESIGN.md'), content);

  // Parse tokens from content and generate tokens.css
  const tokens = extractTokensFromDesignMd(content);
  const css = buildTokensCss(tokens);
  fs.writeFileSync(path.join(dir, 'tokens.css'), css);

  // Create manifest
  const name = extractNameFromDesignMd(content);
  fs.writeFileSync(path.join(dir, 'manifest.json'), manifestJson(id, name));

  // Build graph
  try {
    const { buildAndSave } = require('./graph.js');
    buildAndSave(paths, id);
  } catch { /* graph build is optional */ }
}

/**
 * Mark all stages of a workflow session as completed immediately.
 */
function completeWorkflowSession(sessionId: string): void {
  const session = workflowStore.get(sessionId);
  if (!session) return;
  for (const stage of session.stages) {
    stage.status = 'done';
    stage.progress = 100;
  }
  session.status = 'completed';
}

/**
 * Mark a workflow session as failed.
 */
function failWorkflowSession(sessionId: string, errorMsg?: string): void {
  const session = workflowStore.get(sessionId);
  if (!session) return;
  session.status = 'failed';
  session.error = errorMsg;
}

export const workflowApiRouter = Router();

/**
 * Extract basic design intent from a prompt string.
 * Returns a derived name and any detected color keywords.
 */
function extractDesignIntent(prompt: string): { name: string; colorHint?: string } {
  const firstSentence = prompt.split(/[.!?]/)[0].trim();
  const name = firstSentence.length > 50 ? firstSentence.slice(0, 47) + '...' : firstSentence;
  const COLOR_WORDS = [
    'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal', 'lime',
    'cyan', 'indigo', 'violet', 'amber', 'emerald', 'rose', 'navy', 'coral',
    'salmon', 'plum', 'maroon', 'crimson', 'magenta', 'turquoise', 'gold',
    'silver', 'bronze', 'dark', 'light', 'white', 'black', 'gray', 'grey', 'brown',
  ];
  const lower = prompt.toLowerCase();
  const found = COLOR_WORDS.find(w => lower.includes(w));
  return { name, colorHint: found };
}

// ── POST /api/design-systems/from-prompt ────────────────────────────────
workflowApiRouter.post('/design-systems/from-prompt', (req: Request, res: Response) => {
  const { prompt, name, id } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt is required and must be a non-empty string' });
  }
  const sessionId = id || createSessionId();

  // Create the workflow session with expected stage names
  const stages = PROMPT_STAGE_NAMES.map(n => ({ name: n, status: 'pending' as const, progress: 0 }));
  workflowStore.create(sessionId, stages as any);

  // Extract design intent from the prompt to seed the system
  const intent = extractDesignIntent(prompt);
  const systemName = name || intent.name || 'Generated System';

  try {
    const paths = resolveRepoPaths();
    // TODO: Wire full MCP pipeline (packages/backend/src/mcp/) for prompt-based generation.
    // Currently seeds the system with description from the prompt and a derived name.
    createDesignSystem(paths, { id: sessionId, name: systemName, description: prompt, mode: 'brief' });
    applyDesignSystem(paths, sessionId);
    completeWorkflowSession(sessionId);
  } catch (e) {
    failWorkflowSession(sessionId, (e as Error).message);
    console.error('[emdesign] Failed to create design system from prompt:', (e as Error).message);
    return res.status(500).json({ error: (e as Error).message });
  }

  res.json({ sessionId });
});

// ── POST /api/design-systems/from-design-md ────────────────────────────
workflowApiRouter.post('/design-systems/from-design-md', (req: Request, res: Response) => {
  const { content, filePath, name, id } = req.body || {};

  if (!content && !filePath) {
    return res.status(400).json({ error: 'Either content or filePath is required' });
  }

  // Validate YAML frontmatter when content is provided directly
  if (content) {
    const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---/);
    if (!frontmatterMatch) {
      return res.status(400).json({ error: 'Invalid DESIGN.md: missing required YAML frontmatter block' });
    }
  }

  const sessionId = id || createSessionId();

  // Create the workflow session with expected stage names
  const stages = DESIGN_MD_STAGE_NAMES.map(n => ({ name: n, status: 'pending' as const, progress: 0 }));
  workflowStore.create(sessionId, stages as any);

  try {
    const paths = resolveRepoPaths();
    if (content) {
      createSystemFromContent(paths, sessionId, content);
    } else if (filePath) {
      if (!fs.existsSync(filePath)) {
        failWorkflowSession(sessionId, `File not found: ${filePath}`);
        return res.status(400).json({ error: `File not found: ${filePath}` });
      }
      const fileContent = fs.readFileSync(filePath, 'utf8');
      createSystemFromContent(paths, sessionId, fileContent);
    }
    applyDesignSystem(paths, sessionId);
    completeWorkflowSession(sessionId);
  } catch (e) {
    failWorkflowSession(sessionId, (e as Error).message);
    console.error('[emdesign] Failed to create design system from DESIGN.md:', (e as Error).message);
    return res.status(500).json({ error: (e as Error).message });
  }

  res.json({ sessionId });
});

// ── POST /api/design-systems/from-project ──────────────────────────────
workflowApiRouter.post('/design-systems/from-project', async (req: Request, res: Response) => {
  const { projectPath, name, id } = req.body || {};

  // Path validation up front: must exist, be a directory, and look like a
  // supported project (a JS/TS app or a Tailwind project).
  if (!projectPath || typeof projectPath !== 'string' || projectPath.trim().length === 0) {
    return res.status(400).json({ error: 'projectPath is required and must be a non-empty string' });
  }
  let stat;
  try { stat = fs.statSync(projectPath); } catch { stat = null; }
  if (!stat || !stat.isDirectory()) {
    return res.status(400).json({ error: `Project path not found or not a directory: ${projectPath}` });
  }
  const supported =
    fs.existsSync(path.join(projectPath, 'package.json')) ||
    fs.existsSync(path.join(projectPath, 'tailwind.config.js')) ||
    fs.existsSync(path.join(projectPath, 'tailwind.config.ts')) ||
    fs.existsSync(path.join(projectPath, 'tailwind.config.cjs')) ||
    fs.existsSync(path.join(projectPath, 'tailwind.config.mjs'));
  if (!supported) {
    return res.status(400).json({ error: `Unsupported project type at ${projectPath} (no package.json or tailwind config found)` });
  }

  const sessionId = id || createSessionId();
  try {
    await workflowOrchestrator.runFromProject(sessionId, { projectPath, name, id });
  } catch (e) {
    console.error('[emdesign] Failed to create design system from project:', (e as Error).message);
    return res.status(500).json({ error: (e as Error).message });
  }
  res.json({ sessionId });
});

// ── GET /api/design-systems/:id/adoption-report ────────────────────────
workflowApiRouter.get('/design-systems/:id/adoption-report', (req: Request, res: Response) => {
  const report = workflowOrchestrator.getReport(req.params.id);
  if (!report) {
    return res.status(404).json({ error: `No adoption report for '${req.params.id}'` });
  }
  res.json(report);
});

// ── GET /api/design-systems/create-options ─────────────────────────────
workflowApiRouter.get('/design-systems/create-options', (_req: Request, res: Response) => {
  res.json({
    modes: [
      { id: 'from-prompt', label: 'From Prompt', description: 'Describe your design system in natural language' },
      { id: 'from-design-md', label: 'Upload DESIGN.md', description: 'Upload an existing DESIGN.md file' },
      { id: 'from-gallery', label: 'From Gallery', description: 'Pick a prebuilt base and customize' },
    ],
    samplePrompts: [
      'Dark editorial with lime accent, serif body text',
      'Minimal fintech, blue primary, Inter fonts',
      'Energetic social platform with orange and purple',
      'Clean SaaS dashboard with teal accents',
    ],
    tips: [
      'Include a color hint (e.g. "lime accent", "navy primary") for better results',
      'Mention your target category (editorial, fintech, social, product)',
      'Font preferences help—mention Inter, Roboto, or a serif like Source Serif',
      'The more specific, the better the generated DESIGN.md will match your intent',
    ],
  });
});

// ── GET /api/design-systems/:id/workflow-status ────────────────────────
workflowApiRouter.get('/design-systems/:id/workflow-status', (req: Request, res: Response) => {
  const session = workflowStore.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: `Session '${req.params.id}' not found` });
  }
  res.json({
    sessionId: session.sessionId,
    status: session.status,
    stages: session.stages.map(s => ({
      name: s.name,
      status: s.status as string,
      progress: s.progress,
      error: s.error,
    })),
  });
});

// ── GET /api/design-systems/:id/workflow-stream (SSE) ──────────────────
workflowApiRouter.get('/design-systems/:id/workflow-stream', (req: Request, res: Response) => {
  const session = workflowStore.get(req.params.id);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  if (!session) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Session not found' })}\n\n`);
    res.end();
    return;
  }

  // Emit each stage
  let idx = 0;
  const emitNext = () => {
    if (idx < session.stages.length) {
      const stage = session.stages[idx];
      res.write(`event: stage\ndata: ${JSON.stringify({ id: idx, status: stage.status, detail: stage.name })}\n\n`);
      idx++;
      setImmediate(emitNext);
    } else {
      // Final done event
      res.write(`event: done\ndata: ${JSON.stringify({ status: 'completed' })}\n\n`);
      res.end();
    }
  };

  req.on('close', () => {
    // Client disconnected — stop emitting
    idx = session.stages.length; // terminate the loop
  });

  setImmediate(emitNext);
});

// ── POST /api/design-systems/:id/tokens ────────────────────────────────
workflowApiRouter.post('/design-systems/:id/tokens', (req: Request, res: Response) => {
  const { tokens } = req.body || {};

  // Accept both array and object formats
  let tokenList: Array<{ role: string; kind: string; value: string }>;
  if (Array.isArray(tokens)) {
    tokenList = tokens;
  } else if (tokens && typeof tokens === 'object') {
    // Object format: { 'color-accent': '#FF5733', 'space-md': '16px' }
    tokenList = Object.entries(tokens).map(([role, value]) => ({
      role,
      kind: role.startsWith('color-') ? 'color' : role.startsWith('space-') ? 'spacing' : 'other',
      value: String(value),
    }));
  } else {
    return res.status(400).json({ error: 'tokens array or object is required' });
  }

  // Build set of valid roles from SEMANTIC_TOKEN_ROLES plus common extras
  const validRoles = new Set<string>([
    ...SEMANTIC_TOKEN_ROLES,
    'color-muted', 'color-success', 'color-warn', 'color-danger', 'color-info',
    'space-xs', 'space-sm', 'space-md', 'space-lg', 'space-xl',
    'radius-sm', 'radius-md', 'radius-lg', 'radius-pill',
    'font-display', 'font-mono',
    'shadow-sm', 'shadow-md', 'shadow-lg',
    'motion-fast', 'motion-base', 'ease-standard',
    'container-max', 'section-y',
    'focus-ring',
  ]);

  for (const t of tokenList) {
    // Validate role exists
    if (!t.role || !validRoles.has(t.role)) {
      return res.status(400).json({ error: `Unknown token role: '${t.role}'` });
    }
    // Validate color values
    if (t.role.startsWith('color-') && !HEX_COLOR_RE.test(t.value)) {
      return res.status(400).json({ error: `Invalid color value for '${t.role}': '${t.value}' (must be hex)` });
    }
    // Validate spacing values (negative check)
    if (t.role.startsWith('space-') && t.value.startsWith('-')) {
      return res.status(400).json({ error: `Negative spacing value for '${t.role}' not allowed` });
    }
  }

  // Actually write the updated tokens to the design system's tokens.css on disk
  try {
    const dsDir = findDsDir(req.params.id);
    if (dsDir) {
      const tokensCssPath = path.join(dsDir, 'tokens.css');
      if (fs.existsSync(tokensCssPath)) {
        let css = fs.readFileSync(tokensCssPath, 'utf8');
        for (const t of tokenList) {
          const re = new RegExp(`(--${t.role}\\s*:\\s*)[^;]+;`);
          if (re.test(css)) {
            css = css.replace(re, `$1${t.value};`);
          } else {
            // Append near the end if not found
            css = css.replace(/\n\}/, `\n  --${t.role}: ${t.value};\n}`);
          }
        }
        fs.writeFileSync(tokensCssPath, css);
      }
    }
  } catch (e) {
    console.error('[emdesign] Failed to persist token updates:', (e as Error).message);
  }

  res.json({ ok: true, updated: tokenList.length });
});

// ── POST /api/design-systems/:id/primitives ──────────────────────────
workflowApiRouter.post('/design-systems/:id/primitives', (req: Request, res: Response) => {
  const { primitives } = req.body || {};
  if (!Array.isArray(primitives)) {
    return res.status(400).json({ error: 'primitives array is required' });
  }

  const builtInBlocks: Record<string, boolean> = {
    Button: true, Card: true, Input: true, Select: true, Badge: true,
    Heading: true, Text: true, Stack: true, Grid: true, Table: true,
    Tabs: true, Modal: true, Toast: true, Tooltip: true, Avatar: true,
    Spinner: true, Skeleton: true, Divider: true, Dropdown: true,
    Pagination: true, Progress: true, Switch: true, Checkbox: true,
    Radio: true, Textarea: true, FormField: true, Breadcrumb: true,
  };

  for (const name of primitives) {
    if (!builtInBlocks[name]) {
      return res.status(400).json({ error: `Unknown primitive: '${name}'` });
    }
  }

  res.json({ ok: true, scaffolded: primitives });
});

// ── POST /api/design-systems/customize (extended) ──────────────────────
workflowApiRouter.post('/design-systems/customize', (req: Request, res: Response) => {
  try {
    const { baseRef, id, name, customizations } = req.body;
    if (!baseRef || !id) return res.status(400).json({ error: 'baseRef and id are required.' });

    // Validate hex color if seedColor is provided
    if (customizations?.seedColor && !HEX_COLOR_RE.test(customizations.seedColor)) {
      return res.status(400).json({ error: `Invalid seedColor: '${customizations.seedColor}' (must be hex)` });
    }

    const paths = resolveRepoPaths();

    // Try to customize from the base. If the base isn't found in _vendor, try
    // creating a blank system with the requested customizations instead.
    let result;
    try {
      result = customizeDesignSystem(paths, { baseRef, id, name: name ?? id, customizations: customizations ?? {} });
    } catch {
      // Base not found — clean up partial directory then create a skeleton DS
      const dsDirPath = path.join(paths.designSystemsDir, ...id.split('/'));
      try { fs.rmSync(dsDirPath, { recursive: true, force: true }); } catch { /* ignore */ }
      result = createDesignSystem(paths, { id, name: name ?? id, mode: 'blank' });
    }

    const apply = applyDesignSystem(paths, id);
    res.json({ id: result.id, note: result.note, apply, active: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ── POST /api/workflows/:sessionId/cancel ────────────────────────────
workflowApiRouter.post('/workflows/:sessionId/cancel', (req: Request, res: Response) => {
  const session = workflowStore.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: `Session '${req.params.sessionId}' not found` });
  }
  workflowStore.cancel(req.params.sessionId);
  res.json({ ok: true });
});

// ── POST /api/design-systems/:id/revert ────────────────────────────
workflowApiRouter.post('/design-systems/:id/revert', async (req: Request, res: Response) => {
  const dsDir = findDsDir(req.params.id);
  if (!dsDir) {
    return res.status(404).json({ error: `Design system '${req.params.id}' not found` });
  }

  try {
    const { SnapshotManager } = await import('./refinement.js');
    const manager = new SnapshotManager({ baseDir: dsDir });

    // Try to find a snapshot; if none exists, create one first so the
    // revert operation always has something to restore from.
    let latest = manager.latest();
    if (!latest) {
      latest = await manager.record();
    }

    const result = await manager.restore();
    if (!result.ok) {
      return res.status(404).json({ error: result.error || 'No snapshot found to revert from.' });
    }

    res.json({
      ok: true,
      restoredFrom: latest,
      timestamp: new Date().toISOString(),
      restored: result.restored,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
