// story-fix.js
// Update or auto-generate stories for a component.
// Uses story auto for generation, doctor charters + visual for verification.
//
// Usage: workflow('story-fix', { name })
export const meta = {
  name: 'story-fix',
  description: 'Update/generate CSF stories. story auto → doctor charters + doctor visual.',
  phases: [{ title: 'Assess' }, { title: 'Generate Stories' }, { title: 'Verify' }],
}

const { name } = args

phase('Assess')
log(`[story-fix] Checking stories for ${name}`)

// Check current story state
try {
  const result = await $`emdesign doctor charters ${name} --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    const charterScore = parsed.data?.scores?.charters ?? 0
    log(`[story-fix] Current charter score: ${charterScore}`)
  }
} catch { /* no existing charters */ }

phase('Generate Stories')
log(`[story-fix] Auto-generating stories`)

try {
  const result = await $`emdesign story auto ${name} --json 2>/dev/null`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    log(`[story-fix] Generated: ${parsed.data?.storyFile} (${parsed.data?.props ?? 0} props, ${parsed.data?.variants ?? 0} variants)`)
  } else {
    log(`[story-fix] Story generation had issues`)
  }
} catch (e) {
  log(`[story-fix] Story auto failed: ${e.message}`)
}

phase('Verify')
log(`[story-fix] Verifying stories`)

let chartersPassed = false
let visualPassed = false

try {
  const result = await $`emdesign doctor charters ${name} --json`
  const parsed = JSON.parse(result)
  chartersPassed = parsed.ok && (parsed.data?.scores?.charters ?? 0) >= 0.5
  log(`[story-fix] Charters: ${chartersPassed ? '✅' : '❌'}`)
} catch (e) {
  log(`[story-fix] Charters check failed: ${e.message}`)
}

// Visual check if Storybook is available
try {
  const health = await $`emdesign storybook health --json 2>/dev/null`
  const h = JSON.parse(health)
  if (h.data?.status !== 'down') {
    const result = await $`emdesign doctor visual ${name} --json`
    const parsed = JSON.parse(result)
    visualPassed = parsed.ok
    log(`[story-fix] Visual: ${visualPassed ? '✅' : '❌'}`)
  }
} catch { /* no visual */ }

return {
  name,
  storiesGenerated: true,
  chartersPassed,
  visualPassed,
  gate: chartersPassed ? 'pass' : 'fail',
}
