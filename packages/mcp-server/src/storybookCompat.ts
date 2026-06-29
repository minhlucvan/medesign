import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { RepoPaths } from '@emdesign/backend';

// ── Story file scanning ───────────────────────────────────────────

export interface StoryEntry {
  id: string;
  title: string;
  name: string;
  kind: 'generated' | 'component' | 'primitive';
  filePath: string;
}

/**
 * Parse a CSF story source to extract the story title and export names.
 */
export function parseCsfTitle(source: string): { title?: string; exports: string[] } {
  const titleMatch = source.match(/(?:export\s+default\s*:\s*|title:\s*["'])([^"'\n]+)/);
  const title = titleMatch?.[1]?.replace(/\/$/, '') ?? undefined;
  const exports: string[] = [];
  const exportRe = /export\s+(?:const\s+)?(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = exportRe.exec(source)) !== null) {
    if (!['default', 'meta', 'args', 'argTypes'].includes(m[1])) exports.push(m[1]);
  }
  return { title, exports };
}

/**
 * Scan a directory for .stories.tsx files and return their metadata.
 */
export function scanStoryFiles(dir: string, kind: StoryEntry['kind']): StoryEntry[] {
  const entries: StoryEntry[] = [];
  if (!fs.existsSync(dir)) return entries;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.stories.tsx'));
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const source = fs.readFileSync(filePath, 'utf8');
      const { title, exports: storyExports } = parseCsfTitle(source);
      const componentName = path.basename(file, '.stories.tsx');
      const baseTitle = title ?? `Unknown/${componentName}`;

      for (const storyName of storyExports.length ? storyExports : ['default']) {
        const storyId = `${baseTitle.replace(/\//g, '-').toLowerCase()}--${storyName.toLowerCase()}`;
        entries.push({
          id: storyId,
          title: baseTitle,
          name: storyName,
          kind,
          filePath,
        });
      }
    } catch {
      // Skip unparseable files
    }
  }
  return entries;
}

/**
 * List all story entries across all three story sources.
 */
export function listAllStories(paths: RepoPaths): StoryEntry[] {
  const all: StoryEntry[] = [];

  // Generated components
  all.push(...scanStoryFiles(paths.generatedDir, 'generated'));

  // Captured (reusable) components
  all.push(...scanStoryFiles(paths.componentsDir, 'component'));

  // Design system primitives
  const dsDir = path.join(paths.root, 'design-systems');
  if (fs.existsSync(dsDir)) {
    for (const dsEntry of fs.readdirSync(dsDir)) {
      const codeDir = path.join(dsDir, dsEntry, 'code');
      all.push(...scanStoryFiles(codeDir, 'primitive'));
    }
  }

  return all;
}

/**
 * Get the most recent commit that touched story files.
 */
export function getChangedStories(since?: string): string[] {
  try {
    const ref = since ?? 'HEAD~1';
    const stdout = execSync(
      `git diff --name-only ${ref} -- '*.stories.*' 2>/dev/null || echo ""`,
      { encoding: 'utf8', timeout: 5000 },
    );
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Try to fetch the Storybook index.json for the richest story info.
 * Falls back gracefully if Storybook isn't running.
 */
export interface StorybookIndexEntry {
  id: string;
  title: string;
  name: string;
  type: string;
  tags?: string[];
  importPath?: string;
}

export async function fetchStorybookIndex(storybookUrl: string): Promise<StorybookIndexEntry[] | null> {
  try {
    const res = await fetch(`${storybookUrl}/index.json`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const data = await res.json() as { entries: Record<string, StorybookIndexEntry> };
    return Object.values(data.entries).filter(e => e.type === 'story');
  } catch {
    return null;
  }
}

/**
 * Try to call a tool on the Storybook MCP endpoint.
 */
export async function callStorybookMcpTool(
  storybookUrl: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${storybookUrl}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Storybook MCP error: ${res.status}`);
  const body = await res.json() as { result?: { content?: Array<{ type: string; text?: string }> } };
  return body.result?.content;
}
