// component-audit.js
// Full audit of a single component — deterministic gates only, no vision/LLM.
// Runs render analyze + spatial audit + a11y + doctor all to produce a prioritized fix list.
//
// Usage: workflow('component-audit', { name })
export const meta = {
  name: 'component-audit',
  description: 'Full component audit: render analyze → spatial audit → a11y → doctor all. Prioritized fix list.',
  phases: [{ title: 'Score Check' }, { title: 'Deep Analysis' }, { title: 'Compile Report' }],
}

const { name } = args

phase('Score Check')
log(`[audit] Starting audit of ${name}`)

// Get current doctor scores
let doctorResult = null
try {
  const result = await $`emdesign doctor all ${name} --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) doctorResult = parsed.data
  log(`[audit] Current: composite=${doctorResult?.composite?.toFixed(3) ?? 'N/A'}, mustFix=${doctorResult?.mustFix ?? 'N/A'}`)
} catch (e) {
  log(`[audit] Doctor unavailable: ${e.message}`)
}

phase('Deep Analysis')
log(`[audit] Running deep analysis`)

// Render analyze
let renderData = null
try {
  const result = await $`emdesign render analyze ${name} --json 2>/dev/null`
  const parsed = JSON.parse(result)
  if (parsed.ok) renderData = parsed.data
  log(`[audit] Render: ${renderData?.metrics?.nodeCount ?? 0} nodes, depth ${renderData?.metrics?.depth ?? 0}`)
} catch { /* render unavailable */ }

// Spatial audit
let spatialData = null
try {
  const result = await $`emdesign spatial audit ${name} --grid --json 2>/dev/null`
  const parsed = JSON.parse(result)
  if (parsed.ok) spatialData = parsed.data
  log(`[audit] Spatial: ${spatialData?.overlaps?.length ?? 0} overlaps`)
} catch { /* spatial unavailable */ }

// A11y audit
let a11yData = null
try {
  const result = await $`emdesign component a11y ${name} --json 2>/dev/null`
  const parsed = JSON.parse(result)
  if (parsed.ok) a11yData = parsed.data
  const total = a11yData?.summary?.totalViolations ?? 0
  log(`[audit] A11y: ${total} violations`)
} catch { /* a11y unavailable */ }

// Component diff
let diffData = null
try {
  const result = await $`emdesign component diff ${name} --json 2>/dev/null`
  const parsed = JSON.parse(result)
  if (parsed.ok) diffData = parsed.data
} catch { /* diff unavailable */ }

phase('Compile Report')
log(`[audit] Compiling findings`)

// Build prioritized fix list
const findings = []

// P0: Lint and a11y critical
if (doctorResult?.findings) {
  for (const f of doctorResult.findings) {
    if (f.severity === 'P0') findings.push({ priority: 'P0', source: f.kind, message: f.message, remediation: f.remediation })
  }
}
if (a11yData?.violations) {
  for (const v of a11yData.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')) {
    findings.push({ priority: v.impact === 'critical' ? 'P0' : 'P1', source: 'a11y', message: `${v.id}: ${v.help}` })
  }
}

// P1: Spatial, visual, a11y moderate
if (spatialData?.overlaps?.length > 0) {
  findings.push({ priority: 'P1', source: 'spatial', message: `${spatialData.overlaps.length} overlap(s) detected` })
}
if (a11yData?.summary?.byImpact?.moderate > 0) {
  findings.push({ priority: 'P1', source: 'a11y', message: `${a11yData.summary.byImpact.moderate} moderate a11y issue(s)` })
}
if (spatialData?.grid?.violations > 0) {
  findings.push({ priority: 'P1', source: 'spatial', message: `${spatialData.grid.violations} grid violation(s)` })
}

// P2: Minor issues, advisories
if (doctorResult?.mustFix === 0 && doctorResult?.composite < 0.95) {
  findings.push({ priority: 'P2', source: 'composite', message: `Composite ${(doctorResult.composite * 100).toFixed(0)}% — below 95%` })
}

log(`[audit] ${findings.length} finding(s): ${findings.filter(f => f.priority === 'P0').length} P0, ${findings.filter(f => f.priority === 'P1').length} P1, ${findings.filter(f => f.priority === 'P2').length} P2`)

return {
  name,
  scores: {
    composite: doctorResult?.composite,
    mustFix: doctorResult?.mustFix,
    tokens: doctorResult?.scores?.tokens,
    visual: doctorResult?.scores?.visual,
    spatial: spatialData?.nodeCount ? 1 : 0,
    a11y: a11yData?.summary?.totalViolations === 0 ? 1 : 0,
  },
  metrics: {
    domNodes: renderData?.metrics?.nodeCount,
    domDepth: renderData?.metrics?.depth,
    overlaps: spatialData?.overlaps?.length ?? 0,
    gridViolations: spatialData?.grid?.violations ?? 0,
    a11yViolations: a11yData?.summary?.totalViolations ?? 0,
  },
  findings: findings.sort((a, b) => a.priority.localeCompare(b.priority)),
  diff: diffData ? { same: diffData.sameContent, sizes: { generated: diffData.generated?.size, captured: diffData.captured?.size } } : null,
}
