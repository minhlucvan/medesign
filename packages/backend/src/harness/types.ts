/**
 * Minimal agent-adapter model, adapted from open-design's `RuntimeAgentDef`
 * (apps/daemon/src/runtimes/types.ts, Apache-2.0). We keep the four load-bearing ideas —
 * pure `buildArgs`, stdin stream-json transport, capability gating, session resume — and
 * drop the 26-agent generality, prompt-budget (argv-only), and ACP MCP strategies.
 */
export interface AgentBuildContext {
  model?: string | null;
  /** Extra directories the agent is allowed to read/write (e.g. the repo root). */
  extraAllowedDirs?: string[];
  /** Resume an existing CLI session (carries the agent's working memory). */
  resumeSessionId?: string | null;
  /** First-turn session id minted by us and persisted for later --resume. */
  newSessionId?: string;
  /** Capability bits discovered via the help probe. */
  capabilities: Record<string, boolean>;
}

export interface MinimalAgentDef {
  id: string;
  name: string;
  bin: string;
  fallbackBins?: string[];
  versionArgs: string[];
  /** Pure: returns argv. The prompt is delivered via stdin, never argv. */
  buildArgs: (ctx: AgentBuildContext) => string[];
  promptViaStdin: true;
  promptInputFormat: 'text' | 'stream-json';
  /** Selects the stdout parser. */
  streamFormat: string;
  helpArgs?: string[];
  /** Map of help-output flag substring → capability bit name. */
  capabilityFlags?: Record<string, string>;
  resumesSessionViaCli?: boolean;
  /** How user/own MCP servers are exposed to the agent. */
  mcpConfigStrategy?: 'claude-mcp-json';
}
