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
  description: 'Import DESIGN.md from awesome-design-md, scaffold primitives, delegate overview to ds-compose-overview.',
  phases: [
    { title: 'Fetch & tokens', detail: 'Fetch DESIGN.md, LLM extracts tokens.css + manifest' },
    { title: 'Fetch preview', detail: 'Fetch reference preview HTML (visual reality)' },
    { title: 'Generate skills', detail: 'Skills/build + taste from DESIGN.md + tokens.css + preview' },
    { title: 'Analyze preview', detail: 'Extract branding, design language, sections, primitives → preview-manifest.json' },
    { title: 'Build sections', detail: 'Loop manifest sections: RED/GREEN each primitive, compose section story' },
  ],
}

const parsedArgs = typeof args === 'string' ? JSON.parse(args) : (args || {})
const { source, id: explicitId, name } = parsedArgs
if (!source) throw new Error('ds-import: source is required')

const AWESOME_MD = 'https://raw.githubusercontent.com/voltagent/awesome-design-md/main'
const brand = source.replace('awesome/', '')
const dsId = explicitId || brand.toLowerCase().replace(/[^a-z0-9-]/g, '-')
const dsName = name || dsId
const dsDir = `design-systems/${dsId}`
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
// Phase 3: Generate per-DS skills (build skill + taste profile)
// Uses DESIGN.md + tokens.css + preview HTML for richer context
// ═══════════════════════════════════════════════════════════════════════
phase('Generate skills')
log('[ds-import] Generating skills/build/SKILL.md and skills/taste/SKILL.md')

await agent(
  `Generate the design-language build skill and taste profile for DS "${dsId}" at ${dsDir}.

Inputs — read ALL three for maximum context:
- cat "${dsDir}/DESIGN.md"        (text contract: principles, colors, typography, spacing)
- cat "${dsDir}/tokens.css"       (token values: exact hex variables)
- cat "${dsDir}/reference-example.html"  (RENDERED preview: actual visual layout, component examples, color usage in context)

The preview HTML is especially important — it shows how the design actually looks on screen,
giving you concrete visual examples of spacing, color pairing, typography hierarchy,
component composition, and layout patterns. Use it to make the build skill's
Component Patterns section reflect REAL usage, not generic examples.

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
     DESIGN_VARIANCE: <1-10>    // derived from actual visual boldness in preview
     MOTION_INTENSITY: <1-10>   // derived from animation patterns
     VISUAL_DENSITY: <1-10>     // derived from spacing/info density
   ---
   # ${dsId} Taste Profile
   **Brand fingerprint:** <1-2 sentences describing the design language>
   **Visual characteristics:** <1-2 sentences from preview observation>
   **Anti-patterns:** <1-2 sentences of what to avoid>

Return "done".`,
  { label: `skills:${dsId}`, phase: 'Generate skills' }
)
log(`[ds-import] Skills generated for "${dsId}"`)

// ═══════════════════════════════════════════════════════════════════════
// Phase 4: Analyze DESIGN.md + preview HTML → preview-manifest.json
// Structured manifest: sections, primitives, visual patterns
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
await $`mkdir -p "${dsDir}" && echo '${JSON.stringify(manifestResult, null, 2)}' > "${manifestPath}"`
log(`[ds-import] Preview manifest: ${sections.length} sections, ${Object.keys(primitives).length} primitives`)

// ── Helper: build one section (RED/GREEN its primitives, compose section story) ──
async function buildSection(section, dsDir, dsId) {
  const sectionId = section.id || section.name.toLowerCase().replace(/\s+/g, '-')
  const sectionName = section.name
  const neededPrimitives = section.primitives || []
  let builtCount = 0

  for (const primName of neededPrimitives) {
    const primPath = `${dsDir}/code/${primName}.tsx`
    const exists = String(await $`test -f "${primPath}" && echo "yes" || echo "no"`).trim()
    if (exists === 'yes') { builtCount++; continue }

    // RED: write test
    log(`  🔴 ${sectionName}: ${primName} (RED — test that fails)`)
    await agent(
      `Write a vitest test for "${primName}" at "${dsDir}/__tests__/${primName}.test.ts".
Read "${dsDir}/DESIGN.md" and "${dsDir}/reference-example.html" first.
The component does NOT exist yet at "${primPath}".
Write the test file, then run "npx vitest run \"${dsDir}/__tests__/${primName}.test.ts\"" — it must fail.
Return "RED confirmed: test failed".`,
      { label: `red:${dsId}/${primName}`, phase: 'Build sections' }
    )

    // GREEN: implement
    log(`  🟩 ${sectionName}: ${primName} (GREEN — implement)`)
    await agent(
      `Implement "${primName}" component for design system at "${dsDir}".
Read "${dsDir}/DESIGN.md", "${dsDir}/tokens.css", "${dsDir}/skills/build/SKILL.md" first.
Also look at "${dsDir}/reference-example.html" to see how this component is used in context.

Write to "${primPath}".
Requirements: CSS variables for all values, forwardRef, TypeScript props, displayName, interactive states.
Then run "npx vitest run \"${dsDir}/__tests__/${primName}.test.ts\"" — must pass.
Return JSON: { "file": "${primName}.tsx", "green": true }`,
      { label: `green:${dsId}/${primName}`, phase: 'Build sections', schema: {
        type: 'object', properties: { file: { type: 'string' }, green: { type: 'boolean' } }, required: ['file'],
      }}
    )
    builtCount++
  }

  // Compose section story from primitives
  const storyPath = `${dsDir}/code/${sectionName}.stories.tsx`
  log(`  📝 ${sectionName}: composing section story`)
  await agent(
    `Compose a React Storybook story for the "${sectionName}" section of the "${dsId}" design system.
Read "${dsDir}/DESIGN.md", "${dsDir}/reference-example.html", and the existing primitives
at "${dsDir}/code/" to understand how this section looks and what components it uses.

Write a story file at "${storyPath}" that:
- Imports primitives from './index'
- Arranges them to match the reference preview HTML layout
- Uses CSS variables (var(--token-*)) for all styling
- Has proper Storybook meta with title "Design System/${dsId}/${sectionName}"

Write the file and run "npx vitest run \"${dsDir}/__tests__/${sectionName}.test.ts\"" if it exists — must pass.
Return "ok".`,
    { label: `story:${dsId}/${sectionName}`, phase: 'Build sections' }
  )

  log(`  ✅ ${sectionName} done — ${builtCount} primitive(s) built`)
  return { section: sectionName, primitivesBuilt: builtCount }
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 5: Per-section RED/GREEN primitives + compose section story
// Loop through manifest, spawn sub-workflow per section in parallel
// ═══════════════════════════════════════════════════════════════════════
phase('Build sections')
log('[ds-import] Building sections from preview-manifest — RED/GREEN per primitive')

const sectionResults = await parallel(sections.map((section) => () => buildSection(section, dsDir, dsId)))

const successfulSections = sectionResults.filter(Boolean).length
log(`[ds-import] Sections: ${successfulSections}/${sections.length} built`)

// ═══════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════
log(`[ds-import] ✅ Complete: "${dsName}" (${dsId})`)
// Generate barrel export from all non-story .tsx files in code/
const tsxFiles = String(await $`ls "${codeDir}"/*.tsx 2>/dev/null || true`).trim().split('\n').filter(Boolean)
const components = tsxFiles
  .filter(f => !f.endsWith('.stories.tsx'))
  .map(f => f.replace(/.*\/(\w+)\.tsx$/, '$1'))
  .filter(Boolean)

if (components.length > 0) {
  const indexLines = components.flatMap(c => [
    `export { ${c} } from './${c}';`,
    `export type { ${c}Props } from './${c}';`,
  ])
  await $`mkdir -p "${codeDir}" && echo '${indexLines.join('\n')}' > "${codeDir}/index.ts"`
  log(`[ds-import] Barrel export: ${components.length} components in index.ts`)
}

log(`[ds-import]   Tokens: ${dsDir}/tokens.css (${fetchResult?.tokens ?? '?'} tokens)`)
log(`[ds-import]   Primitives: ${components.length} in ${codeDir}/`)
log(`[ds-import]   Overview: ${overviewResult?.overviewFile ?? 'N/A'}`)
log(`[ds-import]   Tests: ${overviewResult?.testFile ?? 'none'} (${overviewResult?.testsPassed ? 'pass' : 'fail'})`)

return {
  id: dsId,
  name: dsName,
  path: dsDir,
  tokens: fetchResult?.tokens ?? 0,
  primitives: components.length,
  overviewFile: overviewResult?.overviewFile,
  testFile: overviewResult?.testFile,
  testsPassed: overviewResult?.testsPassed,
}
