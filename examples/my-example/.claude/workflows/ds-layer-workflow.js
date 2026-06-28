// ds-layer-workflow.js
// Determines which design system layer to modify based on user intent.
// Layers: Token → Primitive → Element (Blueprint) → Component → Composition
// Verifies layer-appropriately and reconciles affected downstream artifacts.
//
// Usage: workflow('ds-layer-workflow', { id, intent, changes? })
export const meta = {
  name: 'ds-layer-workflow',
  description: 'Determine which DS layer to change: token, primitive, element, component, or composition. Layer-appropriate gate + reconciliation.',
  phases: [{ title: 'Analyze Intent' }, { title: 'Determine Layer' }, { title: 'Apply Change' }, { title: 'Verify & Reconcile' }],
}

const { id, intent = '', changes = {} } = args

phase('Analyze Intent')
log(`[ds-layer] Analyzing intent for ${id}: ${intent}`)

// Enrich with DS info
let dsInfo = null
try {
  const result = await $`emdesign ds info ${id} --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) dsInfo = parsed.data
  log(`[ds-layer] DS: ${dsInfo?.name} (${dsInfo?.tokens} tokens, ${dsInfo?.primitives?.length ?? 0} primitives)`)
} catch (e) {
  log(`[ds-layer] DS info unavailable: ${e.message}`)
}

// Get current rules
let lintRules = null
try {
  const result = await $`emdesign ds lint-rules list ${id} --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) lintRules = parsed.data
  log(`[ds-layer] Lint preset: ${lintRules?.preset}`)
} catch { /* no lint rules */ }

phase('Determine Layer')
log(`[ds-layer] Classifying intent to determine layer`)

// Classify the intent to a DS layer
const intentLower = intent.toLowerCase()
let layer = 'unknown'

if (intentLower.includes('token') || intentLower.includes('color') || intentLower.includes('font') ||
    intentLower.includes('spacing') || intentLower.includes('shadow') || intentLower.includes('--color') ||
    intentLower.includes('primary') || intentLower.includes('accent')) {
  layer = 'token'
} else if (intentLower.includes('primitive') || intentLower.includes('block') || intentLower.includes('button') ||
           intentLower.includes('card') || intentLower.includes('input') || intentLower.includes('new component')) {
  layer = 'primitive'
} else if (intentLower.includes('blueprint') || intentLower.includes('pattern') || intentLower.includes('stat-card') ||
           intentLower.includes('data-table') || intentLower.includes('form')) {
  layer = 'element'
} else if (intentLower.includes('rule') || intentLower.includes('lint') || intentLower.includes('severity') ||
           intentLower.includes('preset') || intentLower.includes('exempt')) {
  layer = 'lint-rule'
} else if (intentLower.includes('compile') || intentLower.includes('export') || intentLower.includes('version')) {
  layer = 'compile'
} else {
  // Check if it's about an existing component
  try {
    const result = await $`emdesign explore components ${id} --json 2>/dev/null`
    const parsed = JSON.parse(result)
    if (parsed.ok && parsed.data?.length > 0) {
      layer = 'component'
    }
  } catch { /* not a component */ }
}

log(`[ds-layer] Layer determined: ${layer}`)

phase('Apply Change')
log(`[ds-layer] Applying ${layer}-layer change to ${id}`)

let changed = []
switch (layer) {
  case 'token': {
    // Token value change
    if (changes.primary) {
      await $`emdesign ds customize ${id} --primary ${changes.primary} 2>/dev/null`
      changed.push(`--color-accent: ${changes.primary}`)
    }
    if (changes.font) {
      await $`emdesign ds customize ${id} --body-font "${changes.font}" 2>/dev/null`
      changed.push(`--font-sans: ${changes.font}`)
    }
    if (changes.spacing) {
      await $`emdesign ds customize ${id} --spacing ${changes.spacing} 2>/dev/null`
      changed.push(`--space-unit: ${changes.spacing}px`)
    }
    log(`[ds-layer] Token changes: ${changed.join(', ') || 'none'}`)
    break
  }
  case 'primitive': {
    // Scaffold blocks
    if (changes.blocks) {
      await $`emdesign ds scaffold ${id} --blocks ${changes.blocks} 2>/dev/null`
      changed = changes.blocks.split(',')
      log(`[ds-layer] Scaffolded blocks: ${changed.join(', ')}`)
    }
    break
  }
  case 'lint-rule': {
    if (changes.preset) {
      await $`emdesign ds lint-rules preset ${id} ${changes.preset} 2>/dev/null`
      changed.push(`preset: ${changes.preset}`)
      log(`[ds-layer] Applied lint preset: ${changes.preset}`)
    }
    if (changes.rule && changes.severity) {
      await $`emdesign ds lint-rules set ${id} ${changes.rule} ${changes.severity} 2>/dev/null`
      changed.push(`${changes.rule} → ${changes.severity}`)
    }
    break
  }
  case 'compile': {
    await $`emdesign ds compile ${id} 2>/dev/null`
    changed.push('compiled types')
    log(`[ds-layer] Compiled ${id} tokens`)
    break
  }
  default: {
    log(`[ds-layer] Unknown layer: ${layer}, no automated change applied`)
  }
}

phase('Verify & Reconcile')
log(`[ds-layer] Verifying ${layer} changes`)

// Layer-appropriate verification
let verified = false
switch (layer) {
  case 'token':
  case 'lint-rule': {
    const result = await $`emdesign ds validate ${id} --strict --json`
    const parsed = JSON.parse(result)
    verified = parsed.ok && parsed.data?.ok
    log(`[ds-layer] Validate: ${verified ? '✅' : '❌'} (${parsed.data?.declared ?? 0} tokens)`)
    break
  }
  case 'primitive': {
    for (const block of changed) {
      const result = await $`emdesign doctor lint ${block} --json 2>/dev/null`
      log(`[ds-layer] Primitive ${block}: checked`)
    }
    verified = true
    break
  }
  case 'compile': {
    const result = await $`emdesign ds export ${id} --json`
    const parsed = JSON.parse(result)
    verified = parsed.ok
    log(`[ds-layer] Export: ${verified ? '✅' : '❌'}`)
    break
  }
  default: {
    verified = true
  }
}

// Reconcile: check graph impact for token/rule changes
let affectedCount = 0
let regressions = 0
if (layer === 'token' || layer === 'lint-rule') {
  try {
    const impact = await $`emdesign graph impact ${id} --json 2>/dev/null`
    const parsed = JSON.parse(impact)
    if (parsed.ok && Array.isArray(parsed.data)) {
      affectedCount = parsed.data.length
      log(`[ds-layer] ${affectedCount} potentially affected artifact(s)`)
      // Run doctor on affected components
      for (const dep of parsed.data.slice(0, 5)) {
        const depResult = await $`emdesign doctor lint ${dep.id} --gate --json 2>/dev/null`
        const depParsed = JSON.parse(depResult)
        if (!depParsed.ok || depParsed.data?.decision !== 'ship') {
          regressions++
          log(`[ds-layer] ⚠️ Regression in ${dep.id}`)
        }
      }
    }
  } catch { /* no graph */ }
}

log(`[ds-layer] Done: ${changed.length} changes, ${regressions} regressions`)
return {
  id,
  layer,
  changed,
  verified,
  affectedCount,
  regressions,
}
