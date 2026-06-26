import fs from 'node:fs';
import path from 'node:path';
import { normalizeDsRef, type RepoPaths } from './paths.js';

export interface DesignSystem {
  id: string;
  name: string;
  /** Verbatim DESIGN.md body (the 9 sections) — the heart of the prompt. */
  designMd: string;
  /** tokens.css contents (the :root contract). */
  tokensCss: string;
  /** Declared token role names (without leading `--`). */
  declaredTokens: string[];
  /** Primitive component names available under code/. */
  primitives: string[];
  /** manifest.craft.exemptions — lint rules to skip. */
  exemptions: string[];
  bindsDisplayFace: boolean;
}

export function resolveDesignSystem(paths: RepoPaths, id: string): DesignSystem {
  const dir = path.join(paths.designSystemsDir, ...normalizeDsRef(id).split('/'));
  const designMd = readIfExists(path.join(dir, 'DESIGN.md'));
  const tokensCss = readIfExists(path.join(dir, 'tokens.css'));
  if (!designMd) throw new Error(`Design system '${id}' has no DESIGN.md at ${dir}`);

  let exemptions: string[] = [];
  try {
    const manifest = JSON.parse(readIfExists(path.join(dir, 'manifest.json')) || '{}');
    exemptions = manifest?.craft?.exemptions ?? [];
  } catch {
    /* no/invalid manifest */
  }

  return {
    id,
    name: extractTitle(designMd) ?? id,
    designMd,
    tokensCss,
    declaredTokens: parseDeclaredTokens(tokensCss),
    primitives: listPrimitives(path.join(dir, 'code')),
    exemptions,
    bindsDisplayFace: /--font-display\s*:/.test(tokensCss),
  };
}

export function parseDeclaredTokens(tokensCss: string): string[] {
  const names = new Set<string>();
  for (const m of tokensCss.matchAll(/--([a-z0-9-]+)\s*:/gi)) names.add(m[1]);
  return [...names];
}

function listPrimitives(codeDir: string): string[] {
  try {
    return fs
      .readdirSync(codeDir)
      .filter((f) => /^[A-Z]\w*\.tsx$/.test(f) && !f.endsWith('.stories.tsx'))
      .map((f) => f.replace(/\.tsx$/, ''));
  } catch {
    return [];
  }
}

function extractTitle(md: string): string | undefined {
  return md.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
}

function readIfExists(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

export interface ComposeInput {
  ds: DesignSystem;
  componentName: string;
  /** Current source if editing; empty when creating. */
  currentSource?: string;
  instruction: string;
  /** P0-first lint feedback from the previous round, if any. */
  lintFeedback?: string;
  /** Optional knowledge-graph context (consistency brief when creating; node neighborhood when editing). */
  graphContext?: string;
  /** Stack-specific generation rules from the active FrameworkAdapter. */
  codegenInstructions?: string;
}

/**
 * Composes the agent prompt — adapted from open-design's design-system asset assembly:
 * verbatim DESIGN.md body + tokens.css + available primitives + the task + self-correction
 * feedback. This is what binds generation to the design system.
 */
export function composePrompt(input: ComposeInput): string {
  const { ds, componentName, currentSource, instruction, lintFeedback, graphContext, codegenInstructions } = input;
  const mode = currentSource ? 'EDIT' : 'CREATE';
  return [
    `You are medesign's design engineer. ${mode} the component "${componentName}".`,
    '',
    'RULES (non-negotiable):',
    // Framework-specific generation rules come from the active FrameworkAdapter.
    codegenInstructions ??
      `- Compose the design system primitives from the design system. Reference token roles only, never raw hex.`,
    `- Write the component + its story into the project's generated dir (configured generatedDir), named "${componentName}".`,
    '',
    `=== DESIGN SYSTEM: ${ds.name} ===`,
    ds.designMd,
    '',
    '=== tokens.css (the token contract) ===',
    ds.tokensCss,
    '',
    graphContext ? `=== DESIGN-SYSTEM GRAPH CONTEXT ===\n${graphContext}\n` : '',
    currentSource ? `=== CURRENT ${componentName}.tsx ===\n${currentSource}\n` : '',
    lintFeedback ? `=== CONSISTENCY LINT (fix all P0 before finishing) ===\n${lintFeedback}\n` : '',
    `=== TASK ===\n${instruction}`,
  ]
    .filter(Boolean)
    .join('\n');
}
