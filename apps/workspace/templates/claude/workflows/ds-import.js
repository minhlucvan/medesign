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
    { title: 'Fetch & tokens', detail: 'Fetch DESIGN.md, extract tokens.css, write manifest' },
    { title: 'Craft primitives', detail: 'Generate code/ React components from DESIGN.md' },
    { title: 'Compose overview', detail: 'Delegate to ds-compose-overview (Red-Green workflow)' },
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
// Phase 2: Craft React primitives from DESIGN.md
// ═══════════════════════════════════════════════════════════════════════
phase('Craft primitives')
log('[ds-import] Generating React primitive components')

const primitivesResult = await agent(
  `You are building React primitive components for the "${dsName}" design system at ${codeDir}/.

Read the DESIGN.md at ${dsDir}/DESIGN.md and tokens.css at ${dsDir}/tokens.css to understand the visual language.

Generate React .tsx component files for these primitives. Each component MUST:
- Use the token CSS variables (var(--color-accent), var(--font-sans), var(--space-md), etc.)
- Have proper TypeScript prop types with JSDoc
- NOT hardcode hex values — always reference CSS custom properties
- Be a functional component with inline styles referencing the tokens

Create these files:
1. **Button.tsx** — variants: primary (--color-accent bg), secondary (outline), ghost. Sizes: sm/md/lg. Support disabled.
2. **Card.tsx** — container with border, padding, rounded corners. Variants: default, elevated (with shadow).
3. **Input.tsx** — text input with label, placeholder, focus/error states.
4. **Badge.tsx** — small label with color variants (accent, success, warn, danger).
5. **Heading.tsx** — h1-h6 using --font-display with proper sizes from the type scale.
6. **Text.tsx** — body text using --font-sans. Variants: body, body-sm, caption, code.
7. **Link.tsx** — anchor styled with --color-link, hover state.
8. **Stack.tsx** — flex layout wrapper. Variants: row, col with gap prop.
9. **Swatch.tsx** — color swatch showing a token value with label and hex.

Also generate an **index.ts** that re-exports all components.

Each file should be written using the Write tool (NOT shell commands).
Return an array of file paths created.`,
  { label: `primitives:${dsId}`, phase: 'Craft primitives', schema: {
    type: 'object',
    properties: {
      files: { type: 'array', items: { type: 'string' } },
      count: { type: 'number' },
    },
    required: ['files'],
  }}
)

const componentCount = primitivesResult?.count ?? primitivesResult?.files?.length ?? 0
log(`[ds-import] Created ${componentCount} primitive component(s)`)

// ═══════════════════════════════════════════════════════════════════════
// Phase 3: Delegate overview to ds-compose-overview (Red-Green)
// ═══════════════════════════════════════════════════════════════════════
phase('Compose overview')
log('[ds-import] Delegating overview to ds-compose-overview (Red-Green)')

const overviewResult = await workflow({scriptPath: 'apps/workspace/templates/claude/workflows/ds-compose-overview.js'}, {
  dsId,
  dsPath: dsDir,
  maxAttempts: 3,
})

log(`[ds-import] Overview: ${overviewResult?.overviewFile ?? 'N/A'}`)
log(`[ds-import]   Tests: ${overviewResult?.testFile ?? 'N/A'} (${overviewResult?.testsPassed ? 'pass' : 'fail'})`)

// ═══════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════
log(`[ds-import] ✅ Complete: "${dsName}" (${dsId})`)
log(`[ds-import]   Tokens: ${dsDir}/tokens.css (${fetchResult?.tokens ?? '?'} tokens)`)
log(`[ds-import]   Primitives: ${componentCount} components in ${codeDir}/`)
log(`[ds-import]   Overview: ${overviewResult?.overviewFile ?? 'N/A'}`)
log(`[ds-import]   Tests: ${overviewResult?.testFile ?? 'none'}`)

return {
  id: dsId,
  name: dsName,
  path: dsDir,
  tokens: fetchResult?.tokens ?? 0,
  primitives: componentCount,
  overviewFile: overviewResult?.overviewFile,
  testFile: overviewResult?.testFile,
  testsPassed: overviewResult?.testsPassed,
}
