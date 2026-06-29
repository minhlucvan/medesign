// ds-import.js
// Import a DESIGN.md from a URL or awesome-design-md and scaffold it
// into a complete design system with rich preview.
// Orchestrates: fetch → ds-scaffold → ds-generate-preview
//
// Usage: workflow('ds-import', { source, id?, name?, description? })
//   source - one of:
//     'awesome/{brand}'  — import from awesome-design-md (e.g. 'awesome/airbnb')
//     'https://...'       — fetch DESIGN.md from a raw URL
//     '/path/to/file.md'  — local file path
//   id     - optional kebab-case id (auto-derived from source if omitted)
//   name   - optional display name
//   description - optional description
export const meta = {
  name: 'ds-import',
  description: 'Import DESIGN.md from URL/file/awesome, scaffold a complete design system, and generate rich preview.',
  phases: [
    { title: 'Fetch', detail: 'Fetch DESIGN.md from source' },
    { title: 'Scaffold', detail: 'Run standard ds-scaffold workflow' },
    { title: 'Generate preview', detail: 'Run ds-generate-preview workflow' },
  ],
}

const { source, id: explicitId, name, description } = args
if (!source) throw new Error('ds-import: source is required (e.g. "awesome/airbnb", a URL, or a file path)')

const tmpDir = '.claude/tmp'
const mdPath = `${tmpDir}/import-designd.md`

// Determine source type and fetch
phase('Fetch')
log(`[ds-import] Importing from: ${source}`)

// Ensure tmp directory
try { await $`mkdir -p ${tmpDir}` } catch { /* */ }

let brand = ''
let fetchedName = name || ''
let fetchedDescription = description || ''
let dsId = explicitId || ''

if (source.startsWith('awesome/')) {
  // awesome-design-md import
  brand = source.replace('awesome/', '')
  const url = `https://raw.githubusercontent.com/voltagent/awesome-design-md/main/design-md/${brand}/DESIGN.md`
  log(`[ds-import] Fetching DESIGN.md from awesome-design-md: ${brand}`)

  try {
    const response = await $`curl -sL ${url}`
    if (!response || response.length < 10) {
      throw new Error(`Empty response for brand "${brand}" — check that it exists at ${url}`)
    }
    await $`cat > ${mdPath} << 'MDEOF'
${response}
MDEOF`
    log(`[ds-import] ✅ Fetched DESIGN.md (${response.length} chars)`)

    // Parse frontmatter for name/description
    const fmMatch = response.match(/^---\n([\s\S]*?)\n---/)
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const m = line.match(/^(\w+):\s*(.+)$/)
        if (m) {
          const val = m[2].replace(/^["']|["']$/g, '')
          if (m[1] === 'name') fetchedName = fetchedName || val
          if (m[1] === 'description') fetchedDescription = fetchedDescription || val
          if (m[1] === 'category' && !description) fetchedDescription = fetchedDescription || val
        }
      }
    }
  } catch (e) {
    throw new Error(`[ds-import] Failed to fetch awesome-design-md for "${brand}": ${e.message}`)
  }

  // Derive id from brand if not explicitly set
  dsId = dsId || brand.toLowerCase().replace(/[^a-z0-9-]/g, '-')

} else if (source.startsWith('http://') || source.startsWith('https://')) {
  // URL import
  log(`[ds-import] Fetching DESIGN.md from URL: ${source}`)
  try {
    const response = await $`curl -sL ${source}`
    if (!response || response.length < 10) {
      throw new Error(`Empty response from ${source}`)
    }
    await $`cat > ${mdPath} << 'MDEOF'
${response}
MDEOF`
    log(`[ds-import] ✅ Fetched DESIGN.md (${response.length} chars)`)

    // Parse name from URL or frontmatter
    const urlMatch = source.match(/\/([^/]+?)(?:\.md)?$/)
    fetchedName = fetchedName || urlMatch?.[1] || 'imported'

    const fmMatch = response.match(/^---\n([\s\S]*?)\n---/)
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const m = line.match(/^(\w+):\s*(.+)$/)
        if (m) {
          const val = m[2].replace(/^["']|["']$/g, '')
          if (m[1] === 'name') fetchedName = val
          if (m[1] === 'description') fetchedDescription = fetchedDescription || val
        }
      }
    }
  } catch (e) {
    throw new Error(`[ds-import] Failed to fetch from URL: ${e.message}`)
  }

  dsId = dsId || fetchedName.toLowerCase().replace(/[^a-z0-9-]/g, '-')

} else {
  // Local file path import
  log(`[ds-import] Using local DESIGN.md: ${source}`)
  try {
    const content = await $`cat ${source}`
    await $`cat > ${mdPath} << 'MDEOF'
${content}
MDEOF`
    log(`[ds-import] ✅ Loaded DESIGN.md (${content.length} chars)`)

    // Derive name from filename or frontmatter
    const fileMatch = source.match(/\/([^/]+?)(?:\.md)?$/)
    fetchedName = fetchedName || fileMatch?.[1] || 'imported'

    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const m = line.match(/^(\w+):\s*(.+)$/)
        if (m) {
          const val = m[2].replace(/^["']|["']$/g, '')
          if (m[1] === 'name') fetchedName = val
          if (m[1] === 'description') fetchedDescription = fetchedDescription || val
        }
      }
    }
  } catch (e) {
    throw new Error(`[ds-import] Failed to read local file: ${e.message}`)
  }

  dsId = dsId || fetchedName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

log(`[ds-import] Design system: id="${dsId}", name="${fetchedName}"`)

// Save the fetched DESIGN.md path for the scaffold workflow
const designMdPath = mdPath

phase('Generate taste profile')
log(`[ds-import] Analyzing design taste for "${dsId}"`)

let tasteDials = { variance: 5, motion: 5, density: 5 }

// Use agent to analyze the fetched DESIGN.md and generate a taste profile
const tasteResult = await agent(
  \`Read the DESIGN.md at "${designMdPath}" and generate a taste profile for this design system.

Extract:
1. The three dials: DESIGN_VARIANCE (1-10), MOTION_INTENSITY (1-10), VISUAL_DENSITY (1-10)
   - VARIANCE: how opinionated/bold the token values are. 1-3=conventional, 4-6=characterful, 7-10=bold
   - MOTION: how much motion the system uses. 1-3=static, 4-6=purposeful, 7-10=expressive
   - DENSITY: how much information per view. 1-3=airy, 4-6=balanced, 7-10=compact
2. Brand fingerprint: what makes this system distinctive
3. Key visual characteristics: color direction, typography voice, spacing philosophy
4. Anti-patterns that would violate this system's taste

Use the DESIGN.md's section 1 (Visual Theme) and section 8 (Voice) as primary signal sources.
If the DESIGN.md doesn't explicitly describe taste, infer it from the color palette, typography choices, and spacing values.

Return the taste profile as structured data.`,
  { label: \`taste:\${dsId}\`, phase: 'Generate taste profile', schema: {
    type: 'object',
    properties: {
      VARIANCE: { type: 'number', minimum: 1, maximum: 10 },
      MOTION: { type: 'number', minimum: 1, maximum: 10 },
      DENSITY: { type: 'number', minimum: 1, maximum: 10 },
      brandFingerprint: { type: 'string' },
      visualCharacteristics: { type: 'string' },
      antiPatterns: { type: 'string' },
    },
    required: ['VARIANCE', 'MOTION', 'DENSITY'],
  }}
)

if (tasteResult) {
  tasteDials = { variance: tasteResult.VARIANCE, motion: tasteResult.MOTION, density: tasteResult.DENSITY }
  log(\`[ds-import] Taste profile: V\${tasteDials.variance} / M\${tasteDials.motion} / D\${tasteDials.density}\`)
  if (tasteResult.brandFingerprint) log(\`[ds-import] \${tasteResult.brandFingerprint.slice(0, 80)}...\`)

  // Write taste profile to disk
  const tasteSkill = \`---
name: \${dsId}-taste
description: Design taste profile for \${fetchedName} — visual voice, three-dial settings, and brand fingerprint.
dials:
  DESIGN_VARIANCE: \${tasteDials.variance}
  MOTION_INTENSITY: \${tasteDials.motion}
  VISUAL_DENSITY: \${tasteDials.density}
brand:
  fingerprint: "\${(tasteResult.brandFingerprint || '').replace(/"/g, '\\"')}"
  visual: "\${(tasteResult.visualCharacteristics || '').replace(/"/g, '\\"')}"
---

# \${fetchedName} — Design Taste Profile

## Three Dials
- **DESIGN_VARIANCE**: \${tasteDials.variance}/10 — \${tasteDials.variance <= 3 ? 'Conventional, safe' : tasteDials.variance <= 6 ? 'Characterful, one distinctive move' : 'Bold, experimental'}
- **MOTION_INTENSITY**: \${tasteDials.motion}/10 — \${tasteDials.motion <= 3 ? 'Static, minimal' : tasteDials.motion <= 6 ? 'Purposeful micro-interactions' : 'Expressive, animated'}
- **VISUAL_DENSITY**: \${tasteDials.density}/10 — \${tasteDials.density <= 3 ? 'Airy, generous whitespace' : tasteDials.density <= 6 ? 'Balanced, comfortable' : 'Compact, efficient'}

## Brand Fingerprint
\${tasteResult.brandFingerprint || 'Not specified'}

## Visual Characteristics
\${tasteResult.visualCharacteristics || 'Not specified'}

## Anti-Patterns
\${tasteResult.antiPatterns || 'Not specified'}

## Design Principles
1. Taste drives tokens — every token value should be justifiable from the design read
2. Stay on-dial — if VARIANCE is low, don't introduce avant-garde layouts
3. Consistency over cleverness — one accent, one display face, one spacing philosophy
4. Validate with \`emdesign doctor\` and \`emdesign explore\` to maintain baseline quality
\`

  try {
    await $\`mkdir -p ${dsDir}/skills/taste\`
    await $\`cat > ${dsDir}/skills/taste/SKILL.md << 'SKILLEOF'
\${tasteSkill}
SKILLEOF\`
    log(\`[ds-import] ✅ Taste skill saved to \${dsDir}/skills/taste/SKILL.md\`)
  } catch (e) {
    log(\`[ds-import] ⚠️  Failed to save taste skill: \${e.message}\`)
  }
} else {
  log(\`[ds-import] ⚠️  Taste analysis failed, using defaults\`)
}

phase('Scaffold')
log(\`[ds-import] Running ds-scaffold workflow for "\${dsId}"\`)

// Call the scaffold workflow
const scaffoldResult = await workflow('ds-scaffold', {
  id: dsId,
  designMdPath,
  source,
  name: fetchedName,
  description: fetchedDescription,
  dials: tasteDials,
})

if (!scaffoldResult?.id) {
  throw new Error(`[ds-import] ds-scaffold failed for "${dsId}"`)
}
log(`[ds-import] ✅ Scaffold complete: ${scaffoldResult.path}`)
log(`[ds-import]   Tokens: ${scaffoldResult.tokens || 'generated'}`)
log(`[ds-import]   Primitives: ${scaffoldResult.primitives || 0}`)
log(`[ds-import]   Validated: ${scaffoldResult.validated ? '✅' : '⚠️'}`)

phase('Generate preview')
log(`[ds-import] Running ds-generate-preview workflow for "${dsId}"`)

// Call the generate-preview workflow
const previewResult = await workflow('ds-generate-preview', {
  id: dsId,
})

if (previewResult?.path) {
  log(`[ds-import] ✅ Preview generated: ${previewResult.path}`)
  if (previewResult.size) log(`[ds-import]   Size: ${previewResult.size} bytes`)
} else {
  log(`[ds-import] ⚠️  Preview generation had issues`)
}

// Cleanup temp file
try { await $`rm -f ${mdPath}` } catch { /* */ }

log(`[ds-import] ✅ Import complete: "${dsId}"`)
log(`[ds-import]   System: design-systems/${dsId}/`)
log(`[ds-import]   Preview: design-systems/${dsId}/reference-example.html`)

return {
  id: dsId,
  name: fetchedName,
  path: `design-systems/${dsId}`,
  previewPath: `design-systems/${dsId}/reference-example.html`,
  tokens: scaffoldResult.tokens,
  primitives: scaffoldResult.primitives || 0,
  validated: scaffoldResult.validated || false,
}
