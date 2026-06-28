// auto-fix-workflow.js
// Auto-diagnose a component across ALL check dimensions (visual, lint, spatial, a11y, vision),
// surface findings to the user with suggested fixes, and apply them on confirmation.
// Supports two modes: guided (confirm each fix) and auto (one-click apply + verify).
//
// Usage: workflow('auto-fix-workflow', { name, mode: 'guided'|'auto', vision: false })
export const meta = {
  name: 'auto-fix-workflow',
  description: 'Auto-diagnose component across visual, lint, spatial, a11y, and vision checks. Guided fix with user confirmation or one-click auto-fix + re-verify.',
  phases: [
    { title: 'Baseline' },
    { title: 'Diagnose' },
    { title: 'Analyze' },
    { title: 'Propose Fixes' },
    { title: 'Apply' },
    { title: 'Re-verify' },
    { title: 'Report' },
  ],
}

const { name, mode = 'guided', vision = false } = args

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractIssues(label, data, source, parserFn) {
  if (!data) return []
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    if (!parsed.ok) return []
    return parserFn(parsed.data || parsed) || []
  } catch {
    return []
  }
}

function makeFindings(issues) {
  return issues
    .filter(Boolean)
    .sort((a, b) => a.priority.localeCompare(b.priority))
}

// ── Stage 1: Baseline ────────────────────────────────────────────────────────

phase('Baseline')
log(`[auto-fix] Establishing baseline for ${name} (mode: ${mode}, vision: ${vision})`)

let baseline = null
try {
  const result = await $`emdesign doctor all ${name} --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    baseline = {
      composite: parsed.data?.composite ?? 0,
      mustFix: parsed.data?.mustFix ?? 0,
      decision: parsed.data?.decision ?? 'revise',
      scores: parsed.data?.scores ?? {},
    }
    log(`[auto-fix] Baseline: composite=${(baseline.composite * 100).toFixed(0)}%, mustFix=${baseline.mustFix}, decision=${baseline.decision}`)
  }
} catch (e) {
  log(`[auto-fix] ⚠️ Baseline unavailable: ${e.message}`)
}

// Check Storybook health for visual/spatial tests
let storybookHealthy = false
try {
  const health = await $`emdesign storybook health --json`
  const h = JSON.parse(health)
  storybookHealthy = h.data?.status === 'healthy' || h.data?.status === 'degraded'
  if (!storybookHealthy) log(`[auto-fix] ⚠️ Storybook: ${h.data?.status} — visual/spatial checks may be limited`)
} catch {
  log(`[auto-fix] ⚠️ Storybook health check unavailable — assuming healthy`)
  storybookHealthy = true
}

// ── Stage 2: Diagnose (run ALL checks in parallel) ───────────────────────────

phase('Diagnose')
log(`[auto-fix] Running parallel diagnostics on ${name}`)

const startTime = Date.now()

// Run all probes concurrently using parallel()
const probes = await parallel([
  // 1. Visual check (screenshot comparison against baseline)
  async () => {
    if (!storybookHealthy) return { source: 'visual', ok: false, error: 'Storybook not healthy' }
    try {
      const result = await $`emdesign doctor visual ${name} --json 2>/dev/null || echo '{"ok":false}'`
      return { source: 'visual', ...JSON.parse(result) }
    } catch (e) {
      return { source: 'visual', ok: false, error: e.message }
    }
  },

  // 2. Consistency lint (token binding, anti-patterns)
  async () => {
    try {
      const result = await $`emdesign doctor lint ${name} --json 2>/dev/null || echo '{"ok":false}'`
      return { source: 'lint', ...JSON.parse(result) }
    } catch (e) {
      return { source: 'lint', ok: false, error: e.message }
    }
  },

  // 3. Spatial audit (overlaps, grid alignment)
  async () => {
    if (!storybookHealthy) return { source: 'spatial', ok: false, error: 'Storybook not healthy' }
    try {
      const result = await $`emdesign spatial audit ${name} --grid --json 2>/dev/null || echo '{"ok":false}'`
      return { source: 'spatial', ...JSON.parse(result) }
    } catch (e) {
      return { source: 'spatial', ok: false, error: e.message }
    }
  },

  // 4. Accessibility audit
  async () => {
    try {
      const result = await $`emdesign component a11y ${name} --json 2>/dev/null || echo '{"ok":false}'`
      return { source: 'a11y', ...JSON.parse(result) }
    } catch (e) {
      return { source: 'a11y', ok: false, error: e.message }
    }
  },

  // 5. Render analyze (DOM tree structure)
  async () => {
    if (!storybookHealthy) return { source: 'render', ok: false, error: 'Storybook not healthy' }
    try {
      const result = await $`emdesign render analyze ${name} --json 2>/dev/null || echo '{"ok":false}'`
      return { source: 'render', ...JSON.parse(result) }
    } catch (e) {
      return { source: 'render', ok: false, error: e.message }
    }
  },

  // 6. Component diff (check if generated vs captured match)
  async () => {
    try {
      const result = await $`emdesign component diff ${name} --json 2>/dev/null || echo '{"ok":false}'`
      return { source: 'diff', ...JSON.parse(result) }
    } catch (e) {
      return { source: 'diff', ok: false, error: e.message }
    }
  },

  // 7. Optional: Vision critique (LLM reads the screenshot)
  ...(vision
    ? [
        async () => {
          if (!storybookHealthy) return { source: 'vision', ok: false, error: 'Storybook not healthy' }
          try {
            const result = await $`emdesign vision ${name} --json 2>/dev/null || echo '{"ok":false}'`
            return { source: 'vision', ...JSON.parse(result) }
          } catch (e) {
            return { source: 'vision', ok: false, error: e.message }
          }
        },
      ]
    : []),
])

const elapsed = Date.now() - startTime
log(`[auto-fix] All probes completed in ${elapsed}ms`)

// Log probe summary
for (const p of probes) {
  if (p?.ok) {
    log(`[auto-fix]   ✅ ${p.source}: available`)
  } else if (p) {
    log(`[auto-fix]   ⚠️ ${p.source}: ${p.error || 'unavailable'}`)
  }
}

// ── Stage 3: Analyze & Aggregrate ────────────────────────────────────────────

phase('Analyze')
log(`[auto-fix] Aggregating findings`)

const findings = []

// ── Parse visual check ──
const visualProbe = probes.find(p => p?.source === 'visual')
if (visualProbe?.ok) {
  const score = visualProbe.data?.scores?.visual ?? 1
  if (score < 0.85) {
    findings.push({
      priority: score < 0.6 ? 'P0' : 'P1',
      source: 'visual',
      type: 'visual-regression',
      message: `Visual score ${(score * 100).toFixed(0)}% — below 85% threshold`,
      detail: visualProbe.data?.message || `Score: ${(score * 100).toFixed(0)}%`,
      fixable: false,
      autoFixHint: 'Review component styling for visual regressions. Check spacing, colors, and layout against design system.',
    })
  }
  if (visualProbe.data?.diffPixels != null && visualProbe.data.diffPixels > 0) {
    findings.push({
      priority: visualProbe.data.diffPixels > 50 ? 'P1' : 'P2',
      source: 'visual',
      type: 'pixel-drift',
      message: `${visualProbe.data.diffPixels} pixel(s) differ from baseline screenshot`,
      detail: `Diff area: ${visualProbe.data.diffPercentage?.toFixed(1) ?? '?'}% of viewport`,
      fixable: false,
      autoFixHint: 'Screenshot differs from baseline — verify the change is intentional.',
    })
  }
}

// ── Parse lint findings ──
const lintProbe = probes.find(p => p?.source === 'lint')
if (lintProbe?.ok) {
  const data = lintProbe.data
  const dataFindings = data?.findings ?? []
  for (const f of dataFindings) {
    const isP0 = f.severity === 'P0' || f.severity === 'error'
    findings.push({
      priority: isP0 ? 'P0' : 'P1',
      source: 'lint',
      type: f.kind || 'lint-violation',
      message: f.message || f.title || 'Lint violation',
      detail: f.remediation || f.description || '',
      file: f.file || '',
      line: f.line || 0,
      fixable: isP0 && !!f.token,
      fixCandidate: f.token
        ? {
            type: 'token-binding',
            file: f.file,
            line: f.line,
            oldValue: f.rawValue,
            newValue: f.token.startsWith('--') ? f.token : `var(${f.token})`,
            description: `Replace with token ${f.token}`,
          }
        : null,
      autoFixHint: f.remediation || (f.token ? `Use token ${f.token}` : 'Review lint rule'),
    })
  }
}

// ── Parse spatial findings ──
const spatialProbe = probes.find(p => p?.source === 'spatial')
if (spatialProbe?.ok) {
  const data = spatialProbe.data
  const overlaps = data?.overlaps ?? []
  const gridViolations = data?.grid?.violations ?? 0

  for (const o of overlaps.slice(0, 10)) {
    findings.push({
      priority: 'P1',
      source: 'spatial',
      type: 'overlap',
      message: `"${o.a}" overlaps "${o.b}" by ${o.overlapPx}px`,
      detail: `Overlap of ${o.overlapPx}px at (${o.bbox?.x ?? '?'}, ${o.bbox?.y ?? '?'})`,
      fixable: o.overlapPx <= 10,
      fixCandidate: o.overlapPx <= 10
        ? {
            type: 'spacing',
            file: '',
            line: 0,
            oldValue: '',
            newValue: '',
            description: `Adjust spacing to resolve ${o.overlapPx}px overlap`,
          }
        : null,
      autoFixHint: o.overlapPx <= 10
        ? `Adjust margin/padding by ${Math.ceil(o.overlapPx / 4) * 4}px`
        : `Manual layout fix needed (${o.overlapPx}px overlap)`,
    })
  }

  if (gridViolations > 0) {
    findings.push({
      priority: 'P1',
      source: 'spatial',
      type: 'grid-violation',
      message: `${gridViolations} element(s) not on ${data.grid?.gridSize ?? 8}px grid`,
      detail: `Grid unit: ${data.grid?.gridSize ?? 8}px`,
      fixable: true,
      fixCandidate: {
        type: 'grid-alignment',
        file: '',
        line: 0,
        oldValue: '',
        newValue: '',
        description: `Snap ${gridViolations} element(s) to ${data.grid?.gridSize ?? 8}px grid`,
      },
      autoFixHint: `Snap positions/margins to ${data.grid?.gridSize ?? 8}px grid units`,
    })
  }

  if (data?.nodeCount != null) {
    log(`[auto-fix]   Spatial: ${data.nodeCount} nodes, ${overlaps.length} overlaps, ${gridViolations} grid violations`)
  }
}

// ── Parse a11y findings ──
const a11yProbe = probes.find(p => p?.source === 'a11y')
if (a11yProbe?.ok) {
  const data = a11yProbe.data
  const violations = data?.violations ?? []
  const summary = data?.summary ?? {}

  for (const v of violations) {
    const isCritical = v.impact === 'critical' || v.impact === 'serious'
    findings.push({
      priority: isCritical ? 'P0' : 'P1',
      source: 'a11y',
      type: v.id?.toLowerCase()?.replace(/\s+/g, '-') || 'a11y-violation',
      message: v.help || `${v.id}: Accessibility violation`,
      detail: v.description || '',
      fixable: false,
      autoFixHint: v.nodes?.[0]?.failureSummary || 'Review accessibility guidelines for this pattern',
    })
  }

  log(`[auto-fix]   A11y: ${summary.totalViolations ?? 0} violations (${summary.totalCritical ?? 0} critical)`)
}

// ── Parse render analysis ──
const renderProbe = probes.find(p => p?.source === 'render')
if (renderProbe?.ok) {
  const metrics = renderProbe.data?.metrics ?? {}
  const depth = metrics.depth ?? 0
  if (depth > 15) {
    findings.push({
      priority: 'P2',
      source: 'render',
      type: 'deep-dom',
      message: `DOM tree depth ${depth} — may impact rendering performance`,
      detail: `Node count: ${metrics.nodeCount ?? 0}, Depth: ${depth}`,
      fixable: false,
      autoFixHint: 'Consider flattening the component structure. Split nested wrappers.',
    })
  }
  log(`[auto-fix]   Render: ${metrics.nodeCount ?? 0} nodes, depth ${depth}`)
}

// ── Parse vision findings (if available) ──
const visionProbe = probes.find(p => p?.source === 'vision')
if (visionProbe?.ok) {
  const visionData = visionProbe.data
  const visionFindings = visionData?.findings ?? []

  for (const vf of visionFindings) {
    findings.push({
      priority: vf.severity === 'critical' ? 'P0' : vf.severity === 'major' ? 'P1' : 'P2',
      source: 'vision',
      type: vf.kind || 'visual-polish',
      message: vf.message || 'Vision critique finding',
      detail: vf.detail || '',
      fixable: vf.fixable === true,
      fixCandidate: vf.fixCandidate || null,
      autoFixHint: vf.suggestion || '',
    })
  }

  log(`[auto-fix]   Vision: ${visionFindings.length} finding(s)`)
}

// Sort: P0 → P1 → P2, then by source
const sortedFindings = makeFindings(findings)
const p0Count = sortedFindings.filter(f => f.priority === 'P0').length
const p1Count = sortedFindings.filter(f => f.priority === 'P1').length
const p2Count = sortedFindings.filter(f => f.priority === 'P2').length
const fixableCount = sortedFindings.filter(f => f.fixable).length
const needsHumanCount = sortedFindings.filter(f => !f.fixable).length

log(`[auto-fix] === Diagnostic Summary ===`)
log(`[auto-fix]   P0 (blocking): ${p0Count}`)
log(`[auto-fix]   P1 (important): ${p1Count}`)
log(`[auto-fix]   P2 (advisory):  ${p2Count}`)
log(`[auto-fix]   Auto-fixable:   ${fixableCount}`)
log(`[auto-fix]   Needs human:    ${needsHumanCount}`)

// ── Stage 4: Propose Fixes ───────────────────────────────────────────────────

phase('Propose Fixes')

const autoFixable = sortedFindings.filter(f => f.fixable)
const needsHuman = sortedFindings.filter(f => !f.fixable)

// Group fixable findings by type for clean presentation
const fixGroups = {}
for (const f of autoFixable) {
  const type = f.type
  if (!fixGroups[type]) fixGroups[type] = []
  fixGroups[type].push(f)
}

const fixSummary = Object.entries(fixGroups).map(([type, items]) => ({
  type,
  count: items.length,
  example: items[0]?.message || type,
}))

if (autoFixable.length > 0) {
  log(`[auto-fix] 🪄 ${autoFixable.length} auto-fixable issue(s) found:`)
  for (const group of fixSummary) {
    log(`[auto-fix]   • ${group.type.replace('-', ' ')} (${group.count}x): ${group.example}`)
  }
}

if (needsHuman.length > 0) {
  log(`[auto-fix] 👤 ${needsHuman.length} issue(s) need human review:`)
  for (const f of needsHuman.slice(0, 5)) {
    log(`[auto-fix]   • [${f.priority}] ${f.source}: ${f.message}`)
  }
  if (needsHuman.length > 5) {
    log(`[auto-fix]   ... and ${needsHuman.length - 5} more`)
  }
}

// ── Stage 5: Apply (guided or auto) ──────────────────────────────────────────

phase('Apply')

let applied = []
let skipped = []

if (autoFixable.length === 0) {
  log(`[auto-fix] ✅ No auto-fixable issues — nothing to apply`)
} else if (mode === 'guided') {
  // In guided mode, we return findings and let the caller ask the user.
  // The caller re-invokes with mode='auto' and confirmedFixes after user approval.
  log(`[auto-fix] 📋 Guided mode: returning ${autoFixable.length} fixable issue(s) for user review`)

  // Return the findings so the caller/agent can present them to the user
  return {
    name,
    mode: 'guided',
    awaitingConfirmation: true,
    baseline,
    diagnosticSummary: {
      total: sortedFindings.length,
      p0: p0Count,
      p1: p1Count,
      p2: p2Count,
      fixable: fixableCount,
      needsHuman: needsHumanCount,
    },
    probes: {
      visual: { ok: !!visualProbe?.ok, score: visualProbe?.data?.scores?.visual ?? null },
      lint: { ok: !!lintProbe?.ok, mustFix: lintProbe?.data?.mustFix ?? null, composite: lintProbe?.data?.composite ?? null },
      spatial: { ok: !!spatialProbe?.ok, overlaps: spatialProbe?.data?.overlaps?.length ?? 0, gridViolations: spatialProbe?.data?.grid?.violations ?? 0 },
      a11y: { ok: !!a11yProbe?.ok, violations: a11yProbe?.data?.summary?.totalViolations ?? 0 },
      vision: { ok: !!visionProbe?.ok },
    },
    findings: sortedFindings,
    autoFixable,
    needsHuman,
    fixGroups: fixSummary,
    elapsed,
    _instructions: `Present findings to the user. Ask "Apply ${autoFixable.length} auto-fix(es)?" — if yes, re-invoke with { mode: 'auto', confirmedFixes: ${JSON.stringify(autoFixable.map(f => ({ type: f.type, message: f.message, source: f.source })))} }`,
  }
}

// Auto mode: apply all fixable issues
if (mode === 'auto') {
  for (const f of autoFixable) {
    // Token binding fixes: use element-workflow
    if (f.fixCandidate?.type === 'token-binding' && f.file && f.line) {
      try {
        const result = await workflow('element-workflow', { name, type: 'token', finding: f.message })
        applied.push({ ...f, status: result.fixed ? 'applied' : 'failed' })
        if (result.fixed) {
          log(`[auto-fix]   ✅ Applied token fix: ${f.message}`)
        } else {
          log(`[auto-fix]   ⚠️ Token fix failed: ${f.message}`)
        }
      } catch (e) {
        applied.push({ ...f, status: 'failed', error: e.message })
        log(`[auto-fix]   ❌ Token fix error: ${e.message}`)
      }
      continue
    }

    // For other fix types, log what would be fixed
    // The actual fix is applied by the caller/agent (source code edit)
    applied.push({ ...f, status: 'pending-agent-edit' })
    log(`[auto-fix]   🎯 Fix needed: ${f.message} (${f.autoFixHint})`)
  }
}

// ── Stage 6: Re-verify ───────────────────────────────────────────────────────

phase('Re-verify')
log(`[auto-fix] Re-verifying ${name} after fixes`)

let postFix = null
let gatePassed = false
let regressed = false
let rollbackNeeded = false

try {
  const result = await $`emdesign doctor all ${name} --gate --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    postFix = {
      composite: parsed.data?.composite ?? 0,
      mustFix: parsed.data?.mustFix ?? 0,
      decision: parsed.data?.decision ?? 'revise',
      scores: parsed.data?.scores ?? {},
      findings: parsed.data?.findings ?? [],
    }

    gatePassed = postFix.decision === 'ship'

    // Compare to baseline
    if (baseline) {
      const compositeDelta = postFix.composite - baseline.composite
      const mustFixDelta = postFix.mustFix - baseline.mustFix
      regressed = compositeDelta < -0.05 || mustFixDelta > 0

      if (regressed) {
        log(`[auto-fix] ⚠️ Regression detected: composite ${(postFix.composite * 100).toFixed(0)}% (Δ${(compositeDelta * 100).toFixed(0)}%), mustFix ${postFix.mustFix} (Δ${mustFixDelta > 0 ? '+' : ''}${mustFixDelta})`)
      }

      if (gatePassed) {
        log(`[auto-fix] ✅ Gate passed! composite=${(postFix.composite * 100).toFixed(0)}%, mustFix=${postFix.mustFix}`)
        if (compositeDelta > 0) log(`[auto-fix] 📈 Composite improved by ${(compositeDelta * 100).toFixed(0)}%`)
      } else if (regressed) {
        log(`[auto-fix] ❌ Gate failed WITH regression — rollback recommended`)
        rollbackNeeded = true
      } else {
        log(`[auto-fix] ❌ Gate failed but no regression (baseline was also failing)`)
      }
    } else {
      if (gatePassed) {
        log(`[auto-fix] ✅ Gate passed! composite=${(postFix.composite * 100).toFixed(0)}%`)
      } else {
        log(`[auto-fix] ❌ Gate failed: composite=${(postFix.composite * 100).toFixed(0)}%, mustFix=${postFix.mustFix}`)
      }
    }
  }
} catch (e) {
  log(`[auto-fix] ❌ Re-verify failed: ${e.message}`)
}

// ── Stage 7: Report ──────────────────────────────────────────────────────────

phase('Report')

const result = {
  name,
  mode,
  baseline,
  elapsed,
  diagnosticSummary: {
    total: sortedFindings.length,
    p0: p0Count,
    p1: p1Count,
    p2: p2Count,
    fixable: fixableCount,
    needsHuman: needsHumanCount,
  },
  probes: {
    visual: { ok: !!visualProbe?.ok, score: visualProbe?.data?.scores?.visual ?? null },
    lint: { ok: !!lintProbe?.ok, mustFix: lintProbe?.data?.mustFix ?? null, composite: lintProbe?.data?.composite ?? null },
    spatial: { ok: !!spatialProbe?.ok, overlaps: spatialProbe?.data?.overlaps?.length ?? 0, gridViolations: spatialProbe?.data?.grid?.violations ?? 0 },
    a11y: { ok: !!a11yProbe?.ok, violations: a11yProbe?.data?.summary?.totalViolations ?? 0 },
    render: { ok: !!renderProbe?.ok, depth: renderProbe?.data?.metrics?.depth ?? null },
    vision: { ok: !!visionProbe?.ok },
  },
  findings: sortedFindings,
  autoFixable,
  needsHuman,
  applied,
  skipped,
  postFix,
  gate: gatePassed ? 'pass' : regressed ? 'regression' : 'fail',
  regressed,
  rollbackNeeded,
  improvements: [],
}

// Compute improvement summary
if (baseline && postFix) {
  const compositeDelta = (postFix.composite - baseline.composite) * 100
  const mustFixDelta = baseline.mustFix - postFix.mustFix

  if (compositeDelta > 0) {
    result.improvements.push(`Composite score improved by ${compositeDelta.toFixed(1)}%`)
  }
  if (mustFixDelta > 0) {
    result.improvements.push(`${mustFixDelta} P0 issue(s) resolved`)
  }
  if (postFix.composite >= 0.85 && postFix.decision === 'ship') {
    result.improvements.push('Component passes all quality gates — ready for capture')
  }
  if (postFix.composite < 0.85) {
    result.improvements.push(`Component needs further work: composite ${(postFix.composite * 100).toFixed(0)}% < 85%`)
  }
  if (needsHuman.length > 0) {
    result.improvements.push(`${needsHuman.length} issue(s) flagged for human review`)
  }
}

log(`[auto-fix] === ${name} Auto-Fix Complete ===`)
log(`[auto-fix]   Findings: ${sortedFindings.length} (fixable: ${fixableCount}, needsHuman: ${needsHumanCount})`)
log(`[auto-fix]   Applied:   ${applied.filter(a => a.status === 'applied' || a.status === 'pending-agent-edit').length}`)
log(`[auto-fix]   Gate:      ${result.gate}`)
log(`[auto-fix]   Elapsed:   ${elapsed}ms`)

return result
