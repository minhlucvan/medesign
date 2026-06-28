// component-edit.js
// Modify an existing component with regression prevention.
// Checks current state, applies change, verifies scores don't regress, reconciles dependents.
//
// Usage: workflow('component-edit', { name, change, instruction? })
export const meta = {
  name: 'component-edit',
  description: 'Edit existing component. Check current scores → apply change → verify no regression → reconcile dependents.',
  phases: [{ title: 'Baseline' }, { title: 'Edit' }, { title: 'Verify' }, { title: 'Reconcile' }],
}

const { name, change = '', instruction = '' } = args

phase('Baseline')
log(`[component-edit] Establishing baseline for ${name}`)

// Get current scores
let baseline = null
try {
  const result = await $`emdesign doctor all ${name} --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    baseline = {
      composite: parsed.data?.composite ?? 0,
      mustFix: parsed.data?.mustFix ?? 0,
      decision: parsed.data?.decision ?? 'revise',
    }
    log(`[component-edit] Baseline: composite=${baseline.composite.toFixed(3)}, mustFix=${baseline.mustFix}`)
  }
} catch (e) {
  log(`[component-edit] Baseline unavailable: ${e.message}`)
}

// Check if component exists in generated or captured
try {
  const diff = await $`emdesign component diff ${name} --json`
  const parsed = JSON.parse(diff)
  if (parsed.ok) {
    log(`[component-edit] Generated: ${parsed.data?.generated?.exists}, Captured: ${parsed.data?.captured?.exists}`)
  }
} catch { /* check failed */ }

phase('Edit')
log(`[component-edit] Applying change`)

// The edit is applied by the caller/agent
// This workflow verifies the edit didn't break anything

phase('Verify')
log(`[component-edit] Verifying no regression`)

let decision = 'revise'
let composite = 0
let mustFix = 0
let regressed = false

try {
  const result = await $`emdesign doctor all ${name} --gate --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    decision = parsed.data?.decision ?? 'revise'
    composite = parsed.data?.composite ?? 0
    mustFix = parsed.data?.mustFix ?? 0

    // Check for regression against baseline
    if (baseline) {
      regressed = composite < baseline.composite - 0.05 || mustFix > baseline.mustFix
      if (regressed) {
        log(`[component-edit] ⚠️ Regression: composite ${composite.toFixed(3)} < ${baseline.composite.toFixed(3)}`)
      }
    }
    log(`[component-edit] Gate: ${decision === 'ship' ? '✅' : '❌'} (composite: ${composite.toFixed(3)}, regression: ${regressed})`)
  }
} catch (e) {
  log(`[component-edit] Gate error: ${e.message}`)
}

phase('Reconcile')
try {
  const impact = await $`emdesign graph impact art/${name} --json`
  const parsed = JSON.parse(impact)
  if (parsed.ok && Array.isArray(parsed.data) && parsed.data.length > 0) {
    log(`[component-edit] ${parsed.data.length} dependent(s) — checking via element-workflow`)
    for (const dep of parsed.data.slice(0, 3)) {
      await workflow('element-workflow', { name: dep.id, type: 'lint' })
    }
  }
} catch { /* no reconciliation */ }

return {
  name,
  decision,
  composite,
  mustFix,
  regressed,
  baseline,
}
