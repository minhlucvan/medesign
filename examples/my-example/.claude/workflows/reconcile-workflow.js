// reconcile-workflow.js
// Post-change impact verification. Queries graph impact for all affected nodes,
// runs doctor all --gate on each, reports regressions.
//
// Usage: workflow('reconcile-workflow', { nodes: ['art/Component1', 'token/--color-x'] })
export const meta = {
  name: 'reconcile-workflow',
  description: 'Post-change reconciliation. graph impact → doctor all --gate per dependent → regression report.',
  phases: [{ title: 'Discover Impact' }, { title: 'Verify Dependents' }, { title: 'Report' }],
}

const { nodes = [] } = args

phase('Discover Impact')
log(`[reconcile] Discovering impact for ${nodes.length} node(s)`)

// Find all affected nodes via graph impact
const allAffected = new Map() // name -> { depth, path }
for (const node of nodes) {
  try {
    const result = await $`emdesign graph impact ${node} --json 2>/dev/null`
    const parsed = JSON.parse(result)
    if (parsed.ok && Array.isArray(parsed.data)) {
      for (const dep of parsed.data) {
        const key = dep.id ?? dep
        if (!allAffected.has(key)) {
          allAffected.set(key, { depth: dep.depth ?? 0, source: node })
        }
      }
    }
  } catch { /* single node impact failed */ }
}

log(`[reconcile] Found ${allAffected.size} affected artifact(s)`)
const affectedList = Array.from(allAffected.entries())

phase('Verify Dependents')
log(`[reconcile] Verifying dependents`)

const results = []
for (const [name, info] of affectedList) {
  // Extract the component name from the artifact ID
  const compName = name.replace('art/', '').replace('screen:', '')

  try {
    const result = await $`emdesign doctor all ${compName} --gate --json 2>/dev/null`
    const parsed = JSON.parse(result)
    const passed = parsed.ok && parsed.data?.decision === 'ship'

    results.push({
      name: compName,
      artifactId: name,
      passed,
      composite: parsed.data?.composite ?? 0,
      mustFix: parsed.data?.mustFix ?? 0,
      depth: info.depth,
      triggeredBy: info.source,
    })

    if (passed) {
      log(`[reconcile]   ✅ ${compName}: passed`)
    } else {
      log(`[reconcile]   ⚠️ ${compName}: composite ${parsed.data?.composite?.toFixed(3) ?? 0}, ${parsed.data?.mustFix ?? 0} P0`)
    }
  } catch (e) {
    results.push({ name: compName, artifactId: name, passed: false, error: e.message })
    log(`[reconcile]   ❌ ${compName}: ${e.message}`)
  }
}

phase('Report')
const passed = results.filter(r => r.passed)
const failed = results.filter(r => !r.passed)
const summary = {
  total: results.length,
  passed: passed.length,
  failed: failed.length,
  regressions: failed.map(r => ({
    component: r.name,
    composite: r.composite,
    mustFix: r.mustFix,
    triggeredBy: r.triggeredBy,
    error: r.error,
  })),
}

log(`[reconcile] === Reconciliation Report ===`)
log(`[reconcile] Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}`)
if (summary.failed > 0) {
  log(`[reconcile] Regressions:`)
  for (const r of summary.regressions) {
    log(`[reconcile]   ⚠️ ${r.component} (triggered by ${r.triggeredBy}): ${r.error ?? `composite ${r.composite?.toFixed(3) ?? 'N/A'}`}`)
  }
}

return summary
