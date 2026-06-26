# Agent adapters

medesign drives generation through a pluggable **agent-adapter registry**, adapted from open-design's
`runtimes/` harness (Apache-2.0; see [`open-design-analysis.md`](./open-design-analysis.md) §1). An
adapter teaches the backend how to launch one coding-agent CLI. Phase 0 ships the Claude Code adapter.

## The contract (`packages/backend/src/harness/types.ts`)

```ts
interface MinimalAgentDef {
  id: string;
  name: string;
  bin: string;
  fallbackBins?: string[];
  versionArgs: string[];
  buildArgs: (ctx: AgentBuildContext) => string[];   // PURE — returns argv
  promptViaStdin: true;                               // prompt via stdin, never argv
  promptInputFormat: 'text' | 'stream-json';
  streamFormat: string;                               // selects the stdout parser
  helpArgs?: string[];                                // capability probe
  capabilityFlags?: Record<string, string>;           // help substring → capability bit
  resumesSessionViaCli?: boolean;                     // keep working memory across turns
  mcpConfigStrategy?: 'claude-mcp-json';              // how medesign's tools are exposed
}
```

Four load-bearing ideas (the only ones we kept from open-design's 26-agent harness):

1. **Pure `buildArgs`** — testable, isolates each CLI's flag quirks.
2. **stdin stream-json transport** — design prompts (DESIGN.md + tokens) exceed argv limits; stdin stays open to inject the next change request without re-spawning.
3. **Capability gating** — probe `--help`, only pass flags the installed build supports.
4. **Session resume** — `--resume` / `--session-id` so the agent keeps memory across change requests (this *is* the live loop).

## Driver (`harness/driver.ts`)

`runAgent()` does: resolve the binary (`bin` → `fallbackBins`), probe capabilities **in `os.tmpdir()`**
(never touch the repo), write `.mcp.json` so the agent can call medesign's tools, build a hardened child
`PATH` (prepend Node dir + the agent dir, append toolchains), `spawn`, stream the prompt in as a
stream-json user message, and parse the stdout stream-json events to completion.

## Adding an adapter

1. Create `harness/defs/<id>.ts` exporting a `MinimalAgentDef`.
2. Map its `--help` flags in `capabilityFlags`.
3. Set the prompt transport (`promptViaStdin` + `promptInputFormat`) and `streamFormat`.
4. Register it in the harness index.

See `harness/claude.ts` for the reference adapter:

```
claude -p --input-format stream-json --output-format stream-json --verbose \
  [--include-partial-messages] [--model <id>] [--add-dir <repo>] \
  (--resume <id> | --session-id <uuid>) --permission-mode bypassPermissions
```

**Deliberately dropped** from open-design (not needed for one stdin-based agent): the prompt-budget module
(argv-only), ACP MCP strategies, codex native-binary discovery, and live model discovery.
