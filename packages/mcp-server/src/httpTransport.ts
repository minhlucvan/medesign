import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Router } from 'express';
import { Router as createRouter } from 'express';
import type { Store, RepoPaths } from '@emdesign/backend';
import { createMcpServer } from './mcp.js';

export interface McpHttpOptions {
  store: Store;
  paths: RepoPaths;
  /** Base path to mount on. Default: '/mcp' */
  path?: string;
}

/**
 * Create an Express Router that mounts the emdesign MCP tool surface
 * over Streamable HTTP transport (MCP spec).
 *
 * Mount on any Express app:
 *   const router = await createMcpHttpRouter({ store, paths, orch });
 *   app.use(router);
 *
 * The router handles POST and GET at the configured base path using the
 * MCP Streamable HTTP specification. Any MCP-capable agent (Claude Code,
 * Cursor, Copilot, OpenAI, Gemini) can connect to this endpoint.
 */
export async function createMcpHttpRouter(opts: McpHttpOptions): Promise<Router> {
  const basePath = opts.path ?? '/mcp';
  const router = createRouter();

  // Create the MCP server with all 34+ tools
  const server = await createMcpServer(opts.store, opts.paths);

  // Create streamable HTTP transport (stateless mode — each request is independent)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  // Connect the McpServer to the HTTP transport
  await server.connect(transport);

  // Mount the handler on the base path
  router.use(basePath, async (req, res, next) => {
    try {
      // handleRequest accepts Node.js IncomingMessage/ServerResponse + parsed body
      await (transport as any).handleRequest(req, res, req.body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
