// app-workflow.js
// Full application build/update orchestrator.
// Top-level: DS setup → decompose into screens → build screens → verify → reconcile.
// Delegates to ds-layer-workflow, screen-workflow, reconcile-workflow.
//
// Usage: workflow('app-workflow', { name, ds?: {id, mode}, screens: [{name, route, sections}], instruction? })
export const meta = {
  name: 'app-workflow',
  description: 'Full app build/update. DS setup → screen decomposition → parallel screen builds → verification → reconciliation.',
  phases: [{ title: 'DS Setup' }, { title: 'Decompose' }, { title: 'Build Screens' }, { title: 'Verify' }, { title: 'Reconcile' }],
}

const { name, ds, screens = [] } = args

phase('DS Setup')
log(`[app] Setting up application: ${name}`)

// 1. Design system setup
let dsResult = null
if (ds) {
  if (ds.mode === 'import' || ds.mode === 'create') {
    dsResult = await workflow('ds-layer-workflow', { id: ds.id, intent: ds.mode === 'import' ? 'import design system' : 'create design system', changes: ds.changes ?? {} })
    log(`[app] DS setup: ${dsResult.layer} layer, ${dsResult.changed?.length ?? 0} changes`)
  }
}

// 2. Activate DS
if (ds?.id) {
  try {
    await $`emdesign use ${ds.id} 2>/dev/null`
    log(`[app] Active DS: ${ds.id}`)
  } catch (e) {
    log(`[app] DS activation failed: ${e.message}`)
  }
}

// 3. Validate and compile
try {
  await $`emdesign ds validate ${ds?.id ?? 'atelier'} --strict 2>/dev/null`
} catch { /* optional */ }

phase('Decompose')
log(`[app] Decomposing into ${screens.length} screen(s)`)

// Decompose screens — check for reuse opportunities across screens
const allComponents = new Set()
for (const screen of screens) {
  for (const section of screen.sections ?? []) {
    allComponents.add(section.id)
  }
}
log(`[app] ${allComponents.size} unique component(s) across all screens`)

phase('Build Screens')
log(`[app] Building screens`)

// Build screens in parallel (they're independent)
const screenResults = await parallel(screens.map(s => () =>
  workflow('screen-create', {
    name: s.name,
    route: s.route ?? `/${s.name.toLowerCase()}`,
    sections: s.sections ?? [],
    layout: s.layout ?? 'stack',
  })
))

const built = screenResults.filter(r => r?.decision === 'ship' || r?.renderOk)
const failed = screenResults.filter(r => r && r.decision !== 'ship' && !r.renderOk)
log(`[app] Screens: ${built.length} built, ${failed.length} failed`)

phase('Verify')
log(`[app] Running app-level verification`)

// Cross-screen consistency check
const sharedComponents = new Map()
for (const screen of screens) {
  for (const section of screen.sections ?? []) {
    const prev = sharedComponents.get(section.id) ?? []
    prev.push(screen.name)
    sharedComponents.set(section.id, prev)
  }
}
const reused = Array.from(sharedComponents.entries()).filter(([, screens]) => screens.length > 1)
if (reused.length > 0) {
  log(`[app] Shared components: ${reused.map(([c, s]) => `${c} (${s.join(', ')})`).join('; ')}`)
}

// Validate DS after all screens
let dsValid = false
try {
  const result = await $`emdesign ds validate ${ds?.id ?? 'atelier'} --strict --json 2>/dev/null`
  const parsed = JSON.parse(result)
  dsValid = parsed.ok && parsed.data?.ok
  log(`[app] DS validate: ${dsValid ? '✅' : '❌'}`)
} catch { /* optional */ }

phase('Reconcile')
// Run reconciliation on the full app
const reconcileResult = await workflow('reconcile-workflow', {
  nodes: screens.map(s => `screen:${s.name}`),
})

return {
  name,
  screens: screens.map(s => s.name),
  dsSetup: dsResult?.verified ?? true,
  screenResults: built.length,
  screenFailures: failed.length,
  sharedComponents: reused.map(([c]) => c),
  dsValid,
  reconcileResult,
}
