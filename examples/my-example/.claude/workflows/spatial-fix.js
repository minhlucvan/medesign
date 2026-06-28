// spatial-fix.js
// Fix spatial/geometry issues — overlaps, alignment, grid violations.
// Uses render analyze + spatial audit for precise measurements.
//
// Usage: workflow('spatial-fix', { name })
export const meta = {
  name: 'spatial-fix',
  description: 'Fix spatial/geometry issues. render analyze → spatial audit → doctor visual → lint --gate.',
  phases: [{ title: 'Analyze' }, { title: 'Identify Issues' }, { title: 'Verify' }],
}

const { name } = args

phase('Analyze')
log(`[spatial-fix] Analyzing ${name}`)

// Check Storybook health first
try {
  const health = await $`emdesign storybook health --json`
  const h = JSON.parse(health)
  if (h.data?.status === 'down') {
    log(`[spatial-fix] ⚠️ Storybook not running — spatial analysis unavailable`)
    return { name, gate: 'skip', reason: 'Storybook not running' }
  }
  log(`[spatial-fix] Storybook: ${h.data?.status}`)
} catch { /* no health check */ }

// Run render analyze
let tree = null
try {
  const result = await $`emdesign render analyze ${name} --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    tree = parsed.data
    log(`[spatial-fix] DOM tree: ${tree.metrics?.nodeCount ?? 0} nodes, depth ${tree.metrics?.depth ?? 0}`)
  }
} catch (e) {
  log(`[spatial-fix] Render analyze failed: ${e.message}`)
}

// Run spatial audit
let audit = null
try {
  const result = await $`emdesign spatial audit ${name} --grid --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    audit = parsed.data
    log(`[spatial-fix] Audit: ${audit.overlaps?.length ?? 0} overlaps, ${audit.nodeCount ?? 0} nodes`)
  }
} catch (e) {
  log(`[spatial-fix] Spatial audit failed: ${e.message}`)
}

phase('Identify Issues')
log(`[spatial-fix] Compiling findings`)

const issues = []
if (audit?.overlaps?.length > 0) {
  for (const o of audit.overlaps.slice(0, 5)) {
    issues.push({ type: 'overlap', detail: `${o.a} overlaps ${o.b} by ${o.overlapPx}px` })
  }
}
if (audit?.grid?.violations > 0) {
  issues.push({ type: 'grid-violation', detail: `${audit.grid.violations} elements not on ${audit.grid.gridSize}px grid` })
}

if (issues.length === 0) {
  log(`[spatial-fix] ✅ No spatial issues found`)
}

phase('Verify')
// After fix is applied, re-check
try {
  const lintResult = await $`emdesign doctor lint ${name} --gate --json`
  const visualResult = await $`emdesign doctor visual ${name} --json`
  const lintPassed = JSON.parse(lintResult).ok
  const visualScore = JSON.parse(visualResult).data?.scores?.visual ?? 0

  log(`[spatial-fix] Lint: ${lintPassed ? '✅' : '❌'}, Visual: ${visualScore.toFixed(2)}`)

  return {
    name,
    issues,
    treeMetrics: tree?.metrics,
    auditSummary: { overlaps: audit?.overlaps?.length ?? 0, nodes: audit?.nodeCount ?? 0 },
    gate: lintPassed && visualScore >= 0.5 ? 'pass' : 'fail',
  }
} catch (e) {
  return { name, issues, gate: 'fail', error: e.message }
}
