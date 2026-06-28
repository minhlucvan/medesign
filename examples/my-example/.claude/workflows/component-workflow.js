// component-workflow.js
// Full component build/modify with progressive cascade gate.
// Delegates element-level fixes to element-workflow.
//
// Usage: workflow('component-workflow', { name, mode: 'new'|'edit', instruction? })
export const meta = {
  name: 'component-workflow',
  description: 'Full component build/modify. Progressive cascade: lint → visual → spatial → a11y → all --gate.',
  phases: [{ title: 'Enrich Intent' }, { title: 'Build Component' }, { title: 'Verify' }, { title: 'Reconcile' }],
}

const { name, mode = 'new', instruction = '' } = args

phase('Enrich Intent')
log(`[component] ${mode === 'new' ? 'Building' : 'Editing'} component: ${name}`)

// 1. Get design context
let designContext = null
try {
  const result = await $`emdesign ds context ${name} "${instruction}" --json 2>/dev/null || emdesign design ${name} "${instruction}" --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) designContext = parsed.data
  log(`[component] Design context loaded`)
} catch (e) {
  log(`[component] Design context unavailable: ${e.message}`)
}

// 2. Check existing component if editing
let existingSource = null
if (mode === 'edit') {
  try {
    const result = await $`emdesign component diff ${name} --json`
    const parsed = JSON.parse(result)
    if (parsed.ok) existingSource = parsed.data
    log(`[component] Found existing version: generated=${existingSource?.generated?.exists}, captured=${existingSource?.captured?.exists}`)
  } catch { /* new component */ }
}

// 3. Query graph for guidance
let graphGuidance = null
try {
  const result = await $`emdesign graph guidance ${name} --intent "${instruction || 'build component'}" --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) graphGuidance = parsed.data
  log(`[component] Graph guidance loaded`)
} catch { /* graph optional */ }

phase('Build Component')
log(`[component] ${mode === 'new' ? 'Creating' : 'Updating'} component: ${name}`)

// For 'new' mode: the caller should have already generated the source.
// For 'edit' mode: the caller applies the change.
// This workflow verifies and gates — actual code generation happens via agent() or CLI.

// Auto-generate stories if component exists
if (mode === 'new') {
  try {
    const result = await $`emdesign story auto ${name} 2>/dev/null`
    log(`[component] Stories auto-generated`)
  } catch (e) {
    log(`[component] Story generation skipped: ${e.message}`)
  }
}

phase('Verify')
log(`[component] Progressive cascade gate for ${name}`)

// Stage 1: Lint (fastest)
let lintPassed = false
try {
  const result = await $`emdesign doctor lint ${name} --gate --json`
  const parsed = JSON.parse(result)
  lintPassed = parsed.ok && parsed.data?.decision === 'ship'
  log(`[component] Lint: ${lintPassed ? '✅' : '❌'} (composite: ${parsed.data?.composite ?? 0})`)
  if (!lintPassed) {
    // Try element-level fix for lint issues
    const elementResult = await workflow('element-workflow', { name, type: 'lint' })
    if (elementResult.fixed) {
      const retry = await $`emdesign doctor lint ${name} --gate --json`
      lintPassed = JSON.parse(retry).ok
    }
  }
} catch (e) {
  log(`[component] Lint skipped: ${e.message}`)
}

// Stage 2: Visual (needs Storybook)
let visualPassed = false
try {
  const health = await $`emdesign storybook health --json`
  const healthParsed = JSON.parse(health)
  if (healthParsed.data?.status === 'healthy' || healthParsed.data?.status === 'degraded') {
    const result = await $`emdesign doctor visual ${name} --json`
    const parsed = JSON.parse(result)
    visualPassed = parsed.ok && parsed.data?.scores?.visual >= 0.85
    log(`[component] Visual: ${visualPassed ? '✅' : '❌'} (score: ${parsed.data?.scores?.visual ?? 0})`)
  } else {
    log(`[component] Visual skipped (Storybook not healthy)`)
  }
} catch (e) {
  log(`[component] Visual skipped: ${e.message}`)
}

// Stage 3: Spatial
let spatialPassed = false
try {
  const result = await $`emdesign doctor spatial ${name} --json`
  const parsed = JSON.parse(result)
  spatialPassed = parsed.ok && parsed.data?.scores?.spatial >= 0.8
  log(`[component] Spatial: ${spatialPassed ? '✅' : '❌'} (score: ${parsed.data?.scores?.spatial ?? 0})`)
} catch (e) {
  log(`[component] Spatial skipped: ${e.message}`)
}

// Stage 4: Full composite gate
let decision = 'revise'
let composite = 0
let mustFix = 0
let findings = []

try {
  const result = await $`emdesign doctor all ${name} --gate --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    decision = parsed.data?.decision ?? 'revise'
    composite = parsed.data?.composite ?? 0
    mustFix = parsed.data?.mustFix ?? 0
    findings = parsed.data?.findings ?? []
    log(`[component] Gate: ${decision === 'ship' ? '✅ SHIP' : '❌ REVISE'} (composite: ${composite}, mustFix: ${mustFix})`)
  }
} catch (e) {
  log(`[component] Gate failed: ${e.message}`)
}

phase('Reconcile')
let dependents = []
try {
  const impact = await $`emdesign graph impact art/${name} --json`
  const parsed = JSON.parse(impact)
  if (parsed.ok && Array.isArray(parsed.data)) {
    dependents = parsed.data.filter(n => n.label === 'artifact' || n.label === 'story')
    if (dependents.length > 0) {
      log(`[component] Checking ${dependents.length} dependent(s) via element-workflow`)
      for (const dep of dependents.slice(0, 5)) {
        await workflow('element-workflow', { name: dep.id, type: 'lint' })
      }
    } else {
      log(`[component] No dependents to reconcile`)
    }
  }
} catch { /* no reconciliation */ }

return {
  name,
  mode,
  decision,
  composite,
  mustFix,
  findings: findings.slice(0, 10),
  stages: { lint: lintPassed, visual: visualPassed, spatial: spatialPassed },
  dependents: dependents.map(d => d.id),
}
