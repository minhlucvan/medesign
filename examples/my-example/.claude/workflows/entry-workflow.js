// entry-workflow.js
// Single entry point for ALL intents. Routes to the appropriate layer workflow
// based on intent classification. Intent flow: Storybook Addon → Backend → Workspace Agent.
//
// Usage: workflow('entry-workflow', { type, target, instruction, payload? })
export const meta = {
  name: 'entry-workflow',
  description: 'Single entry point for all intents. Classifies → enriches → routes to layer-appropriate workflow. Handles errors, returns standardized results.',
  phases: [
    { title: 'Classify Intent' },
    { title: 'Enrich Context' },
    { title: 'Route & Execute' },
    { title: 'Collect Results' },
  ],
}

const { type = '', target = '', instruction = '', payload = {} } = args

phase('Classify Intent')
log(`[entry] Intent: type="${type}" target="${target}"`)

// ── Intent Classification ───────────────────────────────────────────────
// Maps intent types to layer + workflow. Returns { layer, workflow, args }

function classifyIntent(type, target, instruction, payload) {
  const t = (type || '').toLowerCase()
  const i = (instruction || '').toLowerCase()
  const combined = `${t} ${i}`

  // Element-level (fastest: lint-only or simple fix)
  if (t.includes('token') || t.includes('lint') || combined.includes('token violation') || combined.includes('lint error')) {
    return { layer: 'element', workflow: 'token-fix', args: { name: target, finding: payload.finding || t } }
  }
  if (t.includes('spatial') || t.includes('overlap') || t.includes('alignment') || combined.includes('geometry')) {
    return { layer: 'element', workflow: 'spatial-fix', args: { name: target } }
  }
  if (t.includes('story') || t.includes('stories') || combined.includes('missing story') || combined.includes('generate story')) {
    return { layer: 'element', workflow: 'story-fix', args: { name: target } }
  }

  // Component-level (medium: full build loop)
  if (t.includes('component-new') || t.includes('new-component') || t.includes('create-component') || combined.includes('new component') || combined.includes('create component')) {
    return { layer: 'component', workflow: 'component-new', args: { name: target || 'Component', instruction } }
  }
  if (t.includes('component-edit') || t.includes('edit-component') || t.includes('update-component') || t.includes('change-request') || combined.includes('edit component') || combined.includes('update component') || combined.includes('change request')) {
    return { layer: 'component', workflow: 'component-edit', args: { name: target, instruction } }
  }
  if (t.includes('audit') || t.includes('review') || t.includes('inspect') || combined.includes('full audit')) {
    return { layer: 'component', workflow: 'component-audit', args: { name: target } }
  }

  // DS-level (design system operations)
  if (t.includes('ds-create') || t.includes('import') || t.includes('ds-import') || combined.includes('create design system') || combined.includes('import design system')) {
    return { layer: 'ds', workflow: 'ds-layer-workflow', args: { id: target || payload.id, intent: instruction, changes: payload.changes || {} } }
  }
  if (t.includes('ds-update') || t.includes('customize') || t.includes('ds-customize') || combined.includes('update design system') || combined.includes('customize')) {
    return { layer: 'ds', workflow: 'ds-layer-workflow', args: { id: target || payload.id, intent: instruction, changes: payload.changes || {} } }
  }
  if (t.includes('compile') || t.includes('export') || t.includes('version')) {
    return { layer: 'ds', workflow: 'ds-layer-workflow', args: { id: target || payload.id, intent: 'compile', changes: {} } }
  }
  if (t.includes('rule') || t.includes('lint-rule') || t.includes('preset') || combined.includes('lint rule') || combined.includes('preset')) {
    return { layer: 'ds', workflow: 'ds-layer-workflow', args: { id: target || payload.id, intent: 'lint-rule', changes: { preset: payload.preset, rule: payload.rule, severity: payload.severity } } }
  }

  // Screen-level (complex: multi-component composition)
  if (t.includes('compose') || t.includes('view') || t.includes('page') || combined.includes('compose page') || combined.includes('build view') || combined.includes('create page')) {
    return { layer: 'screen', workflow: 'screen-compose', args: { name: target, sections: payload.sections || [], layout: payload.layout || 'stack' } }
  }
  if (t.includes('screen-create') || t.includes('new-screen') || t.includes('create-screen') || combined.includes('create screen') || combined.includes('new screen')) {
    return { layer: 'screen', workflow: 'screen-create', args: { name: target, route: payload.route || `/${target?.toLowerCase() || ''}`, layout: payload.layout || 'stack', sections: payload.sections || [] } }
  }

  // App-level (multi-screen orchestration)
  if (t.includes('app') || t.includes('full-app') || t.includes('project') || combined.includes('full application') || combined.includes('build app')) {
    return { layer: 'app', workflow: 'app-workflow', args: { name: target, ds: payload.ds, screens: payload.screens || [] } }
  }
  if (t.includes('reconcile') || t.includes('rollout') || combined.includes('post-change') || combined.includes('impact')) {
    return { layer: 'app', workflow: 'reconcile-workflow', args: { nodes: payload.nodes || [target].filter(Boolean) } }
  }

  // Fallback: try as component workflow
  return { layer: 'component', workflow: 'component-workflow', args: { name: target || 'Component', instruction } }
}

const classification = classifyIntent(type, target, instruction, payload)
log(`[entry] Classified as: ${classification.layer}/${classification.workflow}`)

phase('Enrich Context')
log(`[entry] Enriching context for ${classification.layer} layer`)

// Enrich with workspace overview
let workspaceOverview = null
try {
  const result = await $`emdesign explore overview --json 2>/dev/null || echo '{"ok":false}'`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    workspaceOverview = parsed.data
    log(`[entry] Workspace: ${parsed.data?.activeDesignSystem ?? 'unknown'}`)
  }
} catch { /* optional */ }

// Enrich with DS info
let dsInfo = null
try {
  const result = await $`emdesign ds info --json 2>/dev/null || echo '{"ok":false}'`
  const parsed = JSON.parse(result)
  if (parsed.ok) {
    dsInfo = parsed.data
    log(`[entry] DS: ${dsInfo?.name} (${dsInfo?.tokens} tokens)`)
  }
} catch { /* optional */ }

// Enrich with Storybook health
let storybookHealth = null
try {
  const result = await $`emdesign storybook health --json 2>/dev/null || echo '{"data":{"status":"unknown"}}'`
  storybookHealth = JSON.parse(result).data
  log(`[entry] Storybook: ${storybookHealth?.status ?? 'unknown'}`)
} catch { /* optional */ }

// Enrich with graph context for component-level work
let graphContext = null
if (classification.layer === 'component' || classification.layer === 'element') {
  try {
    const name = classification.args.name || target
    const result = await $`emdesign graph context art/${name} --json 2>/dev/null || echo '{"ok":false}'`
    const parsed = JSON.parse(result)
    if (parsed.ok) graphContext = parsed.data
  } catch { /* optional */ }
}

const enrichedArgs = {
  ...classification.args,
  _context: { workspaceOverview, dsInfo, storybookHealth, graphContext, originalIntent: { type, target, instruction, payload } },
}

phase('Route & Execute')
log(`[entry] Executing ${classification.workflow} at ${classification.layer} layer`)

let result = null
let error = null

try {
  result = await workflow(classification.workflow, enrichedArgs)
  log(`[entry] ${classification.workflow} completed`)
} catch (e) {
  error = { message: e.message, stack: e.stack }
  log(`[entry] ${classification.workflow} failed: ${e.message}`)

  // Fallback: if the specific workflow failed, try generic component-workflow
  if (classification.workflow !== 'component-workflow' && classification.layer !== 'ds') {
    log(`[entry] Falling back to component-workflow`)
    try {
      result = await workflow('component-workflow', { name: target || 'Component', instruction })
    } catch (e2) {
      error = { primary: error, fallback: e2.message }
    }
  }
}

phase('Collect Results')
log(`[entry] Returning results`)

return {
  entry: true,
  originalType: type,
  originalTarget: target,
  classification: { layer: classification.layer, workflow: classification.workflow },
  result,
  error,
  context: {
    dsName: dsInfo?.name,
    storybookStatus: storybookHealth?.status,
    graphAvailable: !!graphContext,
  },
}
