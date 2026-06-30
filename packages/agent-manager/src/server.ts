/**
 * Hono-based HTTP + SSE server for session browsing — adapted from claude-run (MIT).
 * Serves Claude session history: list sessions, view conversations, real-time SSE streaming.
 * Designed to be mounted under the emdesign HTTP bridge or run standalone.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { streamSSE } from "hono/streaming";
import type { ServerType } from "@hono/node-server";
import {
  initStorage,
  loadStorage,
  getClaudeDir,
  getSessions,
  getProjects,
  getConversation,
  getConversationStream,
  invalidateHistoryCache,
  addToFileIndex,
} from "./storage.js";
import {
  initWatcher,
  startWatcher,
  stopWatcher,
  onHistoryChange,
  offHistoryChange,
  onSessionChange,
  offSessionChange,
} from "./watcher.js";

export interface SessionServerOptions {
  port?: number;
  claudeDir?: string;
  dev?: boolean;
}

export interface SessionServerHandle {
  app: Hono;
  port: number;
  start: () => Promise<ServerType>;
  stop: () => void;
}

export function createSessionServer(options: SessionServerOptions = {}): SessionServerHandle {
  const { port = 12001, claudeDir: cDir, dev = false } = options;

  initStorage(cDir);
  initWatcher(getClaudeDir());

  const app = new Hono();

  if (dev) {
    app.use(
      "*",
      cors({
        origin: ["http://localhost:6006", "http://localhost:12000"],
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: ["Content-Type"],
      }),
    );
  }

  // ── REST endpoints ───────────────────────────────────────────────────

  app.get("/api/sessions", async (c) => {
    const sessions = await getSessions();
    return c.json(sessions);
  });

  app.get("/api/projects", async (c) => {
    const projects = await getProjects();
    return c.json(projects);
  });

  app.get("/api/conversation/:id", async (c) => {
    const sessionId = c.req.param("id");
    const messages = await getConversation(sessionId);
    return c.json(messages);
  });

  // ── SSE endpoints ────────────────────────────────────────────────────

  app.get("/api/sessions/stream", async (c) => {
    return streamSSE(c, async (stream) => {
      let isConnected = true;
      const knownSessions = new Map<string, number>();

      const cleanup = () => {
        isConnected = false;
        offHistoryChange(handleHistoryChange);
      };

      const handleHistoryChange = async () => {
        if (!isConnected) return;
        try {
          const sessions = await getSessions();
          const newOrUpdated = sessions.filter((s) => {
            const known = knownSessions.get(s.id);
            return known === undefined || known !== s.timestamp;
          });

          for (const s of sessions) {
            knownSessions.set(s.id, s.timestamp);
          }

          if (newOrUpdated.length > 0) {
            await stream.writeSSE({
              event: "sessionsUpdate",
              data: JSON.stringify(newOrUpdated),
            });
          }
        } catch {
          cleanup();
        }
      };

      onHistoryChange(handleHistoryChange);
      c.req.raw.signal.addEventListener("abort", cleanup);

      try {
        const sessions = await getSessions();
        for (const s of sessions) {
          knownSessions.set(s.id, s.timestamp);
        }

        await stream.writeSSE({
          event: "sessions",
          data: JSON.stringify(sessions),
        });

        while (isConnected) {
          await stream.writeSSE({
            event: "heartbeat",
            data: JSON.stringify({ timestamp: Date.now() }),
          });
          await stream.sleep(30000);
        }
      } catch {
        // Connection closed
      } finally {
        cleanup();
      }
    });
  });

  app.get("/api/conversation/:id/stream", async (c) => {
    const sessionId = c.req.param("id");
    const offsetParam = c.req.query("offset");
    let offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    return streamSSE(c, async (stream) => {
      let isConnected = true;

      const cleanup = () => {
        isConnected = false;
        offSessionChange(handleSessionChange);
      };

      const handleSessionChange = async (changedSessionId: string) => {
        if (changedSessionId !== sessionId || !isConnected) return;

        const { messages: newMessages, nextOffset: newOffset } =
          await getConversationStream(sessionId, offset);
        offset = newOffset;

        if (newMessages.length > 0) {
          try {
            await stream.writeSSE({
              event: "messages",
              data: JSON.stringify(newMessages),
            });
          } catch {
            cleanup();
          }
        }
      };

      onSessionChange(handleSessionChange);
      c.req.raw.signal.addEventListener("abort", cleanup);

      try {
        const { messages, nextOffset } = await getConversationStream(
          sessionId,
          offset,
        );
        offset = nextOffset;

        await stream.writeSSE({
          event: "messages",
          data: JSON.stringify(messages),
        });

        while (isConnected) {
          await stream.writeSSE({
            event: "heartbeat",
            data: JSON.stringify({ timestamp: Date.now() }),
          });
          await stream.sleep(30000);
        }
      } catch {
        // Connection closed
      } finally {
        cleanup();
      }
    });
  });

  // ── Watcher setup ────────────────────────────────────────────────────

  onHistoryChange(() => {
    invalidateHistoryCache();
  });

  onSessionChange((sessionId: string, filePath: string) => {
    addToFileIndex(sessionId, filePath);
  });

  startWatcher();

  let httpServer: ServerType | null = null;

  return {
    app,
    port,
    start: async () => {
      await loadStorage();
      console.error(`[emdesign/session] SSE server on http://localhost:${port}/`);
      httpServer = serve({ fetch: app.fetch, port });
      return httpServer;
    },
    stop: () => {
      stopWatcher();
      if (httpServer) {
        httpServer.close();
      }
    },
  };
}
