// element-workflow.js
// Smallest unit of work: fix a token violation, spatial issue, story gap, or lint finding.
// Optimized for speed — no full render, no vision, no LLM. Just deterministic lint.
//
// Usage: workflow('element-workflow', { name, type: 'token'|'spatial'|'story'|'lint', finding? })
export const meta = {
  name: 'element-workflow',
  description: 'Smallest unit: token fix, spatial fix, story update, or lint fix. Fast gate (~100ms).',
  phases: [{ title: 'Enrich Intent' }, { title: 'Fix Element' }, { title: 'Verify' }, { title: 'Reconcile' }],
}

const { name, type, finding } = args

phase('Enrich Intent')
log(`[element] Starting ${type} fix for ${name}`)

// For token/lint fixes, get exact fix location from graph
let fixLocation = null
if ((type === 'token' || type === 'lint') && finding) {
  try {
    const result = await $`emdesign graph where-to-fix ${name} ${finding} --json`
    const parsed = JSON.parse(result)
    if (parsed.ok && parsed.data) {
      fixLocation = parsed.data
      log(`[element] Fix location: ${fixLocation.file}:${fixLocation.line} → use ${fixLocation.token}`)
    }
  } catch (e) {
    log(`[element] Graph query failed: ${e.message}`)
  }
}

// Get current lint scores if available
let currentScores = null
try {
  const result = await $`emdesign doctor lint ${name} --json`
  const parsed = JSON.parse(result)
  if (parsed.ok) currentScores = parsed.data
} catch { /* component may not exist yet */ }

phase('Fix Element')
log(`[element] Applying fix: ${type}`)

// Apply the appropriate fix based on type
switch (type) {
  case 'token': {
    // Replace off-token value with correct semantic role
    if (fixLocation) {
      // The fix is handled by the calling context — return the info
      log(`[element] Token fix: replace at ${fixLocation.file}:${fixLocation.line}`)
    }
    break
  }
  case 'spatial': {
    log(`[element] Spatial fix needed for ${name}`)
    break
  }
  case 'story': {
    log(`[element] Story update for ${name}`)
    break
  }
  case 'lint': {
    log(`[element] Lint fix for ${name}`)
    break
  }
}

phase('Verify')
log(`[element] Running gate: doctor lint --gate`)

try {
  const result = await $`emdesign doctor lint ${name} --gate --json`
  const parsed = JSON.parse(result)
  const passed = parsed.ok && parsed.data?.decision === 'ship'

  if (passed) {
    log(`[element] ✅ Lint gate passed for ${name}`)
  } else {
    const mustFix = parsed.data?.mustFix ?? 0
    const findings = parsed.data?.findings?.slice(0, 3).map(f => f.message).join('; ') ?? ''
    log(`[element] ❌ Lint gate failed: ${mustFix} P0 issues — ${findings}`)
  }

  phase('Reconcile')
  let dependents = []
  try {
    const impact = await $`emdesign graph impact art/${name} --json`
    const parsedImpact = JSON.parse(impact)
    if (parsedImpact.ok && Array.isArray(parsedImpact.data)) {
      dependents = parsedImpact.data.filter(n => n.label === 'artifact')
      log(`[element] Found ${dependents.length} dependent(s)`)
    }
  } catch { /* no graph or no dependents */ }

  return {
    name,
    type,
    fixed: passed,
    gate: passed ? 'pass' : 'fail',
    findings: parsed.data?.findings ?? [],
    composite: parsed.data?.composite ?? 0,
    mustFix: parsed.data?.mustFix ?? 0,
    dependents: dependents.map(d => d.id),
    fixLocation,
  }
} catch (e) {
  log(`[element] Error: ${e.message}`)
  return { name, type, fixed: false, gate: 'fail', error: e.message }
}
