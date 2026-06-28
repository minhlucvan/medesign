// component-new.js
// Build a new component from scratch with full design loop.
// Enriches intent via ds context + graph guidance, builds, verifies, captures.
//
// Usage: workflow('component-new', { name, instruction, threshold? })
export const meta = {
  name: 'component-new',
  description: 'Build a new component: design context → generate → story auto → doctor all --gate → capture.',
  phases: [{ title: 'Enrich' }, { title: 'Generate' }, { title: 'Verify' }, { title: 'Capture' }, { title: 'Reconcile' }],
}

const { name, instruction = '', threshold = 0.8 } = args

phase('Enrich')
log(`[component-new] Building: ${name}`)

// Get full design context
let contextPrompt = ''
try {
  const result = await $`emdesign ds context ${name} "${instruction}" --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) contextPrompt = parsed.data?.prompt ?? ''
  log(`[component-new] Design context: ${contextPrompt.length} chars`)
} catch { /* no context */ }

// Query graph for reuse opportunities
let reuseCandidates = []
try {
  const result = await $`emdesign explore components --json`
  const parsed = JSON.parse(result)
  if (parsed.ok && Array.isArray(parsed.data)) {
    reuseCandidates = parsed.data.filter(c => c !== name)
    log(`[component-new] ${reuseCandidates.length} existing component(s) available for reuse`)
  }
} catch { /* no components */ }

phase('Generate')
log(`[component-new] Generating component`)

// The caller/agent provides the source via args.source or generates it
// This workflow verifies and gates

// Auto-generate stories
try {
  const storyResult = await $`emdesign story auto ${name} 2>/dev/null`
  log(`[component-new] Stories auto-generated`)
} catch (e) {
  log(`[component-new] Story generation: ${e.message}`)
}

phase('Verify')
log(`[component-new] Running full gate`)

let decision = 'revise'
let composite = 0
let mustFix = 0

try {
  const result = await $`emdesign doctor all ${name} --gate --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    decision = parsed.data?.decision ?? 'revise'
    composite = parsed.data?.composite ?? 0
    mustFix = parsed.data?.mustFix ?? 0
    log(`[component-new] Gate: ${decision === 'ship' ? '✅' : '❌'} (composite: ${composite.toFixed(3)}, mustFix: ${mustFix})`)
  }
} catch (e) {
  log(`[component-new] Gate error: ${e.message}`)
}

phase('Capture')
let captured = false
if (decision === 'ship') {
  try {
    await $`emdesign capture ${name} --baseline 2>/dev/null`
    captured = true
    log(`[component-new] ✅ Captured ${name}`)
  } catch (e) {
    log(`[component-new] Capture failed: ${e.message}`)
  }
}

phase('Reconcile')
let dependents = []
try {
  const impact = await $`emdesign graph impact art/${name} --json`
  const parsed = JSON.parse(impact)
  if (parsed.ok && Array.isArray(parsed.data)) {
    dependents = parsed.data.map(d => d.id)
  }
} catch { /* no graph */ }

return {
  name,
  decision,
  composite,
  mustFix,
  captured,
  reuseCandidates: reuseCandidates.length,
  dependents,
}
