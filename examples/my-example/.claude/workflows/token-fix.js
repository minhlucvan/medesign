// token-fix.js
// Fix a specific token lint violation. Fastest gate — lint only.
// Uses graph where-to-fix for exact file:line location.
//
// Usage: workflow('token-fix', { name, finding })
export const meta = {
  name: 'token-fix',
  description: 'Fix a specific token lint violation. Uses graph where-to-fix → doctor lint --gate.',
  phases: [{ title: 'Locate Violation' }, { title: 'Fix' }, { title: 'Verify' }],
}

const { name, finding } = args

phase('Locate Violation')
log(`[token-fix] Locating: ${finding} in ${name}`)

let fixInfo = null
try {
  const result = await $`emdesign graph where-to-fix ${name} ${finding} --json`
  const parsed = JSON.parse(result)
  if (parsed.ok && parsed.data) {
    fixInfo = parsed.data
    log(`[token-fix] Fix at ${fixInfo.file}:${fixInfo.line} → use "${fixInfo.token}"`)
  }
} catch (e) {
  log(`[token-fix] Graph unavailable: ${e.message}`)
}

phase('Fix')
log(`[token-fix] Applying fix`)

// Return the fix information — the caller/agent applies the actual edit
// This workflow verifies the fix was applied correctly

phase('Verify')
try {
  const result = await $`emdesign doctor lint ${name} --gate --json`
  const parsed = JSON.parse(result)
  const passed = parsed.ok && parsed.data?.decision === 'ship'
  log(`[token-fix] ${passed ? '✅ Fixed' : '❌ Still failing'}`)

  return {
    name,
    finding,
    fixed: passed,
    gate: passed ? 'pass' : 'fail',
    fixLocation: fixInfo ? `${fixInfo.file}:${fixInfo.line}` : 'unknown',
    composite: parsed.data?.composite ?? 0,
    mustFix: parsed.data?.mustFix ?? 0,
  }
} catch (e) {
  return { name, finding, fixed: false, gate: 'fail', error: e.message }
}
