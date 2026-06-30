/**
 * @emdesign/agent-manager — Session and process lifecycle management for emdesign.
 * Combines the former @emdesign/session with the worker/queue management layer.
 *
 * Read-side (from claude-run): session browsing, conversation history.
 * Write-side: SessionManager, ProcessManager, PlatformManager, AgentManager.
 */

// Read-side (from claude-run)
export {
  initStorage,
  getClaudeDir,
  loadStorage,
  getSessions,
  getProjects,
  getConversation,
  getConversationStream,
  writeSessionFile,
  appendSessionMessage,
  invalidateHistoryCache,
} from './storage.js';
export type {
  HistoryEntry,
  ClaudeSession,
  ConversationMessage,
  ContentBlock,
  TokenUsage,
  StreamResult,
  EmSession,
  WorkflowType,
  SessionStatus,
} from './storage.js';

// File watcher
export {
  initWatcher,
  startWatcher,
  stopWatcher,
  onHistoryChange,
  offHistoryChange,
  onSessionChange,
  offSessionChange,
} from './watcher.js';

// Hono SSE server
export { createSessionServer } from './server.js';
export type { SessionServerOptions, SessionServerHandle } from './server.js';

// Event bus
export { PlatformEventBus } from './hooks.js';
export type { PlatformEvent } from './hooks.js';

// Session management
export { SessionStore } from './SessionStore.js';
export { SessionManager } from './SessionManager.js';
export { ProcessManager } from './ProcessManager.js';
export { PlatformManager } from './Orchestrator.js';
export type { PlatformOrchestrator } from './types.js';
export type { ServiceType, ServiceStatus, ServiceInfo, PlatformState } from './types.js';

// HTTP router
export { createSessionRouter } from './api/httpRouter.js';

// WebSocket
export { attachWebSocket } from './WebSocketServer.js';

// Log sink
export { createLogSink } from './log-sink.js';
export type { LogEntry } from './log-sink.js';

// Agent Manager (queue consumer orchestrator)
export { AgentManager } from './manager.js';
export type { AgentManagerOptions } from './manager.js';

// CLI
export { cli } from './cli.js';
