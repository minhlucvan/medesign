# Benchmark-Driven Engine Development

**How to systematically improve the emdesign engine using independent measurement.**

The benchmark system is a standalone development tool that measures how well the engine builds components — using **independent** evaluation that does NOT rely on emdesign's own critics. This gives us an objective signal to drive improvements.

---

## The Development Loop

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BENCHMARK-DRIVEN DEVELOPMENT LOOP                     │
│                                                                         │
│  1. MEASURE ─────────────────────────────────────────────────────────┐  │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐   │  │
│  │ Run benchmark │    │  Review report   │    │ Identify weakest │   │  │
│  │ on current    │ →  │  (score per      │ →  │ test + axis     │   │  │
│  │ engine        │    │   test + axis)   │    │                  │   │  │
│  └──────────────┘    └──────────────────┘    └────────┬─────────┘   │  │
│                                                       │              │  │
│  2. HYPOTHESIZE ◄─────────────────────────────────────┘              │  │
│  ┌──────────────┐    ┌──────────────────┐                             │  │
│  │ Form hypothesis│   │ Pick ONE change  │                             │  │
│  │ "If we change  │ ← │ to the engine    │                             │  │
│  │ X, then Y will │   │ (workflow prompt,│                             │  │
│  │ improve"       │   │  gate logic,     │                             │  │
│  └──────┬───────┘    │  MCP tool, agent) │                             │  │
│         │            └──────────────────┘                             │  │
│         ▼                                                              │  │
│  3. IMPLEMENT                                                          │  │
│  ┌──────────────┐                                                     │  │
│  │ Make the ONE │  ← Only one change per cycle. If you change         │  │
│  │ change       │    multiple things, you won't know which one        │  │
│  └──────┬───────┘    caused the effect.                               │  │
│         │                                                              │  │
│         ▼                                                              │  │
│  4. VERIFY ───────────────────────────────────────────────────────────┘  │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │ Re-run        │    │  Compare report  │    │ Score improved?  │       │
│  │ benchmark     │ →  │  vs previous     │ →  │ → KEEP change    │       │
│  │               │    │  run             │    │ → REVERT if not  │       │
│  └──────────────┘    └──────────────────┘    └────────┬─────────┘       │
│                                                       │                  │
│  ┌────────────────────────────────────────────────────┘                  │
│  │                                                                       │
│  ▼                                                                       │
│  Repeat from step 1 — each cycle converges the engine toward            │
│  higher quality, lower cost, faster builds.                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The Four Dimensions

Every change to the engine affects one or more of these dimensions. The benchmark tracks all four:

| Dimension | Metric | Green direction | What it means |
|-----------|--------|----------------|---------------|
| **Quality** | Black-box score (0-1) | ↑ Higher | Components are better — better code, visuals, functionality, accessibility |
| **Consistency** | White-box score (0-1) | ↑ Higher | Components follow tokens, TypeScript, and patterns more strictly |
| **Speed** | Rounds to done | ↓ Lower | The engine reaches "done" in fewer iterations |
| **Cost** | Agent invocations | ↓ Lower | Fewer LLM calls per component — cheaper, faster |

**The rule:** A change is an improvement if it moves ONE dimension in the green direction without regressing any OTHER dimension beyond tolerance (±0.02 composite, ±2 rounds).

---

## Development Workflow

### Step 1: Establish a Baseline

Before making any changes, run the full benchmark suite to establish a baseline:

```bash
claude run-benchmark
```

This runs all 7 test cases through core-loop and produces a report. Save the `bench-results/<runId>/` directory — this is your baseline.

### Step 2: Identify the Weakest Point

Review the benchmark report. Ask:

1. **Which tests failed?** A failing test (overall < 0.80 or black-box < 0.75 or white-box < 0.75) needs attention.
2. **Which axis is weakest?** Look at the per-axis breakdown:
   - Low `general` (B1) → the engine produces poorly structured code
   - Low `visual` (B2) → the engine doesn't match the visual spec
   - Low `functional` (B3) → the engine produces broken components
   - Low `accessibility` (B4) → the engine ignores a11y
   - Low `tokenCompliance` (W1) → the engine uses raw hex instead of tokens
   - Low `typescript` (W2) → the engine generates weak TypeScript
   - Low `complexity` (W3) → the engine produces bloated components
   - Low `patterns` (W4) → the engine doesn't follow conventions
3. **Which tests took the most rounds?** High round count = the engine struggles with that type of component.

**Pick ONE test and ONE axis to improve.** Do not try to fix everything at once.

### Step 3: Form a Hypothesis

State your hypothesis clearly before making any change:

> "If I add 'always use named event handlers' to the build prompt, then the `patterns` score will improve because the engine will generate `handleClick` instead of inline arrow functions."

Or:

> "If I increase the `visual` source floor from 0.85 to 0.90 in the gate, then components will iterate more on visual polish before shipping, improving the black-box visual score."

A good hypothesis has three parts:
- **The change** — what you will modify (one specific thing)
- **The expected effect** — which metric will move and by how much
- **The mechanism** — why this change should have that effect

### Step 4: Implement ONE Change

Make only the change you hypothesized. Do not clean up unrelated code, do not fix other issues you notice. If you change multiple things, you won't know which one caused the result.

Types of changes you can make:

| Area | Example changes |
|------|----------------|
| **Workflow prompt** | Add/remove instructions in `core-loop.js` build prompt. This is the highest-leverage change. |
| **Gate parameters** | Adjust `threshold`, `sourceFloors`, `plateauLimit` in the workflow config |
| **Agent definitions** | Modify `consistency-auditor.md`, `design-reviewer.md`, `vision-critic.md` prompts |
| **MCP tools** | Improve `lint_consistency`, `critique_score`, `vision_critique` logic |
| **Codegen instructions** | Modify `plugin-tailwindcss` codegen instructions in `index.ts` |

### Step 5: Re-run and Compare

Run the benchmark again with the same suite:

```bash
claude run-benchmark
```

The workflow automatically compares against the previous run. Check:

1. **Did the target metric improve?** Yes → good. No → hypothesis was wrong.
2. **Did any OTHER metric regress?** If quality went up but cost doubled, that's a tradeoff to evaluate.
3. **Is the change worth it?** A +0.01 quality improvement for +5 rounds is probably not worth it. A +0.10 improvement for +1 round is excellent.

### Step 6: Keep or Revert

- **If the hypothesis was correct** and the metric improved without regressing others → keep the change. Commit it.
- **If the hypothesis was wrong** and nothing changed → revert. Try a different hypothesis.
- **If there was a side effect** (one metric improved, another regressed) → evaluate the tradeoff. Document it. Either keep with the tradeoff noted, or revert and try a different approach.

### Step 7: Repeat

Pick the NEXT weakest point and repeat. Each cycle converges the engine toward the ideal:

- After several cycles: simple components (Button, MetricCard) pass easily
- After more cycles: medium components (DataTable, FeatureShowcase) pass
- After many cycles: complex components (PricingTable, DashboardView) pass
- Eventually: all 7 tests pass, and you add harder tests

---

## What to Optimize For

### Phase 1: Make it work (quality first)

Ignore cost and speed. Focus on getting all 7 tests to pass with overall ≥ 0.80.

**Hypothesis template:** "If I improve [prompt/agent/tool] to [specific change], then [test name] will pass because [mechanism]."

**Success criteria:** All 7 tests pass. Composite ≥ 0.80 on all.

### Phase 2: Make it consistent (reduce variance)

Once all tests pass, reduce the variance between runs. The same component prompt should produce similar quality every time.

**Hypothesis template:** "If I [specific change], then the standard deviation of [metric] across runs will decrease because [mechanism]."

**Success criteria:** Three consecutive runs produce results within ±0.02 composite for all tests.

### Phase 3: Make it fast (reduce rounds)

Once quality is stable, reduce the number of rounds per component.

**Hypothesis template:** "If I [specific change], then [test name] will reach done in [N] fewer rounds because [mechanism]."

**Success criteria:** Average rounds across all tests ≤ 3, with no composite regression.

### Phase 4: Make it cheap (reduce cost)

Once speed is acceptable, reduce the number of agent invocations per component.

**Hypothesis template:** "If I [specific change], then [test name] will use [N] fewer agents because [mechanism]."

**Success criteria:** Agent invocations per component ≤ 10, with no quality or speed regression.

---

## Interpreting Benchmark Results

### Reading the report

```
Test      │ Overall │ Black-box │ White-box │ Rounds │ Pass
Button    │ 0.91    │ 0.89      │ 0.94      │ 3      │ ✅
DataTable │ 0.78    │ 0.75      │ 0.82      │ 6      │ ❌
```

- **Button passes** — overall = 0.91 ≥ 0.80, black-box = 0.89 ≥ 0.75, white-box = 0.94 ≥ 0.75
- **DataTable fails** — overall = 0.78 < 0.80 AND black-box = 0.75 < 0.75 (borderline)

### Reading the comparison

```
Test      │ Overall Δ │ Rounds Δ │ Regressed?
Button    │ +0.03     │ -1       │ No
DataTable │ -0.05     │ +2       │ Yes ❌
```

- Button improved: +0.03 composite in 1 fewer round
- DataTable regressed: -0.05 composite, +2 more rounds

### Reading the trends

```
Composite trend:  up    ↑
Rounds trend:     down  ↓  (improving — fewer rounds)
Duration trend:   down  ↓  (improving — faster)
```

All three trending green = the engine is improving across the board.

---

## Adding Tests

As the engine improves, add harder tests to `suite.json`:

```json
{
  "name": "TransactionChart",
  "instruction": "An interactive line chart showing daily transaction volumes over 30 days. X-axis: dates, Y-axis: volume. Tooltip on hover. Responsive.",
  "complexity": "complex",
  "expectedMinComposite": 0.80,
  "expectedMaxRounds": 8
}
```

Guidelines for good test cases:
- **Realistic** — based on actual components the engine will need to build
- **Specific** — includes exact token roles, sizes, and behaviors to test for
- **Measurable** — the black-box and white-box metrics can detect improvement
- **Incremental** — new tests should be slightly harder than the current hardest passing test

---

## Principles

### One change per cycle
If you change the prompt, the gate threshold, and the agent definition all at once and the score goes up by 0.05, you don't know which change caused it. Change one thing, measure, then change the next.

### Trust the benchmark, not intuition
It's easy to think "this prompt improvement will definitely help." Run the benchmark. If the score doesn't move, the change didn't help — regardless of how good it sounds. Revert and try something else.

### Black-box is the ground truth
The black-box score (general code review + visual + functional + a11y) is the closest thing to "would a senior engineer approve this component?" If the black-box score is low but the white-box score is high, the component follows rules but doesn't look or work right. Focus on the user-visible outcome.

### White-box catches regressions
The white-box score (token compliance + TypeScript + complexity + patterns) is deterministic. It catches regressions that black-box might miss — like the engine suddenly generating raw hex everywhere while still producing decent-looking components.

### If you can't measure it, you can't improve it
Every change must have a hypothesized effect on a measurable metric. If you can't state what metric your change will move, you're not ready to make the change.

---

## Quick Reference

```bash
# Run the full suite
claude run-benchmark

# Quick run (simple tests only)
claude run-benchmark --filter simple

# Run after making a change
claude run-benchmark

# Manual: compare two runs
node benchmarks/scripts/compare.mjs bench-results/run-a bench-results/run-b

# Manual: generate HTML report
node benchmarks/scripts/report.mjs bench-results/latest
```

## Directory Structure

```
benchmarks/
├── README.md                   # This file
├── suite.json                  # Test case definitions
├── benchmark-types.ts          # TypeScript types (standalone)
├── benchmark-report.ts         # Report generation + comparison logic
├── run-benchmark.js            # Claude workflow orchestrator
├── agents/
│   └── benchmark-critic.md     # Independent code reviewer (no emdesign context)
└── scripts/
    ├── visual-check.mjs        # Playwright screenshot + pixelmatch
    ├── functional-check.mjs    # Playwright render + interaction + error check
    ├── a11y-check.mjs          # Playwright + axe-core (standalone)
    └── metrics.mjs             # White-box analysis (regex, no LLM)

bench-results/                  # Created by running the benchmark
└── <run-id>/
    ├── summary.json            # Aggregated results
    ├── comparison.json         # vs previous run (if available)
    └── test-<Name>/
        ├── source.tsx          # Generated component source
        └── source-analysis.json # White-box metrics
```
