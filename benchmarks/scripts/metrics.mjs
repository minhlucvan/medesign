/**
 * White-box metrics — deterministic code analysis.
 *
 * Extracts token compliance, TypeScript health, complexity, and pattern
 * adherence from component source code. No LLM needed — pure regex + counting.
 *
 * Usage: node benchmarks/scripts/metrics.mjs <source-file> [--declared-tokens token1,token2,...]
 * Output: JSON with WhiteBoxMetrics
 */

import { readFileSync } from 'node:fs';

// Known Tailwind semantic classes for token roles — matches plugin-tailwindcss output
const SEMANTIC_CLASSES = [
  'bg-surface', 'bg-surface-raised', 'bg-accent', 'bg-accent-hover', 'bg-highlight',
  'bg-border', 'bg-text', 'bg-text-muted',
  'text-surface', 'text-surface-raised', 'text-accent', 'text-accent-hover',
  'text-highlight', 'text-highlight-ink', 'text-text', 'text-text-muted',
  'border-surface', 'border-surface-raised', 'border-accent', 'border-accent-hover',
  'border-border', 'border-highlight',
];

function stripTokenBlocks(src) {
  return src.replace(/:root\s*\{[\s\S]*?\}/g, '')
    .replace(/\[data-theme[^\]]*\]\s*\{[\s\S]*?\}/g, '');
}

function analyzeTokens(body, declaredTokens) {
  const rawHexes = body.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const hexCount = [...new Set(rawHexes)].length;

  // Count var() references that don't resolve to declared tokens
  const declared = new Set(declaredTokens);
  const varRefs = body.match(/var\(\s*--([a-z0-9-]+)\s*\)/gi) || [];
  let unresolvedCount = 0;
  for (const ref of varRefs) {
    const name = ref.replace(/var\(\s*--/i, '').replace(/\s*\)/, '');
    if (!declared.has(name)) unresolvedCount++;
  }

  // Count inline style declarations that use color/font values
  const styleAttrs = body.match(/style=\{\{[^}]*\}?\}/g) || [];
  const offTokenStyles = styleAttrs.filter((s) =>
    /color|background|border|font|shadow/i.test(s) && !/var\(--/.test(s)
  ).length;

  // Count semantic class usage
  const classUsage = {};
  for (const cls of SEMANTIC_CLASSES) {
    const re = new RegExp(`\\b${cls}\\b`, 'g');
    const matches = body.match(re);
    if (matches) classUsage[cls] = matches.length;
  }
  const totalSemanticUses = Object.values(classUsage).reduce((sum, c) => sum + c, 0);

  let score = 1.0;
  score -= hexCount * 0.2;
  score -= unresolvedCount * 0.2;
  score -= offTokenStyles * 0.1;

  return {
    tokenCompliance: Math.max(0, Math.round(score * 100) / 100),
    rawHexCount: hexCount,
    unresolvedVarCount: unresolvedCount,
    offTokenStyleCount: offTokenStyles,
  };
}

function analyzeTypeScript(body) {
  const anyCasts = (body.match(/\bas\s+any\b/g) || []).length;
  const tsIgnores = (body.match(/@ts-ignore/g) || []).length;
  const anyTypes = (body.match(/:\s*any\b/g) || []).length;
  const explicitAny = body.includes(': any') || body.includes('as any');

  // Count untyped props — look for interface props without inline types
  const fullUntyped = anyTypes + anyCasts + tsIgnores;

  let score = 1.0;
  score -= anyCasts * 0.1;
  score -= tsIgnores * 0.1;
  score -= anyTypes * 0.15;

  return {
    typescript: Math.max(0, Math.round(score * 100) / 100),
    anyCount: anyCasts + anyTypes,
    tsIgnoreCount: tsIgnores,
    untypedPropCount: fullUntyped,
  };
}

function analyzeComplexity(body) {
  const lines = body.split('\n').length;

  // Count props by looking for interface property declarations or destructured props
  const propMatches = body.match(/(\w+\??:\s*[\w.[\]()<>|,&{}'"]+;)/g);
  const propCount = propMatches ? propMatches.length : 0;

  // Max conditional depth via ternary nesting
  const ternaries = body.match(/\?[^?]*:/g) || [];
  let maxTernaryDepth = 0;
  for (const t of ternaries) {
    const depth = (t.match(/\?/g) || []).length;
    maxTernaryDepth = Math.max(maxTernaryDepth, depth);
  }

  // Max JSX depth — count opening tags in longest chain
  const jsxLines = body.split('\n').filter((l) => /<\w/.test(l));
  let maxDepth = 0;
  let depth = 0;
  for (const line of jsxLines) {
    const opens = (line.match(/<\w/g) || []).length;
    const closes = (line.match(/<\/\w/g) || []).length;
    depth += opens - closes;
    maxDepth = Math.max(maxDepth, depth);
  }

  // Fragment count
  const fragments = (body.match(/<>\s*<\/>/g) || []).length +
    (body.match(/<Fragment>/g) || []).length;

  // Score: normalize vs ideal ranges
  const locScore = lines <= 200 ? 1.0 : Math.max(0, 1.0 - (lines - 200) / 400);
  const propScore = propCount >= 2 && propCount <= 10 ? 1.0 : Math.max(0, 1.0 - Math.abs(propCount - 5) * 0.1);
  const depthScore = maxTernaryDepth <= 2 ? 1.0 : Math.max(0, 1.0 - (maxTernaryDepth - 2) * 0.2);
  const jsxDepthScore = maxDepth <= 8 ? 1.0 : Math.max(0, 1.0 - (maxDepth - 8) * 0.1);
  const fragScore = fragments <= 2 ? 1.0 : Math.max(0, 1.0 - (fragments - 2) * 0.1);

  const score = (locScore + propScore + depthScore + jsxDepthScore + fragScore) / 5;

  return {
    complexity: Math.round(score * 100) / 100,
    linesOfCode: lines,
    propCount,
    maxConditionalDepth: maxTernaryDepth,
    maxJsxDepth: maxDepth,
  };
}

function analyzePatterns(body) {
  const violations = [];

  // Hook rules
  if (/(useState|useEffect|useCallback|useMemo|useRef)\s*\([^)]*\)\s*\{/.test(body)) {
    violations.push('Hook call inside a function body (may violate hooks-in-conditions rule)');
  }

  // Key props on map
  const mapsWithoutKeys = body.match(/\.map\s*\(/g);
  if (mapsWithoutKeys && !/key=\{|key="/.test(body)) {
    violations.push('.map() without key prop');
  }

  // Event handler naming
  const inlineHandlers = body.match(/onClick=\{\([^)]*\)\s*=>/g);
  if (inlineHandlers) violations.push(`${inlineHandlers.length} inline arrow event handler(s) — use named handlers`);

  // Inline styles vs Tailwind classes
  const inlineStyles = body.match(/style=\{\{[^}]*\}?\}/g);
  if (inlineStyles) violations.push(`${inlineStyles.length} inline style(s) — prefer Tailwind classes`);

  // Direct HTML elements that should be primitives
  const rawButtons = body.match(/<button\b/g);
  if (rawButtons && !body.includes(`from '@ds'`)) {
    violations.push('Uses raw <button> instead of Button primitive from @ds');
  }

  let score = 1.0;
  score -= violations.length * 0.1;

  return {
    patterns: Math.max(0, Math.round(score * 100) / 100),
    patternViolations: violations,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────

const sourceFile = process.argv[2];
const declaredIdx = process.argv.indexOf('--declared-tokens');
const declaredTokens = declaredIdx !== -1
  ? process.argv[declaredIdx + 1].split(',')
  : [];

if (!sourceFile) {
  console.error('Usage: node metrics.mjs <source-file> [--declared-tokens token1,token2,...]');
  process.exit(1);
}

const source = readFileSync(sourceFile, 'utf8');
const body = stripTokenBlocks(source);

const tokenResult = analyzeTokens(body, declaredTokens);
const tsResult = analyzeTypeScript(body);
const complexityResult = analyzeComplexity(body);
const patternResult = analyzePatterns(body);

const composite =
  tokenResult.tokenCompliance * 0.35 +
  tsResult.typescript * 0.25 +
  complexityResult.complexity * 0.20 +
  patternResult.patterns * 0.20;

const result = {
  ...tokenResult,
  ...tsResult,
  ...complexityResult,
  ...patternResult,
  composite: Math.round(composite * 100) / 100,
};

console.log(JSON.stringify(result, null, 2));
