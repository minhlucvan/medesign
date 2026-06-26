# The medesign harness engine

How **workflow + skills + tools** drive the agent in a **positive feedback loop** that turns an idea into a
component that is **beautiful, consistent, testable, shippable** — by feeding it four independent feedback
sources and gating on a single authoritative score. Modeled on the spec-driven Claude Code conventions of
[`mzspec`](https://github.com/minhlucncc/mzspec).

## Four components

```
 1. CLAUDE WORKSPACE (.claude/)        2. CLI (`medesign`)        3. SERVER (daemon)        4. FRONTEND
    commands /mds:*                       thin client the AI         engines: generation,      Storybook add-on
    subagents (critics)        ──CLI──▶   invokes; gates call   ──▶  graph, lint, visual,  ◀──  live preview, diff,
    skills (+ router)          ──MCP──────────────────────────▶      critique               ──  scores, HUMAN
    workflow engine + gates                proxies HTTP / embeds      MCP + HTTP + state         change-requests
```

- **Workspace** `.claude/` — the agent-facing orchestration. Operates on the project source.
- **CLI** `medesign` — what the agent + gates invoke; proxies to the running server when up, else embeds the engine.
- **Server** `@medesign/backend` — the engines behind **MCP + HTTP**; owns state (`.medesign/`, `design-systems/<id>/graph.json`).
- **Frontend** `@medesign/addon` — live design surface + the **human** feedback channel.

## The loop

```
analyze context ─▶ understand intent ─▶ build ─▶ VERIFY (4 sources) ─▶ GATE ─▶ ship
   graph            design/changes/      create/    rule·visual·vision·LLM   critique_score   capture +
 consistencyBrief    <slug>/intent.md   edit_       (+ human change-reqs)    composite+gate    evidence
 + getContext        + brief.md         component    each → score + mustFix   + ratchet
        ▲                                                                         │ fail → whereToFix (file:line)
        └─────────────────────────── revise ─────────────────────────────────────┘
```

## The four feedback sources

| Source | Who produces it | Tool / agent | Output |
|---|---|---|---|
| **Programmatic / rule** | server | `lint_consistency` + `graph_where_to_fix` (via `consistency-auditor`) | `tokens` score + P0/P1 + file:line fixes |
| **Visual regression** | server | `run_visual_test` (Playwright + pixelmatch) | `visual` score (pass/new=1, changed=0.5) |
| **Vision** | workspace | `vision-critic` subagent Reads `screenshot_path` | `vision` score (hierarchy/balance/rhythm/on-brand/polish) + findings |
| **LLM** | workspace | `design-reviewer` subagent (code + spec + DESIGN.md) | `llm` score (composition/api/semantics/intent/voice) + findings |
| **Human** | frontend | addon change-requests → `/mds:refine` | re-enters the loop as new intent |

## The gate (how "done" is decided)

`critique_score` (server, `packages/backend/src/critique/`) is the single authoritative call:

```
composite = weighted mean over PRESENT scores   (weights: tokens .3, visual .25, vision .25, llm .15, a11y .05)
decision  = 'ship'  iff  composite ≥ threshold (0.8)  AND  mustFix === 0  AND  composite ≥ baseline (ratchet)
            'continue' otherwise
```

Two properties carried from open-design's critique engine:
- **Dual gate** — a high average can't override a blocking issue (`mustFix` from P0 lint / failed build /
  P0 vision = a hard stop). Verified: scores {0.95,1,0.95} with `mustFix:1` → `continue`.
- **Ratchet** — a passing component only replaces its baseline if it scores at least as high; quality never
  regresses across iterations.

The deterministic tools are authoritative — pass/fail comes from `critique_score`, never from prose.

## Claude Code wiring (mzspec conventions)

- **Commands** `.claude/commands/mds/*.md` — `/mds:design` (full loop), `/mds:review` (one-shot critique),
  `/mds:refine` (human feedback), `/mds:vision` (vision only), `/mds:ship` (gate + capture). Frontmatter
  `name`/`description`/`category`/`tags`; each has `AskUserQuestion` + `**Guardrails**`; `/mds:design` runs
  the engine via `Workflow({name:'design-loop'})`.
- **Subagents** `.claude/agents/*.md` — `vision-critic`, `design-reviewer`, `consistency-auditor` (the
  independent critics fanned out in parallel).
- **Skills** `.claude/skills/*` — `using-design-skills` (the meta-router: phase → skill + command + sources),
  `component-build`, `design-review`, `design-md`, `color-expert`. open-design's full 159-skill library is
  vendored at `skills/_vendor/open-design/` (Apache-2.0, see its `ATTRIBUTION.md` + `CATALOG.md`).
- **Workflow engine** `.claude/workflows/design-loop.js` — the headless counterpart: builds, fans out the
  four critics with `parallel()`, gates with `critique_score`, loops; shares the same gate as the interactive path.
- **Gates** `scripts/gates/{lint,visual,build}.sh` — **exit code = verdict** (mzspec style), wrapping the CLI.

## Worked run

```
$ medesign serve            # server (MCP + HTTP) on :4321
$ npm run studio            # Storybook + medesign panel on :6006
# in Claude Code:
> /mds:design "a testimonial section with three quotes" Testimonials
  1. AskUserQuestion → confirm name/system/threshold
  2. get_design_context → consistency brief (primitives, tokens, vibe)
  3. design/changes/testimonials/{intent,brief}.md
  4. Workflow design-loop:
       r1 build → critique [tokens .7 (1×P0 off-token), visual new=1, vision .62, llm .8] → mustFix 1 → CONTINUE
          whereToFix: use --color-accent (atelier/tokens.css:8) at Testimonials.tsx:24
       r2 edit  → critique [tokens 1, visual .5 changed, vision .81, llm .88] → composite .84 → CONTINUE
       r3 edit  → critique [tokens 1, visual 1, vision .9, llm .9]  → composite .94, mustFix 0 → SHIP
  5. panel shows the four scores + SHIP; human approves
> /mds:ship Testimonials   → capture_reusable_component + record_evidence + graph_rebuild
```

Evidence for every round (scores + screenshot) lands under `design/changes/testimonials/evidence/`.

## Lineage
- **open-design** → the design-quality engine (DESIGN.md contract, consistency lint, critique gate) — see
  [`open-design-analysis.md`](./open-design-analysis.md); its skill library is vendored.
- **mzspec** → the Claude Code workflow shape (commands ending in a `Workflow()` call, meta-router skill,
  exit-code gates, evidence-required, human checkpoints, never-self-ship).
- **medesign** adds: code-first reusable components, the knowledge graph ([`data-model.md`](./data-model.md)),
  and the **vision** feedback source — fused into one loop.
