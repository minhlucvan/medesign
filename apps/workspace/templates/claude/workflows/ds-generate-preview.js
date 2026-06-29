// ds-generate-preview.js
// Generate a rich, self-contained preview.html for a design system.
// Reads DESIGN.md + tokens.css, produces reference-example.html with
// color palette, typography samples, spacing scale, tokens table.
//
// Usage: workflow('ds-generate-preview', { id })
//   id - kebab-case id of an existing design system (under design-systems/)
export const meta = {
  name: 'ds-generate-preview',
  description: 'Generate rich preview.html for a design system: color palette, typography, spacing, tokens table.',
  phases: [
    { title: 'Read', detail: 'Read DESIGN.md + tokens.css + manifest.json' },
    { title: 'Build preview', detail: 'Build color palette, typography samples, spacing scale' },
    { title: 'Generate HTML', detail: 'Generate and write self-contained reference-example.html' },
  ],
}

const { id } = args
if (!id) throw new Error('ds-generate-preview: id is required')

const dsDir = `design-systems/${id}`
const outPath = `${dsDir}/reference-example.html`

phase('Read')
log(`[ds-generate-preview] Reading design system: ${id}`)

// Read design system files
let tokensCss = ''
let designMd = ''
let manifest = {}
try {
  tokensCss = await $`cat ${dsDir}/tokens.css 2>/dev/null || echo ''`
  log(`[ds-generate-preview] tokens.css: ${tokensCss.length} chars`)
} catch { log(`[ds-generate-preview] No tokens.css found`) }

try {
  designMd = await $`cat ${dsDir}/DESIGN.md 2>/dev/null || echo ''`
  log(`[ds-generate-preview] DESIGN.md: ${designMd.length} chars`)
} catch { log(`[ds-generate-preview] No DESIGN.md found`) }

try {
  const raw = await $`cat ${dsDir}/manifest.json 2>/dev/null || echo '{}'`
  manifest = JSON.parse(raw)
  log(`[ds-generate-preview] manifest: ${manifest.name || id}`)
} catch { /* no manifest */ }

// Count primitive components
let primitives = []
try {
  const listing = await $`ls ${dsDir}/code/*.tsx 2>/dev/null`
  if (listing) primitives = listing.trim().split('\n').filter(Boolean)
} catch { /* no primitives */ }
log(`[ds-generate-preview] ${primitives.length} primitive(s)`)

// Read design taste profile for Design DNA section
let tasteDials = { variance: 5, motion: 5, density: 5 }
let tasteContext = ''
try {
  const tasteSkill = await $`cat ${dsDir}/skills/taste/SKILL.md 2>/dev/null`
  if (tasteSkill) {
    const vMatch = tasteSkill.match(/DESIGN_VARIANCE:\s*(\d+)/)
    const mMatch = tasteSkill.match(/MOTION_INTENSITY:\s*(\d+)/)
    const dMatch = tasteSkill.match(/VISUAL_DENSITY:\s*(\d+)/)
    if (vMatch) tasteDials.variance = parseInt(vMatch[1])
    if (mMatch) tasteDials.motion = parseInt(mMatch[1])
    if (dMatch) tasteDials.density = parseInt(dMatch[1])
    tasteContext = tasteSkill
    log(`[ds-generate-preview] Found taste profile: V${tasteDials.variance} / M${tasteDials.motion} / D${tasteDials.density}`)
  }
} catch { /* no taste skill */ }
if (!tasteContext) {
  try {
    tasteContext = await $`cat .claude/skills/design-taste/THE_DIALS.md 2>/dev/null`
    log(`[ds-generate-preview] Using core design-taste reference`)
  } catch { /* no taste system */ }
}

// Check if a preview already exists
let existingPreview = ''
try {
  existingPreview = await $`wc -c < ${outPath} 2>/dev/null || echo 0`
  const size = parseInt(existingPreview.trim())
  if (size > 100) log(`[ds-generate-preview] Existing preview: ${size} bytes`)
} catch { /* no existing preview */ }

phase('Build preview')
log(`[ds-generate-preview] Building rich preview HTML`)

// Use agent to generate a beautiful, self-contained preview.html
const previewResult = await agent(
  `You are building a rich visual preview page for a design system called "${manifest.name || id}" at "${dsDir}".

The goal is to create a stunning, self-contained HTML page (like getdesign.md previews) that showcases the design system's visual language.

## Data available

### tokens.css (${tokensCss.length} chars):
\`\`\`css
${tokensCss.slice(0, 3000)}
\`\`\`

### DESIGN.md (${designMd.length} chars):
\`\`\`md
${designMd.slice(0, 2000)}
\`\`\`

### Manifest:
${JSON.stringify(manifest, null, 2)}

### Primitives: ${primitives.map(p => p.split('/').pop()).join(', ') || 'none'}

## Requirements

Generate a complete, self-contained HTML file that will be saved to "${outPath}".

### Design:
- Follow the visual style of getdesign.md: clean, modern, white background, rounded cards, generous whitespace
- Use Google Fonts (Inter) via CDN link: \`https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap\`
- All CSS must be inline in a single <style> block — NO external CSS files
- All content must be server-rendered (no JS needed to render)

### Sections (in order):

1. **Hero** — System name (large, bold), description, category badge, accent color accent strip

2. **Color Palette** — Grid of color swatch cards. Each card has:
   - A large color bar (the actual color)
   - The hex value (monospace)
   - The CSS variable name (--color-*)
   - Role description
   Parse colors from tokens.css by finding all --color-* variables. If no tokens.css, use design system section from DESIGN.md.

3. **Typography** — Show font samples:
   - Display/heading font (large size, bold)
   - Body font (regular size, readable)
   - Mono font (if available, code-style)
   Each should show the font name and a preview sentence.
   Extract font info from --font-* variables in tokens.css.

4. **Spacing Scale** — Visual bars showing relative spacing sizes (xs through 2xl or similar).
   Each row: label | colored bar (width proportional to value) | CSS variable name | value
   Extract from --space-* variables in tokens.css.

5. **Design Tokens Table** — Full table of all tokens from tokens.css.
   Columns: CSS Variable | Value | Category
   Group by category (Colors, Typography, Spacing, Shadows, Radii, etc.)

6. **Design DNA** — A section showing the design system's taste profile:
   - A "Design DNA" header
   - Three visual bars representing the three dials (VARIANCE, MOTION, DENSITY)
   - Each bar shows the dial name, value (1-10), and label (e.g. "Characterful", "Purposeful", "Balanced")
   - The bar width should be proportional to the value (10% → 100%)
   - Use the accent color for the bars
   - Follow getdesign.md's clean, modern aesthetic

   Dial values from the system's taste profile:
   - DESIGN_VARIANCE: ${tasteDials.variance}/10
   - MOTION_INTENSITY: ${tasteDials.motion}/10
   - VISUAL_DENSITY: ${tasteDials.density}/10

   ${tasteContext ? 'Taste context: ' + tasteContext.slice(0, 500) : ''}

7. **Primitives** — If any .tsx files exist in code/, list them as component chips/badges

8. **Footer** — "Generated by emdesign" with timestamp

### Color handling:
- If the design system has an --color-surface or --color-background, use it as the page background
- If it has --color-text, use it for text
- Use --color-accent as the accent color throughout
- For the luminance calculation: light background → dark text, dark background → light text

### Output:
Write the complete HTML to "${outPath}" using \`cat > file << 'HTMLEOF'\`.

Return the file path and size.`,
  { label: `preview:${id}`, phase: 'Generate HTML', schema: { type: 'object', properties: { filePath: { type: 'string' }, size: { type: 'number' } }, required: ['filePath'] } }
)

// Verify the preview was written
let finalSize = 0
try {
  const sizeStr = await $`wc -c < ${outPath} 2>/dev/null || echo 0`
  finalSize = parseInt(sizeStr.trim())
} catch { /* */ }

if (finalSize > 0) {
  log(`[ds-generate-preview] ✅ Preview written: ${outPath} (${finalSize} bytes)`)
} else {
  log(`[ds-generate-preview] ⚠️  Preview may not have been written, attempting fallback`)

  // Fallback: generate a minimal preview manually
  const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${manifest.name || id} — Design System Preview</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #ffffff; color: #111; line-height: 1.6; padding: 40px 24px; }
  .ds-preview { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: clamp(28px, 4vw, 42px); font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px; }
  .desc { font-size: 16px; color: #666; margin-bottom: 32px; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #999; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; }
</style>
</head>
<body>
<div class="ds-preview">
  <h1>${manifest.name || id}</h1>
  ${manifest.description ? `<p class="desc">${manifest.description}</p>` : ''}

  <h2 class="section-title">Color Palette</h2>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:32px">
    ${['accent', 'surface', 'text', 'border'].map(role => {
      const color = tokensCss.match(new RegExp(`--color-${role}\\s*:\\s*([^;]+)`))?.[1] || '#ccc'
      return `<div style="border-radius:8px;overflow:hidden;border:1px solid #eee">
        <div style="height:80px;background:${color}"></div>
        <div style="padding:8px 10px">
          <div style="font-family:monospace;font-size:12px">${color}</div>
          <div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.05em">--color-${role}</div>
        </div>
      </div>`
    }).join('')}
  </div>

  <h2 class="section-title">Tokens</h2>
  <table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr>
      <th style="text-align:left;padding:8px;border-bottom:1px solid #eee;font-size:11px;color:#999">Variable</th>
      <th style="text-align:left;padding:8px;border-bottom:1px solid #eee;font-size:11px;color:#999">Value</th>
    </tr></thead>
    <tbody>
      ${tokensCss.split('\\n').filter(l => l.includes(':') && l.includes('--')).slice(0, 30).map(line => {
        const m = line.match(/--([\\w-]+)\\s*:\\s*([^;]+)/)
        return m ? `<tr><td style="padding:4px 8px;border-bottom:1px solid #f5f5f5;font-family:monospace">--${m[1]}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f5f5f5;font-family:monospace">${m[2].trim()}</td></tr>` : ''
      }).join('')}
    </tbody>
  </table>

  <div class="footer">Generated by emdesign · ${new Date().toISOString().slice(0, 10)}</div>
</div>
</body>
</html>`

  await $`cat > ${outPath} << 'HTMLEOF'
${fallbackHtml}
HTMLEOF`
  log(`[ds-generate-preview] ✅ Fallback preview written`)
}

return {
  id,
  path: outPath,
  size: finalSize,
  primitives: primitives.length,
}
