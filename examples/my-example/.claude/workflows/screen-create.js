// screen-create.js
// Create a full screen with routing, layout, and metadata.
// Builds on screen-compose by adding route registration and screen-level scaffolding.
//
// Usage: workflow('screen-create', { name, route, layout?, components?, sections? })
export const meta = {
  name: 'screen-create',
  description: 'Create a full screen: screen-compose → screen create (route) → verify.',
  phases: [{ title: 'Scaffold' }, { title: 'Compose' }, { title: 'Register Route' }, { title: 'Verify' }],
}

const { name, route = `/${name.toLowerCase()}`, layout = 'stack', components = [], sections = [] } = args

phase('Scaffold')
log(`[screen-create] Creating screen: ${name} → ${route}`)

// Create screen directory
try {
  const result = await $`emdesign screen create ${name} --route ${route} --json 2>/dev/null`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    log(`[screen-create] ✅ Screen directory created: ${parsed.data?.dir}`)
  }
} catch (e) {
  log(`[screen-create] Screen create failed: ${e.message}`)
}

phase('Compose')
// Build/compose the view inside the screen
if (sections.length > 0) {
  const composeResult = await workflow('screen-compose', { name, sections, layout })
  log(`[screen-create] Compose: ${composeResult.decision}, ${composeResult.components?.length ?? 0} components`)
} else if (components.length > 0) {
  try {
    const result = await $`emdesign compose ${name} --components "${components.join(',')}" --layout ${layout} 2>/dev/null`
    log(`[screen-create] ✅ View composed from ${components.length} components`)
  } catch (e) {
    log(`[screen-create] Compose failed: ${e.message}`)
  }
}

phase('Register Route')
// Verify route registration
try {
  const result = await $`emdesign screen list --json 2>/dev/null`
  const parsed = JSON.parse(result)
  const screens = parsed.ok ? parsed.data?.screens ?? [] : []
  const registered = screens.find(s => s.name === name || s.route === route)
  log(`[screen-create] Route: ${registered ? `✅ ${name} → ${route}` : '⚠️ Not found in screen list'}`)
} catch { /* no screen list */ }

phase('Verify')
log(`[screen-create] Verifying screen`)

let renderOk = false
try {
  const result = await $`emdesign render analyze ${name} --json 2>/dev/null`
  const parsed = JSON.parse(result)
  renderOk = parsed.ok && (parsed.data?.metrics?.nodeCount ?? 0) > 0
  log(`[screen-create] Render: ${renderOk ? '✅' : '❌'}`)
} catch (e) {
  log(`[screen-create] Render check: ${e.message}`)
}

let decision = 'revise'
try {
  const result = await $`emdesign doctor all ${name} --json 2>/dev/null`
  const parsed = JSON.parse(result)
  if (parsed.ok) decision = parsed.data?.decision ?? 'revise'
} catch { /* gate not available */ }

return {
  name,
  route,
  layout,
  components,
  renderOk,
  decision,
}
