// ds-import.js
// Import a DESIGN.md from awesome-design-md, scaffold primitives, and delegate
// overview composition to ds-compose-overview (Red-Green: tests first, then overview).
//
// Uses agent() calls so it works in the Workflow runtime (no $ shell commands).
//
// Usage: workflow('ds-import', { source, id?, name? })
//   source: "awesome/<brand>" | "git/<url>" | "project/<path>"

export const meta = {
  name: 'ds-import',
  description: 'Import DS from awesome-design-md: fetch → tokens → preview → analyze → build primitives RED/GREEN per manifest → compose overview.',
  phases: [
    { title: 'Fetch & tokens', detail: 'Fetch DESIGN.md, LLM extracts tokens.css + manifest' },
    { title: 'Fetch preview', detail: 'Fetch reference preview HTML (visual reality)' },
    { title: 'Analyze preview', detail: 'Extract branding, design language, sections, primitives → manifest' },
    { title: 'Generate skills', detail: 'Build + taste skills from DESIGN.md + tokens + preview + manifest' },
    { title: 'Validate', detail: 'Validate DESIGN.md 9 sections + tokens.css 11 roles + manifest' },
    { title: 'Build primitives', detail: 'RED/GREEN each manifest primitive with preview HTML as ground truth' },
    { title: 'Compose overview', detail: 'Build React overview page matching preview via ds-compose-overview' },
  ],
}

const parsedArgs = typeof args === 'string' ? JSON.parse(args) : (args || {})
const { source, id: explicitId, name, cwd } = parsedArgs
if (!source) throw new Error('ds-import: source is required')

// Change to target directory if provided
const BASE = cwd || process.cwd()

const AWESOME_MD = 'https://raw.githubusercontent.com/voltagent/awesome-design-md/main'
const brand = source.replace('awesome/', '')
const dsId = explicitId || brand.toLowerCase().replace(/[^a-z0-9-]/g, '-')
const dsName = name || dsId
const dsDir = `${BASE}/design-systems/${dsId}`
const codeDir = `${dsDir}/code`

log(`[ds-import] Importing "${dsName}" (${dsId}) from ${source}`)

// ═══════════════════════════════════════════════════════════════════════
// Phase 1: Fetch DESIGN.md + extract tokens + manifest
// ═══════════════════════════════════════════════════════════════════════
phase('Fetch & tokens')

const designMdUrl = `${AWESOME_MD}/design-md/${brand}/DESIGN.md`
log(`[ds-import] Fetching DESIGN.md from ${designMdUrl}`)

const fetchResult = await agent(
  `Fetch a DESIGN.md and generate a design system from it.

Source URL: ${designMdUrl}
DS id: ${dsId}
DS name: ${dsName}
Output dir: ${dsDir}

Steps:
1. Run: mkdir -p ${dsDir} ${codeDir}
2. Fetch the DESIGN.md from the URL using curl, save to ${dsDir}/DESIGN.md
3. Read the DESIGN.md and analyze its YAML frontmatter (colors, typography, spacing, rounded sections)
4. Generate a complete tokens.css at ${dsDir}/tokens.css with ALL values from the frontmatter. Include semantic aliases (--color-text, --color-surface, --color-accent, etc.)
5. Generate manifest.json at ${dsDir}/manifest.json with schemaVersion, id, name, source attribution, file listing
6. Do NOT generate components yet (that's the next phase)

Return a JSON summary of what was created: { tokens: number, colors: number, fonts: string[], spacing: string[] }`,
  { label: `fetch:${dsId}`, phase: 'Fetch & tokens', schema: {
    type: 'object',
    properties: {
      tokens: { type: 'number' },
      colors: { type: 'number' },
      fonts: { type: 'array', items: { type: 'string' } },
      spacing: { type: 'array', items: { type: 'string' } },
    },
    required: ['tokens'],
  }}
)

log(`[ds-import] Token count: ${fetchResult?.tokens ?? '?'}`)

// ═══════════════════════════════════════════════════════════════════════
// Phase 2: Fetch reference preview — needed by skills AND compose
// ═══════════════════════════════════════════════════════════════════════
phase('Fetch preview')
log('[ds-import] Fetching reference preview HTML for dynamic extraction')

const previewUrl = `https://getdesign.md/design-md/${brand}/preview.html`
const previewPath = `${dsDir}/reference-example.html`

const previewFetch = await agent(
  `Fetch the reference preview HTML for the "${dsName}" design system.

Steps:
1. Run: curl -sL "${previewUrl}" -o "${previewPath}"
2. Verify: wc -c < "${previewPath}"
3. Confirm the file is at least 1000 bytes (valid preview)

Return the file size in bytes.`,
  { label: `preview:${dsId}`, phase: 'Fetch preview', schema: {
    type: 'object', properties: { bytes: { type: 'number' } }, required: ['bytes'],
  }}
)
const previewBytes = previewFetch?.bytes ?? 0
log(`[ds-import] Preview HTML: ${previewBytes} bytes at ${previewPath}`)

// ═══════════════════════════════════════════════════════════════════════
// Phase 3: Analyze DESIGN.md + preview HTML → preview-manifest.json
// Structured manifest: branding, design language, sections, primitives
// ═══════════════════════════════════════════════════════════════════════
phase('Analyze preview')
log('[ds-import] Analyzing DESIGN.md + preview HTML → preview-manifest.json')

const manifestResult = await agent(
  `Analyze the design system at "${dsDir}" and produce a structured preview-manifest.json.

Read these THREE inputs for maximum context:
- cat "${dsDir}/DESIGN.md"              (text contract: principles, brand voice, design rationale)
- cat "${dsDir}/reference-example.html" (RENDERED preview: actual visual execution)
- cat "${dsDir}/tokens.css"             (exact token values)

Extract the design system's full character from BOTH the DESIGN.md (what it says) and the preview HTML (what it actually looks like). The preview shows real visual execution — color in context, spacing, typography hierarchy, layout patterns, component behavior.

Return a JSON object with these fields:

1. "branding": {
     "name": "string",
     "tagline": "string",
     "voice": "string — e.g. confident, playful, technical, editorial",
     "personality": "string — brand character description",
     "targetAudience": "string"
   }

2. "designLanguage": {
     "principles": ["list of design principles observed"],
     "visualConcepts": ["key visual concepts — e.g. monochrome canvas, pastel color blocks"],
     "layoutPhilosophy": "string — grid, asymmetry, whitespace approach",
     "spacingPhilosophy": "string — generous, compact, rhythmic",
     "typographyHierarchy": "string — how type sizes and weights create hierarchy"
   }

3. "sections": [
     {
       "id": "hero",
       "name": "Hero",
       "description": "string",
       "primitives": ["Button", "Heading", "Text"],
       "visualNotes": "what this section looks like in the preview",
       "order": 1
     }
   ]

4. "primitives": {
     "Button": { "variants": ["primary", "secondary"], "sizes": ["sm", "md", "lg"], "behavior": "hover/focus/disabled states" },
     "Heading": { "levels": [1, 2, 3, 4, 5, 6] }
   }

5. "visual": {
     "colorStory": "string — overall color narrative",
     "tokens": { "surface": "#fff", "text": "#000" },
     "typography": { "display": "font name", "body": "font name" },
     "spacing": { "unit": "8px", "character": "generous/compact" },
     "radius": { "default": "8px", "character": "sharp/rounded/pill" },
     "motion": { "character": "bouncy/static/purposeful" }
   }

Extract ALL sections visible in the preview HTML, in DOM order. For each section,
include visual notes about what it contains and how it looks. For each primitive,
note the exact variants observed in the preview.`,
  {
    label: `manifest:${dsId}`, phase: 'Analyze preview',
    schema: {
      type: 'object',
      properties: {
        branding: { type: 'object' },
        designLanguage: { type: 'object' },
        sections: { type: 'array', items: { type: 'object' } },
        primitives: { type: 'object' },
        visual: { type: 'object' },
      },
      required: ['sections', 'primitives'],
    },
  }
)

const sections = manifestResult?.sections ?? []
const primitives = manifestResult?.primitives ?? {}
const manifestPath = `${dsDir}/preview-manifest.json`
await agent(
  `Save the preview manifest to "${manifestPath}".\nRun: mkdir -p "${dsDir}"\nWrite the JSON to file.\nReturn "done".`,
  { label: `saveManifest:${dsId}`, phase: 'Analyze preview' }
)
log(`[ds-import] Preview manifest: ${sections.length} sections, ${Object.keys(primitives).length} primitives`)

// ═══════════════════════════════════════════════════════════════════════
// Phase 4: Generate per-DS skills (build skill + taste profile)
// Uses DESIGN.md + tokens.css + preview HTML + manifest for rich context
// ═══════════════════════════════════════════════════════════════════════
phase('Generate skills')
log('[ds-import] Generating skills/build/SKILL.md and skills/taste/SKILL.md')

await agent(
  `Generate the design-language build skill and taste profile for DS "${dsId}" at ${dsDir}.

Inputs — read ALL for maximum context:
- cat "${dsDir}/DESIGN.md"                          (text contract)
- cat "${dsDir}/tokens.css"                         (exact token values)
- cat "${dsDir}/reference-example.html"             (RENDERED preview: actual visual execution)
- cat "${dsDir}/preview-manifest.json"              (ANALYZED manifest: branding, design language, sections)

The preview-manifest.json already contains extracted branding, design language principles,
visual concepts, and section structure. Use it alongside the raw preview HTML to create
skills that accurately reflect the design system's real character.

Write to:
1. ${dsDir}/skills/build/SKILL.md — the build skill with these 8 sections:
   # <Name> Build Skill
   ## Token Roles — table each SEMANTIC_TOKEN_ROLE with Tailwind class + CSS var + usage
   ## Type Scale — display / h1 / h2 / h3 / body / caption
   ## Spacing Scale — base unit + each stop
   ## Radius & Depth — radius stops, shadow rules
   ## Motion — fast/base/ease tokens
   ## Component Patterns — 3-5 examples based on REAL usage from the preview HTML
   ## Anti-Patterns — explicit DO NOT list
   ## Reuse vs Author — "if @ds/<Name> exists, import, don't re-author"

2. ${dsDir}/skills/taste/SKILL.md — the taste profile with YAML frontmatter:
   ---
   name: ${dsId}-taste
   dials:
     DESIGN_VARIANCE: <1-10>    // from branding/manifest character
     MOTION_INTENSITY: <1-10>   // from visual patterns
     VISUAL_DENSITY: <1-10>     // from spacing/info density in preview
   ---
   # ${dsId} Taste Profile
   **Brand fingerprint:** <from manifest.branding>
   **Design language:** <from manifest.designLanguage.principles>
   **Visual characteristics:** <from manifest.visual concepts>
   **Anti-patterns:** <what to avoid>

Return "done".`,
  { label: `skills:${dsId}`, phase: 'Generate skills' }
)
log(`[ds-import] Skills generated for "${dsId}"`)

// ═══════════════════════════════════════════════════════════════════════
// Phase 5: Validate — check DESIGN.md sections + tokens.css roles + manifest
// ═══════════════════════════════════════════════════════════════════════
phase('Validate')
log('[ds-import] Validating design system contract')

await agent(
  `Validate that DS "${dsId}" at "${dsDir}" meets the contract.

Read:
- cat "${dsDir}/DESIGN.md"
- cat "${dsDir}/tokens.css"
- cat "${dsDir}/preview-manifest.json"

Check:
1. DESIGN.md has all 9 sections (Visual Theme, Color, Typography, Spacing, Layout, Components, Motion, Voice, Anti-patterns)
2. tokens.css declares all 11 SEMANTIC_TOKEN_ROLES (color-surface, color-surface-raised, color-text, color-text-muted, color-accent, color-accent-hover, color-border, radius, space-unit, font-sans, shadow-raised)
3. Any issues found

For any missing sections in DESIGN.md, generate a brief default section and append it.
For any missing token roles, add them with reasonable defaults from the DESIGN.md values.

Return JSON: { ok: boolean, missingSections: string[], missingRoles: string[], fixesApplied: string[] }`,
  { label: `validate:${dsId}`, phase: 'Validate', schema: {
    type: 'object', properties: {
      ok: { type: 'boolean' },
      missingSections: { type: 'array', items: { type: 'string' } },
      missingRoles: { type: 'array', items: { type: 'string' } },
      fixesApplied: { type: 'array', items: { type: 'string' } },
    }, required: ['ok'],
  }}
)
log(`[ds-import] ✅ Design system validated`)

// ═══════════════════════════════════════════════════════════════════════
// Phase 6: Build primitives — RED/GREEN each primitive from manifest
// Ground truth: preview HTML + DESIGN.md + tokens.css + build skill
// ═══════════════════════════════════════════════════════════════════════
phase('Build primitives')
log('[ds-import] Building primitives from manifest — RED/GREEN each with preview as ground truth')

// Collect all unique primitives from manifest sections
const primitivesNeeded = [...new Set((sections || []).flatMap(s => s.primitives || []))].filter(Boolean)
log(`[ds-import] Manifest requires ${primitivesNeeded.length} primitives: ${primitivesNeeded.join(', ')}`)

// Build each primitive via RED/GREEN in parallel
const primitiveResults = await parallel(primitivesNeeded.map((primName) => async () => {
  const primPath = `${codeDir}/${primName}.tsx`
  const testPath = `${dsDir}/__tests__/${primName}.test.ts`

  // Check if already built
  const checkResult = await agent(
    `Check if "${primName}" already exists for DS "${dsId}" at "${primPath}".
Run: test -f "${primPath}" && echo "EXISTS" || echo "MISSING"
Return JSON: { "exists": true/false }`,
    {
      label: `check:${dsId}/${primName}`, phase: 'Build primitives',
      schema: { type: 'object', properties: { exists: { type: 'boolean' } }, required: ['exists'] },
    }
  )
  if (checkResult?.exists) {
    log(`  ✅ ${primName} already exists — skipping`)
    return { name: primName, status: 'skipped' }
  }

  // RED: write failing test
  log(`  🔴 RED: ${primName}`)
  await agent(
    `Write a vitest test for primitive "${primName}" of DS "${dsId}" at "${testPath}".

GROUND TRUTH (read these first):
- cat "${dsDir}/reference-example.html"   (preview HTML — shows exactly how this component looks)
- cat "${dsDir}/DESIGN.md"                (design contract)
- cat "${dsDir}/tokens.css"               (token values)
- cat "${dsDir}/skills/build/SKILL.md"    (build rules + anti-patterns)

The component does NOT exist yet at "${primPath}" — the import will fail (RED confirmed).
The test must check:
1. Component renders (render from @testing-library/react)
2. Uses CSS variables (no raw hex values)
3. Accepts basic props matching the design language

Write the test to "${testPath}".
Run: npx vitest run "${testPath}" 2>&1 — confirm it FAILS.
Return "RED confirmed".`,
    { label: `red:${dsId}/${primName}`, phase: 'Build primitives' }
  )

  // GREEN: implement
  log(`  🟩 GREEN: ${primName}`)
  await agent(
    `Implement primitive "${primName}" for DS "${dsId}" at "${primPath}".

GROUND TRUTH (read these ALL before implementing):
- cat "${dsDir}/reference-example.html"   (PREVIEW HTML — shows exactly how this component looks/behaves)
- cat "${dsDir}/DESIGN.md"                (design contract)
- cat "${dsDir}/tokens.css"               (exact token values)
- cat "${dsDir}/skills/build/SKILL.md"    (build rules, anti-patterns, reuse rules)

The preview HTML is the PRIMARY source of truth — match the visual appearance exactly.
Cross-validate against DESIGN.md + tokens.css + build skill for correctness.

Requirements:
- CSS variables (var(--token-*)) for ALL colors, spacing, typography — NO hardcoded values
- React.forwardRef
- TypeScript prop interface with JSDoc
- displayName
- Interactive states (hover, focus, active, disabled) matching preview behavior
- Default type="button" for Button components

Write to "${primPath}".
Run: npx vitest run "${testPath}" 2>&1 — must PASS (GREEN).
If fails, fix and re-run until GREEN.
Return JSON: { "file": "${primName}.tsx", "green": true }`,
    {
      label: `green:${dsId}/${primName}`, phase: 'Build primitives',
      schema: { type: 'object', properties: { file: { type: 'string' }, green: { type: 'boolean' } }, required: ['file'] },
    }
  )

  log(`  ✅ ${primName} built via RED/GREEN`)
  return { name: primName, status: 'built' }
}))

const built = primitiveResults.filter(r => r?.status === 'built').length
const skipped = primitiveResults.filter(r => r?.status === 'skipped').length
log(`[ds-import] Primitives: ${built} built, ${skipped} skipped of ${primitivesNeeded.length}`)

// Generate barrel export from code/ directory
const tsxResult = await agent(
  `List the component files in "${codeDir}/" that are NOT story files.
Run: ls "${codeDir}"/*.tsx 2>/dev/null
Return a JSON array of filenames (just the .tsx files that aren't .stories.tsx).`,
  { label: `scanCode:${dsId}`, phase: 'Validate', schema: {
    type: 'object', properties: { files: { type: 'array', items: { type: 'string' } } }, required: ['files'],
  }}
)
const components = (tsxResult?.files || []).filter(f => !f.endsWith('.stories.tsx')).map(f => f.replace(/\.tsx$/, ''))

if (components.length > 0) {
  const indexLines = components.flatMap(c => [
    `export { ${c} } from './${c}';`,
    `export type { ${c}Props } from './${c}';`,
  ])
  await agent(
    `Generate the barrel export for "${dsDir}/code/index.ts".
Write the following content to "${codeDir}/index.ts":
${indexLines.join('\n')}
Run: mkdir -p "${codeDir}"
Then write the file.
Return "done".`,
    { label: `index:${dsId}`, phase: 'Validate' }
  )
  log(`[ds-import] Barrel export: ${components.length} components in index.ts`)
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 7: Compose overview — build React page matching preview HTML
// ═══════════════════════════════════════════════════════════════════════
phase('Compose overview')
log('[ds-import] Building React overview page matching preview — ds-compose-overview')

const overviewResult = await workflow({
  scriptPath: 'apps/workspace/templates/claude/workflows/ds-compose-overview.js'
}, {
  dsId,
  dsPath: dsDir,
  maxAttempts: 3,
})

log(`[ds-import] Overview: ${overviewResult?.overviewFile ?? 'N/A'}`)
log(`[ds-import]   Tests: ${overviewResult?.testFile ?? 'N/A'} (${overviewResult?.testsPassed ? 'pass' : 'fail'})`)

// Summary
log(`[ds-import]   Tokens: ${dsDir}/tokens.css (${fetchResult?.tokens ?? '?'} tokens)`)
log(`[ds-import]   Primitives: ${components.length} in ${codeDir}/`)
log(`[ds-import]   Preview manifest: ${dsDir}/preview-manifest.json`)
log(`[ds-import]   Skills: ${dsDir}/skills/build/SKILL.md, skills/taste/SKILL.md`)

return {
  id: dsId,
  name: dsName,
  path: dsDir,
  tokens: fetchResult?.tokens ?? 0,
  primitives: components.length,
  manifestPath: `${dsDir}/preview-manifest.json`,
  overviewFile: overviewResult?.overviewFile,
  testFile: overviewResult?.testFile,
  testsPassed: overviewResult?.testsPassed,
}
