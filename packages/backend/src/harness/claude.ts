import type { MinimalAgentDef } from './types.js';

/**
 * Claude Code adapter — adapted from open-design's `defs/claude.ts` (Apache-2.0).
 *
 * Prompt is streamed in as a stream-json user message (avoids argv size limits and keeps
 * stdin open for follow-up turns / tool_result injection — exactly what the live
 * change-request loop needs). Session is resumed via the CLI so Claude keeps working
 * memory across change requests instead of re-reading everything each time.
 */
export const claudeAdapter: MinimalAgentDef = {
  id: 'claude',
  name: 'Claude Code',
  bin: 'claude',
  fallbackBins: ['openclaude'],
  versionArgs: ['--version'],
  helpArgs: ['-p', '--help'],
  capabilityFlags: {
    '--include-partial-messages': 'partialMessages',
    '--add-dir': 'addDir',
  },
  buildArgs: ({ model, extraAllowedDirs = [], resumeSessionId, newSessionId, capabilities }) => {
    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose'];
    if (capabilities.partialMessages) args.push('--include-partial-messages');
    if (model && model !== 'default') args.push('--model', model);
    const dirs = extraAllowedDirs.filter((d) => typeof d === 'string' && d.length > 0);
    if (dirs.length && capabilities.addDir !== false) args.push('--add-dir', ...dirs);
    if (resumeSessionId) args.push('--resume', resumeSessionId);
    else if (newSessionId) args.push('--session-id', newSessionId);
    // The backend owns a controlled cwd, so it bypasses Claude's interactive approval.
    args.push('--permission-mode', 'bypassPermissions');
    return args;
  },
  promptViaStdin: true,
  promptInputFormat: 'stream-json',
  streamFormat: 'claude-stream-json',
  resumesSessionViaCli: true,
  mcpConfigStrategy: 'claude-mcp-json',
};
