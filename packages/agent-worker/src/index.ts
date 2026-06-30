/**
 * @emdesign/agent-worker — Claude Code session worker.
 *
 * Pure worker: polls a queue for pending intents and spawns Claude Code sessions.
 * No knowledge of HTTP, store, or backend — managed by @emdesign/agent-manager.
 */
export { AgentWorker } from './worker.js';
export type { AgentWorkerOptions, WorkerSession, QueueItem } from './worker.js';

// AgentRunner (moved from @emdesign/session)
export { AgentRunner } from './AgentRunner.js';
export type { AgentHandle, AgentRunnerOptions } from './AgentRunner.js';
