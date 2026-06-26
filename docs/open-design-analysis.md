# Deep analysis of open-design — what we port, adapt, and beat

> Source: [`nexu-io/open-design`](https://github.com/nexu-io/open-design) `v0.11.1`, **Apache-2.0**.
> Apache-2.0 lets us adapt the code directly with attribution (see [`/NOTICE`](../NOTICE)).
> This doc is the engineering record behind medesign's design-quality engine. It distills a close
> read of the daemon source: `apps/daemon/src/runtimes/**` (harness), `critique/**` (quality loop),
> and `design-systems/**` + `lint-artifact.ts` (the DESIGN.md contract + consistency lint).

open-design's design quality is **not** a model trick. It comes from three file-based assets — a very
rich `DESIGN.md` contract, Skills, and Templates — fed to any agent through a disciplined **harness**,
with a **critique loop** that re-scores output and a **lint** that blocks "AI-slop." medesign adopts all
four, then beats open-design by emitting **reusable, visually-tested code components** (not one-off HTML).

---

## 1. The agent harness (`runtimes/`) — orchestration

A pluggable **agent-adapter registry**. Each of 26 CLIs is a plain object (`RuntimeAgentDef`) with a pure
`buildArgs()`; a static `AGENT_DEFS` array + `getAgentDef(id)` lookup; a launch pipeline
(`resolveAgentExecutable → resolveAgentLaunch → spawnEnvForAgent → spawn`); capability probing
(`helpArgs` + `capabilityFlags`); a `prompt-budget` guard (argv-only); and `.mcp.json` injection so the
agent can call back into the daemon to capture artifacts.

**Four load-bearing ideas we keep** (the rest is multi-agent generality we drop):
1. **Pure `buildArgs` adapter shape** — trivially testable; isolates each CLI's flag quirks.
2. **stdin stream-json prompt transport** — avoids argv size limits (DESIGN.md + skill easily exceed
   them) and keeps stdin open to inject the *next change request* / `tool_result` without re-spawning.
3. **Capability gating** via the help probe — don't crash on older/forked builds.
4. **Session resume** (`--session-id` / `--resume`) — the agent keeps working memory across change
   requests instead of re-reading everything. This is exactly our live loop.

Claude Code launch (ported in `packages/backend/src/harness/claude.ts`):
```
claude -p --input-format stream-json --output-format stream-json --verbose \
  [--include-partial-messages] [--model <id>] [--add-dir <repo>] \
  (--resume <id> | --session-id <uuid>) --permission-mode bypassPermissions
```
**Dropped:** the 25 other adapters, the whole `prompt-budget` module (argv-only; stdin Claude is never
limited), ACP MCP strategies, codex native-binary discovery, model discovery. Operational lessons we
keep: prepend Node dir + append toolchain dirs to child PATH; run probes in `os.tmpdir()` so we never
trigger a stray install in the repo.

---

## 2. The critique loop (`critique/`) — quality that never regresses

This is the real quality secret sauce. open-design runs generated artifacts through a **panel of scoring
agents** over a multi-round generate→score→revise loop. Three pieces matter for us:

- **`scoreboard.ts`** — the per-artifact gate. `computeComposite(scores, weights)` is a weighted mean
  over *present* roles with weights **redistributed** (an absent scorer doesn't drag the score to zero).
  `decideRound(composite, mustFix, cfg)` ships **only if `composite ≥ threshold` AND `mustFix === 0`** —
  a great average can't override a single blocking issue. We port this nearly verbatim.
- **Daemon-authoritative re-score** — the daemon **never trusts the agent's self-claimed score**; it
  recomputes from raw scorer output and can overrule a SHIP. We replicate this with **deterministic**
  scorers, not an LLM jury.
- **`ratchet.ts`** — monotonic no-regression logic (promotion needs sustained evidence; demotion only on
  sustained breakage). We reframe it per-component: **a new version replaces the baseline only if its
  composite ≥ baseline AND `mustFix === 0`**.

**medesign's adaptation** — replace the stochastic LLM panel with deterministic scorers:

| open-design panelist | medesign deterministic scorer |
|---|---|
| critic / designer (visual) | Storybook **visual diff** vs baseline (`run_visual_test`) |
| brand | **consistency lint** (token-contract + anti-slop, §4) |
| a11y | **axe** run on the rendered story (Phase 1) |
| protocol conformance | **build gate** — does it `tsc`-compile and mount in Storybook? |

Loop: `generate → buildGate → score(visual, tokens, a11y) → computeComposite + count mustFix →
decideRound` → ship (update baseline) or feed structured failures back and revise; fall back to
`ship_best` after `maxRounds`. Keep their config-validation-up-front and per-round + total timeout/abort
discipline.

---

## 3. The DESIGN.md contract (`design-systems/`) — where beauty comes from

A design system is a folder: `manifest.json` + `DESIGN.md` + `tokens.css` (+ optional `components.html`,
`assets/`, `fonts/`, `preview/`). Three metadata channels, fixed precedence:
`manifest.json` → markdown body (`# H1`, `> Category:`, `> Surface:`, first paragraph summary) →
YAML frontmatter (`name`, `category`, `surface`, `description`, nested `colors:`).

**Token contract** (`token-contract.ts`): a fixed `TOKEN_SCHEMA` of CSS custom properties grouped by role
(color `--bg/--surface/--fg/--accent/--border/…`; type `--font-display/-body/-mono` + `--text-xs…-4xl`;
`--radius-*`; `--elev-*`/`--focus-ring`; `--motion-*`/`--ease-*`; layout `--container-*`/`--section-y-*`).
Raw brand tokens are bound to schema slots with a confidence (`high|medium|low|fallback|alias`) and graded
(`excellent ≥80 / usable ≥60 / needs-review / needs-rebuild`). A **self-check** validates `tokens.css`:
every schema token declared, no non-schema tokens, every `var()` resolves.

**Prompt composition**: parsed identity + **verbatim DESIGN.md body (the 9 H2 sections)** + `tokens.css`
(`:root`) + a *summarized* components manifest + a token-grade summary. The 9 sections are parsed
positionally; their order is the authoring template's order. medesign's `docs/spec.md` keeps these 9
section titles verbatim (compatible superset) and adds a `tokens.css`-backed token layer.

---

## 4. The consistency lint (`lint-artifact.ts`) — blocking AI-slop

A greppy linter returning `{severity: P0|P1|P2, id, message, fix, snippet}`, fed back to the agent P0-first
as a system reminder (this is the self-correction signal). The rules encode "what cheap AI output looks
like" so the agent is pushed back onto the design system. We port these to JSX/Tailwind in
`packages/backend/src/lint/` (see `docs/spec.md` §Consistency lint):

- **P0 (block / self-correct):** purple/indigo gradients (`PURPLE_HEXES`), blue→cyan "trust gradient,"
  solid AI-default-indigo (`#6366f1`…) *outside token definitions*, slop emoji in headings/buttons,
  rounded card + colored `border-left`, sans-serif on headings when the system binds a display face,
  invented metrics (`10× faster`, `99.9% uptime`), filler copy (`lorem ipsum`, `feature one`).
- **P1 (advisory):** ALL-CAPS without `letter-spacing ≥ 0.06em` (token-aware), external placeholder images
  (unsplash/placehold.co/picsum…), too many raw hex outside `:root`, `--accent` overuse (> ~2 visible).
- **Structural:** every schema token present, every `var()` resolves, sections carry a stable anchor id.

The key trick we keep: a value is allowed when it's the system's **declared `--accent`** (strip token
blocks before flagging) — intentional brand color is fine; the same color laundered into a component-local
value is not. Which rules apply is gated by a `craft.applies`/`exemptions` flag (e.g. exempt
`sans-display` for a "modern minimal/tech" system).

---

## 5. Net: medesign's plan vs open-design

- **Adopt:** the 9-section DESIGN.md contract (verbatim titles → import their 70+ systems), the token
  contract + self-check, the anti-slop lint, the harness adapter pattern, the critique gate
  (`computeComposite` + dual-gate `decideRound`) and the no-regression ratchet.
- **Beat:** open-design emits one-off HTML scored by an LLM jury. medesign emits **reusable React/Tailwind
  components + CSF stories** committed to the repo, scored by **deterministic** visual tests + lint, served
  on a **Storybook** front end, refined through a **live change-request loop**.
