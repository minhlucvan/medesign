/**
 * @emdesign/session — Session and process lifecycle management for emdesign.
 *
 * Read-side adapted from claude-run (MIT, github.com/nilbuild/claude-run).
 * Write-side: AgentRunner, SessionManager, ProcessManager, PlatformManager.
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

// Write-side
export { PlatformEventBus } from './hooks.js';
export type { PlatformEvent } from './hooks.js';
export { SessionStore } from './SessionStore.js';
export { AgentRunner } from './AgentRunner.js';
export { SessionManager } from './SessionManager.js';
export { ProcessManager } from './ProcessManager.js';
export { PlatformManager } from './Orchestrator.js';
export type { PlatformOrchestrator } from './types.js';
export type { AgentHandle, AgentRunnerOptions } from './AgentRunner.js';
export type { ServiceType, ServiceStatus, ServiceInfo, PlatformState } from './types.js';
export { createSessionRouter } from './api/httpRouter.js';
export { attachWebSocket } from './WebSocketServer.js';

// Log sink
export { createLogSink } from './log-sink.js';
export type { LogEntry } from './log-sink.js';
