import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// SUT — the two project MCP tools do not exist yet at the RED step. Importing
// `createMcpServer` and asserting that it registers `analyze_project` +
// `adopt_components` (with Zod input schemas + structured payloads) is what
// makes this suite fail until those tools land in `mcp.ts` (the GREEN step).
import { createMcpServer } from '../mcp.js';
import { resolveRepoPaths, Store } from '@emdesign/backend';

// The canonical in-process MCP handshake: a linked client/server pair so the
// tools are exercised through the real public surface (listTools / callTool),
// not via private internals.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

// ---------------------------------------------------------------------------
// Two temp trees:
//   srcProject — a tiny existing project to analyze / adopt (never mutated):
//       tailwind.config.js  theme.extend.colors { surface:'#0a0a0a',
//                                                 accent:'#3b82f6' }
//       src/components/Card.tsx  className="bg-[#0a0a0a] text-[#ff00aa]"
//                                (a hex that clusters to a role + a rare one)
//   workspace  — the destination emdesign workspace; adoption writes placed
//                components under <workspace>/src/components (componentsDir).
// ---------------------------------------------------------------------------

let srcProject: string;
let workspace: string;

const TAILWIND_CONFIG = `module.exports = {
  theme: {
    extend: {
      colors: {
        surface: '#0a0a0a',
        accent: '#3b82f6',
      },
    },
  },
};
`;

const CARD_TSX = `export function Card() {
  return <div className="bg-[#0a0a0a] text-[#ff00aa] rounded p-4">card</div>;
}
`;

function writeFile(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

/** Recursively count regular files under a directory (0 if it does not exist). */
function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) n += countFiles(full);
    else n += 1;
  }
  return n;
}

beforeAll(() => {
  srcProject = mkdtempSync(join(tmpdir(), 'emdesign-mcp-src-'));
  writeFile(join(srcProject, 'tailwind.config.js'), TAILWIND_CONFIG);
  writeFile(join(srcProject, 'src', 'components', 'Card.tsx'), CARD_TSX);

  workspace = mkdtempSync(join(tmpdir(), 'emdesign-mcp-ws-'));
  mkdirSync(join(workspace, '.emdesign'), { recursive: true });
});

afterAll(() => {
  rmSync(srcProject, { recursive: true, force: true });
  rmSync(workspace, { recursive: true, force: true });
});

/** Spin up an in-memory MCP client connected to a fresh emdesign server. */
async function connectClient(): Promise<{ client: Client; componentsDir: string }> {
  const paths = resolveRepoPaths(workspace);
  const store = new Store(paths);
  const server = await createMcpServer(store, paths);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'project-tools-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return { client, componentsDir: paths.componentsDir };
}

/** Call a tool and JSON.parse its first text content block. */
async function callJson(client: Client, name: string, args: Record<string, unknown>): Promise<any> {
  const res: any = await client.callTool({ name, arguments: args });
  const block = (res.content as any[]).find((c) => c.type === 'text');
  expect(block, `tool ${name} returned a text content block`).toBeTruthy();
  return JSON.parse(block.text);
}

/**
 * Assert the Zod input schema rejects `args`. The high-level MCP server surfaces a
 * schema-validation failure as a tool *result* with `isError: true` (carrying the
 * "Input validation error" message) rather than the handler running — so a missing
 * required field never reaches the tool body.
 */
async function expectSchemaRejection(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<void> {
  const res: any = await client.callTool({ name, arguments: args });
  expect(res.isError, `tool ${name} rejected invalid input`).toBe(true);
  const text = (res.content as any[]).find((c) => c.type === 'text')?.text ?? '';
  expect(text).toMatch(/validation|required|path/i);
}

describe('analyze_project MCP tool', () => {
  it('is registered with a Zod input schema requiring a project path', async () => {
    const { client } = await connectClient();
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'analyze_project');
    expect(tool, 'analyze_project tool is registered').toBeTruthy();
    // Zod -> JSON Schema is what the SDK exposes; assert a structured `path` input.
    expect(tool!.inputSchema).toBeTruthy();
    expect((tool!.inputSchema as any).properties?.path).toBeTruthy();
    expect((tool!.inputSchema as any).required ?? []).toContain('path');
  });

  it('returns a structured (machine-readable) extraction with roles, confidence, and file:line provenance', async () => {
    // Scenario: Agent requests analysis.
    const { client } = await connectClient();
    const result = await callJson(client, 'analyze_project', { path: srcProject });

    // Not free text — a structured object with the extraction shape.
    expect(result).toBeTypeOf('object');
    expect(Array.isArray(result.proposedRoles)).toBe(true);
    expect(result.proposedRoles.length).toBeGreaterThan(0);
    expect(Array.isArray(result.observations)).toBe(true);
    expect(Array.isArray(result.conflicts)).toBe(true);

    // Every proposed role carries a numeric confidence score in [0, 1].
    for (const role of result.proposedRoles) {
      expect(typeof role.role).toBe('string');
      expect(typeof role.confidence).toBe('number');
      expect(role.confidence).toBeGreaterThanOrEqual(0);
      expect(role.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(role.evidence)).toBe(true);
    }

    // Provenance: at least one observation traces back to file:line.
    expect(result.observations.length).toBeGreaterThan(0);
    for (const obs of result.observations) {
      expect(typeof obs.file).toBe('string');
      expect(obs.file.length).toBeGreaterThan(0);
      expect(Number.isInteger(obs.line)).toBe(true);
      expect(obs.line).toBeGreaterThan(0);
    }
  });

  it('rejects a call with no path argument (schema validation)', async () => {
    const { client } = await connectClient();
    await expectSchemaRejection(client, 'analyze_project', {});
  });
});

describe('adopt_components MCP tool', () => {
  it('is registered with a Zod input schema for path + mode', async () => {
    const { client } = await connectClient();
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'adopt_components');
    expect(tool, 'adopt_components tool is registered').toBeTruthy();
    expect(tool!.inputSchema).toBeTruthy();
    expect((tool!.inputSchema as any).properties?.path).toBeTruthy();
    expect((tool!.inputSchema as any).properties?.mode).toBeTruthy();
    expect((tool!.inputSchema as any).required ?? []).toContain('path');
  });

  it('preview mode computes the report WITHOUT writing files', async () => {
    // Scenario: Agent invokes adoption in preview mode.
    const { client, componentsDir } = await connectClient();
    const before = countFiles(componentsDir);

    const report = await callJson(client, 'adopt_components', { path: srcProject, mode: 'preview' });

    // Structured adoption report (per the component-adoption capability).
    expect(Array.isArray(report.components)).toBe(true);
    expect(report.components.length).toBeGreaterThan(0);
    for (const comp of report.components) {
      expect(['loop-ready', 'needs-manual-fix']).toContain(comp.status);
      expect(Array.isArray(comp.rebinds)).toBe(true);
      expect(Array.isArray(comp.blockingValues)).toBe(true);
    }

    // No files written in preview mode.
    expect(countFiles(componentsDir)).toBe(before);
  });

  it('run mode performs adoption (places components) and returns the structured report', async () => {
    // Scenario: Agent invokes adoption in run mode.
    const { client, componentsDir } = await connectClient();

    const report = await callJson(client, 'adopt_components', { path: srcProject, mode: 'run' });

    expect(Array.isArray(report.components)).toBe(true);
    expect(report.components.length).toBeGreaterThan(0);
    const card = report.components.find((c: any) => c.name === 'Card');
    expect(card, 'Card was adopted').toBeTruthy();
    expect(['loop-ready', 'needs-manual-fix']).toContain(card.status);

    // Run mode actually placed at least one component file under componentsDir.
    expect(countFiles(componentsDir)).toBeGreaterThan(0);
  });

  it('rejects a call with no path argument (schema validation)', async () => {
    const { client } = await connectClient();
    await expectSchemaRejection(client, 'adopt_components', { mode: 'preview' });
  });
});
