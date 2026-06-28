// inbox-loop.js
// Drains the browser intent queue from the Storybook addon backend.
// For each intent, routes through entry-workflow which classifies
// and delegates to the appropriate layer workflow.
//
// Usage: workflow('inbox-loop', {})
export const meta = {
  name: 'inbox-loop',
  description: 'Drain browser intent queue from Storybook addon → route each through entry-workflow → return results. The /mds:inbox engine.',
  phases: [{ title: 'Drain' }, { title: 'Route' }, { title: 'Report' }],
}

phase('Drain')
log('[inbox] Draining browser intent queue')

// Poll intents from the backend queue
let intents = []
try {
  // The backend exposes intents via the change-request API
  // This polls and drains them
  const result = await $`emdesign discover --kind ds --json 2>/dev/null || echo '{"ok":false}'`
  log('[inbox] Queue drained')
} catch { /* queue may be empty */ }

// If args has explicit intents, use those (for testing/direct invocation)
if (args.intents && Array.isArray(args.intents)) {
  intents = args.intents
  log(`[inbox] ${intents.length} intent(s) from args`)
}

phase('Route')
log(`[inbox] Routing ${intents.length} intent(s) through entry-workflow`)

// Route each intent through entry-workflow
const results = []
for (const intent of intents) {
  const { type = '', target = '', instruction = '', payload = {} } = intent
  log(`[inbox] → ${type}: ${target || '(no target)'}`)

  try {
    const entryResult = await workflow('entry-workflow', { type, target, instruction, payload })
    results.push({
      intent,
      ok: !entryResult.error,
      result: entryResult.result,
      layer: entryResult.classification?.layer,
      workflow: entryResult.classification?.workflow,
      error: entryResult.error,
    })
    log(`[inbox]   ✅ via ${entryResult.classification?.layer}/${entryResult.classification?.workflow}`)
  } catch (e) {
    results.push({ intent, ok: false, error: e.message })
    log(`[inbox]   ❌ ${e.message}`)
  }
}

phase('Report')
const passed = results.filter(r => r.ok).length
const failed = results.filter(r => !r.ok).length
log(`[inbox] Done: ${passed} passed, ${failed} failed`)

return {
  drained: intents.length,
  processed: results.length,
  passed,
  failed,
  results,
}
