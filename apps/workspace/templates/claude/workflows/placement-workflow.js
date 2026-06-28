// placement-workflow.js
// Place a component into a story at a specific location.
// 5-stage pipeline: Resolve → Generate → Inject → Verify → Report
//
// Usage: workflow('placement-workflow', { name, selector, tag, placementMode, selectedComponent, instruction })
export const meta = {
  name: 'placement-workflow',
  description: 'Place a component into a story at a target location. Resolve → generate if needed → inject into CSF → verify → report.',
  phases: [
    { title: 'Resolve' },
    { title: 'Generate' },
    { title: 'Inject' },
    { title: 'Verify' },
    { title: 'Report' },
  ],
}

const { name, selector, tag, placementMode = 'after', selectedComponent, instruction = '' } = args

phase('Resolve')
log(`[placement] Resolving: place ${selectedComponent} ${placementMode} ${selector} in ${name}`)

// Check if the selected component already exists in the workspace
let componentExists = false
let componentSource = null
try {
  const result = await $`emdesign explore components --json 2>/dev/null || echo '{"ok":false}'`
  const parsed = JSON.parse(result)
  if (parsed.ok && Array.isArray(parsed.data)) {
    componentExists = parsed.data.some(c => c.toLowerCase() === selectedComponent.toLowerCase())
    log(`[placement] Component "${selectedComponent}" ${componentExists ? 'exists' : 'not found — will generate'}`)
  }
} catch {
  log(`[placement] Component discovery unavailable — assuming needs generation`)
}

// Read the target story file to understand the context
let storyFile = null
try {
  const result = await $`emdesign doc ${name} --json 2>/dev/null || echo '{"ok":false}'`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    storyFile = parsed.data?.storyFile ?? null
    log(`[placement] Story file: ${storyFile || 'unknown'}`)
  }
} catch { /* no doc command */ }

phase('Generate')
log(`[placement] Ensuring component exists: ${selectedComponent}`)

let generated = false
if (!componentExists) {
  log(`[placement] Generating missing component: ${selectedComponent}`)
  try {
    const result = await workflow('component-workflow', {
      name: selectedComponent,
      mode: 'new',
      instruction: instruction || selectedComponent,
    })
    generated = result.decision === 'ship'
    log(`[placement] Generate: ${generated ? '✅' : '❌'} (${result.composite})`)
  } catch (e) {
    log(`[placement] Generate failed: ${e.message}`)
  }
}

phase('Inject')
log(`[placement] Injecting ${selectedComponent} into story`)

// The actual injection happens at the backend level (story source injector)
// Here we log what needs to happen and return the injection plan
const injection = {
  targetFile: storyFile,
  targetSelector: selector,
  placementMode,
  component: selectedComponent,
  description: `Insert <${selectedComponent}> ${placementMode} the element matching "${selector}"`,
}

log(`[placement] Injection plan: ${injection.description}`)

phase('Verify')
log(`[placement] Verifying story still renders`)

let lintPassed = false
let visualPassed = false

try {
  const lintResult = await $`emdesign doctor lint ${name} --gate --json 2>/dev/null || echo '{"ok":false}'`
  const parsed = JSON.parse(lintResult)
  lintPassed = parsed.ok && parsed.data?.decision === 'ship'
  log(`[placement] Lint: ${lintPassed ? '✅' : '❌'}`)
} catch (e) {
  log(`[placement] Lint check unavailable: ${e.message}`)
}

try {
  const health = await $`emdesign storybook health --json 2>/dev/null || echo '{"data":{"status":"unknown"}}'`
  const h = JSON.parse(health)
  if (h.data?.status !== 'down') {
    const visualResult = await $`emdesign doctor visual ${name} --json 2>/dev/null || echo '{"ok":false}'`
    const parsed = JSON.parse(visualResult)
    visualPassed = parsed.ok && (parsed.data?.scores?.visual ?? 0) >= 0.5
    log(`[placement] Visual: ${visualPassed ? '✅' : '❌'}`)
  }
} catch { /* no visual */ }

// Full gate
let decision = 'revise'
let composite = 0
try {
  const gateResult = await $`emdesign doctor all ${name} --gate --json 2>/dev/null || echo '{"ok":false}'`
  const parsed = JSON.parse(gateResult)
  if (parsed.ok) {
    decision = parsed.data?.decision ?? 'revise'
    composite = parsed.data?.composite ?? 0
    log(`[placement] Gate: ${decision === 'ship' ? '✅' : '❌'} (composite: ${(composite * 100).toFixed(0)}%)`)
  }
} catch { /* no gate */ }

phase('Report')

const result = {
  name,
  selectedComponent,
  placementMode,
  targetSelector: selector,
  targetTag: tag,
  generated,
  injection,
  gate: lintPassed || decision === 'ship' ? 'pass' : 'fail',
  lintPassed,
  visualPassed,
  composite,
  decision,
}

log(`[placement] === ${name}: ${selectedComponent} placed ${placementMode} ${selector} ===`)
log(`[placement]   Generated: ${generated}`)
log(`[placement]   Gate:      ${result.gate}`)

return result
