// screen-compose.js
// Compose a page/screen from existing components with reuse analysis.
// Checks existing components first, applies blueprints for patterns, delegates new components to component-workflow.
//
// Usage: workflow('screen-compose', { name, sections: [{id, type, component?}], layout? })
export const meta = {
  name: 'screen-compose',
  description: 'Compose a page from components. Reuse analysis → blueprint apply → component-workflow for missing → compose → verify layout.',
  phases: [{ title: 'Reuse Analysis' }, { title: 'Build Missing' }, { title: 'Compose' }, { title: 'Verify' }],
}

const { name, sections = [], layout = 'stack' } = args

phase('Reuse Analysis')
log(`[screen] Composing: ${name} (${sections.length} sections, layout: ${layout})`)

// Discover existing components and blueprints
let existingComponents = []
let availableBlueprints = []

try {
  const result = await $`emdesign explore components --json 2>/dev/null`
  const parsed = JSON.parse(result)
  if (parsed.ok && Array.isArray(parsed.data)) existingComponents = parsed.data
  log(`[screen] ${existingComponents.length} component(s) available`)
} catch { /* no discovery */ }

try {
  const result = await $`emdesign ds blueprint list --json 2>/dev/null`
  const parsed = JSON.parse(result)
  if (parsed.ok) availableBlueprints = parsed.data?.blueprints ?? parsed.data ?? []
  log(`[screen] ${availableBlueprints.length} blueprint(s) available`)
} catch { /* no blueprints */ }

// Reuse analysis: for each section, determine if we can reuse or need to build
const resolutions = []
for (const section of sections) {
  const existing = existingComponents.find(c => c.toLowerCase() === section.id.toLowerCase())
  const blueprint = availableBlueprints.find(b => b.id === section.id || b.id === section.type)

  if (existing) {
    resolutions.push({ ...section, action: 'reuse', component: existing })
    log(`[screen]   ${section.id}: reuse existing component`)
  } else if (blueprint) {
    resolutions.push({ ...section, action: 'blueprint', blueprint: blueprint.id })
    log(`[screen]   ${section.id}: apply blueprint '${blueprint.id}'`)
  } else {
    resolutions.push({ ...section, action: 'build', instruction: section.instruction ?? '' })
    log(`[screen]   ${section.id}: build new component`)
  }
}

const toBuild = resolutions.filter(r => r.action === 'build')
const toBlueprint = resolutions.filter(r => r.action === 'blueprint')

phase('Build Missing')

// Apply blueprints
const builtComponents = []
for (const item of toBlueprint) {
  try {
    const result = await $`emdesign ds blueprint apply ${item.blueprint} ${item.id} --json 2>/dev/null`
    const parsed = JSON.parse(result)
    if (parsed.ok) {
      builtComponents.push(item.id)
      log(`[screen] ✅ Blueprint applied: ${item.id}`)
    }
  } catch (e) {
    log(`[screen] ❌ Blueprint failed for ${item.id}: ${e.message}`)
  }
}

// Build new components (delegate to component-workflow)
for (const item of toBuild) {
  const result = await workflow('component-workflow', {
    name: item.id,
    mode: 'new',
    instruction: item.instruction,
  })
  if (result.decision === 'ship') {
    builtComponents.push(item.id)
    log(`[screen] ✅ Component built: ${item.id}`)
  } else {
    log(`[screen] ❌ Component ${item.id} failed gate: ${result.composite}`)
  }
}

// Collect all component names for the compose step
const allComponents = [
  ...resolutions.filter(r => r.action === 'reuse').map(r => r.component),
  ...builtComponents,
]

phase('Compose')
log(`[screen] Composing view with ${allComponents.length} component(s)`)

if (allComponents.length > 0) {
  try {
    const result = await $`emdesign compose ${name} --components "${allComponents.join(',')}" --layout ${layout} 2>/dev/null`
    log(`[screen] ✅ View composed: ${name}`)
  } catch (e) {
    log(`[screen] Compose failed: ${e.message}`)
  }
}

phase('Verify')
log(`[screen] Verifying composition`)

let layoutOk = false
try {
  const result = await $`emdesign render analyze ${name} --json 2>/dev/null`
  const parsed = JSON.parse(result)
  if (parsed.ok && parsed.data?.tree) {
    layoutOk = parsed.data.metrics?.nodeCount > 0
    log(`[screen] Layout: ${layoutOk ? '✅' : '❌'} (${parsed.data.metrics?.nodeCount ?? 0} nodes)`)
  }
} catch (e) {
  log(`[screen] Render check failed: ${e.message}`)
}

// Screen-level gate
let decision = 'revise'
try {
  const result = await $`emdesign doctor all ${name} --json 2>/dev/null`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    decision = parsed.data?.decision ?? 'revise'
    log(`[screen] Gate: ${decision}`)
  }
} catch { /* gate not available for screens */ }

return {
  name,
  layout,
  sections: resolutions,
  components: allComponents,
  built: builtComponents,
  decision,
  layoutOk,
}
