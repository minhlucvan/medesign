import type { MedesignPlugin, GraphParser, DesignReviewRule, ReviewContext } from '@medesign/plugin-api';

// ---- small CSS helpers (this plugin OWNS CSS understanding) ----
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgb|hsl)/i;
function tokenKind(role: string): string {
  if (role.startsWith('color-')) return 'color';
  if (/^(font|text|leading|tracking)/.test(role)) return 'type';
  if (role.startsWith('space')) return 'spacing';
  if (role.startsWith('radius')) return 'radius';
  if (/^(shadow|focus)/.test(role)) return 'shadow';
  if (/^(motion|ease)/.test(role)) return 'motion';
  return 'layout';
}
function rootBlock(css: string): string { return css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? css; }
function decls(block: string): Array<{ name: string; value: string }> {
  return [...block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((m) => ({ name: m[1], value: m[2].trim() }));
}
function firstFont(value: string): string | undefined {
  return value.split(',')[0]?.trim().replace(/^["']|["']$/g, '') || undefined;
}
function parseHex(v: string): [number, number, number] | null {
  let h = v.trim().toLowerCase();
  if (!h.startsWith('#')) return null;
  h = h.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length < 6) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: string, b: string): number | null {
  const ha = parseHex(a), hb = parseHex(b);
  if (!ha || !hb) return null;
  const la = luminance(ha), lb = luminance(hb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The canonical CSS → graph parser. Owns tokens/colors/typefaces/themes + contributes new node types. */
const cssParser: GraphParser = (g, dsId, ctx) => {
  const css = ctx.tokensCss;
  if (!css) return;
  const fileId = `${dsId}/tokens.css`;

  // var groups (from `/* ---- color ---- */` comment headers in :root)
  for (const m of (rootBlock(css).match(/\/\*\s*-*\s*([a-z0-9 /]+?)\s*-*\s*\*\//gi) ?? [])) {
    const name = m.replace(/\/\*|\*\/|-/g, '').trim();
    if (name) { const id = `${dsId}/group/${name.replace(/\s+/g, '-')}`; g.addNode(id, 'cssVarGroup', { name }); g.addEdge(dsId, 'contains', id); }
  }

  // tokens (+ colors + typefaces)
  for (const d of decls(rootBlock(css))) {
    const kind = tokenKind(d.name);
    const tokenId = `${dsId}/--${d.name}`;
    g.addNode(tokenId, 'token', { name: `--${d.name}`, kind, value: d.value, source: { file: fileId } });
    g.addEdge(dsId, 'contains', tokenId);
    g.addEdge(tokenId, 'declaredIn', fileId);
    if (kind === 'color' && COLOR_RE.test(d.value)) {
      const colorId = `${dsId}/${d.value.toLowerCase()}`;
      g.addNode(colorId, 'color', { value: d.value.toLowerCase() });
      g.addEdge(tokenId, 'tokenValue', colorId);
    }
    if (kind === 'type' && d.name.startsWith('font-')) {
      const fam = firstFont(d.value);
      if (fam) { const faceId = `${dsId}/face/${fam}`; g.addNode(faceId, 'typeface', { family: fam, role: d.name.replace('font-', '') }); g.addEdge(tokenId, 'usesFont', faceId); }
    }
  }

  // themes ([data-theme="x"] override blocks → theme nodes + overrides edges)
  for (const m of css.matchAll(/\[data-theme=["']?([a-z0-9-]+)["']?\]\s*\{([\s\S]*?)\}/gi)) {
    const themeId = `${dsId}/theme/${m[1]}`;
    g.addNode(themeId, 'theme', { name: m[1], source: { file: fileId } });
    g.addEdge(dsId, 'contains', themeId);
    for (const d of decls(m[2])) g.addEdge(themeId, 'overrides', `${dsId}/--${d.name}`, { value: d.value });
  }

  // breakpoints (@media min/max-width)
  for (const m of css.matchAll(/@media[^{]*?\(\s*(min|max)-width:\s*([0-9.]+)px/gi)) {
    const id = `${dsId}/bp/${m[1]}-${m[2]}`;
    g.addNode(id, 'breakpoint', { edge: m[1], px: Number(m[2]) });
    g.addEdge(dsId, 'contains', id);
  }

  // contrast pairs (surface × text) for a11y — computed from :root hex values
  const root = Object.fromEntries(decls(rootBlock(css)).map((d) => [d.name, d.value]));
  for (const [bg, fg] of [['color-surface', 'color-text'], ['color-surface-raised', 'color-text'], ['color-surface', 'color-text-muted']]) {
    const ratio = root[bg] && root[fg] ? contrast(root[bg], root[fg]) : null;
    if (ratio != null) {
      const id = `${dsId}/contrast/${bg}-${fg}`;
      g.addNode(id, 'contrastPair', { bg, fg, ratio: Math.round(ratio * 100) / 100, aa: ratio >= 4.5, aaLarge: ratio >= 3 });
      g.addEdge(dsId, 'contains', id);
    }
  }
};

// ---- CSS production-readiness doctor rules (read the data the parser emitted) ----
const themingComplete: DesignReviewRule = {
  id: 'css-theming-complete', category: 'css', title: 'Each theme overrides all color roles', severity: 'P2', target: 'full color coverage',
  check: ({ ds }: ReviewContext) => {
    const themes = ds.themes();
    if (!themes.length) return { pass: true, detail: 'no themes (n/a)' };
    const colorRoles = ds.tokens().filter((t) => t.kind === 'color').map((t) => t.name.replace(/^--/, ''));
    const gaps = themes.map((t) => { const ov = new Set(t.overrides().map((o) => o.token.split('/--').pop())); return { theme: t.name, missing: colorRoles.filter((r) => !ov.has(r)) }; }).filter((x) => x.missing.length);
    return { pass: gaps.length === 0, detail: gaps.length ? gaps.map((g) => `${g.theme}: ${g.missing.length} unset`).join('; ') : 'complete', fix: 'Override every color role in each [data-theme] block.' };
  },
};
const contrastAA: DesignReviewRule = {
  id: 'css-contrast-aa', category: 'a11y', title: 'Surface↔text contrast meets WCAG AA', severity: 'P1', target: '>= 4.5:1',
  check: ({ ds }: ReviewContext) => {
    const pairs = ds.graph.nodes({ label: 'contrastPair' });
    if (!pairs.length) return { pass: true, detail: 'no computable hex pairs (n/a)' };
    const fails = pairs.filter((p) => p.props.bg === 'color-surface' && p.props.fg === 'color-text' && p.props.aa === false);
    const main = pairs.find((p) => p.props.bg === 'color-surface' && p.props.fg === 'color-text');
    return { pass: fails.length === 0, detail: main ? `surface↔text ${main.props.ratio}:1` : 'computed', fix: 'Darken text or lighten surface so body text clears 4.5:1.' };
  },
};

/** plugin-css — owns CSS→graph parsing (tokens/themes/colors), adds node types, and CSS doctor rules. */
export const cssPlugin: MedesignPlugin = {
  id: 'css',
  kind: 'styling',
  graphParsers: () => [cssParser],
  nodeTypes: () => ['token', 'color', 'typeface', 'theme', 'cssVarGroup', 'breakpoint', 'contrastPair'],
  doctorRules: () => [themingComplete, contrastAA],
};

export default cssPlugin;
