import { Project, SyntaxKind, type SourceFile } from 'ts-morph';
import type { Graph } from '../graph.js';

export interface CodeFile {
  absPath: string;
  fileId: string;
}

/** The default utility-suffix → token-role map (used when no styling plugin supplies one). */
const DEFAULT_CLASS_ROLES: Record<string, string> = {
  'accent-hover': 'color-accent-hover', accent: 'color-accent',
  'surface-raised': 'color-surface-raised', surface: 'color-surface',
  'text-muted': 'color-text-muted', text: 'color-text', border: 'color-border',
};

/** Token roles referenced in source text: semantic utility classes (per the class→role map) + var(--x). */
export function extractTokenRoles(text: string, classRoles?: Record<string, string>): Set<string> {
  const roles = new Set<string>();
  const map = classRoles && Object.keys(classRoles).length ? classRoles : DEFAULT_CLASS_ROLES;
  const suffixes = Object.keys(map).sort((a, b) => b.length - a.length); // longest first (accent-hover before accent)
  const tw = new RegExp(`\\b(?:bg|text|border|ring|fill|stroke)-(${suffixes.join('|')})\\b`, 'g');
  let m: RegExpExecArray | null;
  while ((m = tw.exec(text))) roles.add(map[m[1]]);
  const cssVar = /var\(\s*--([a-z0-9-]+)\s*\)/g;
  while ((m = cssVar.exec(text))) roles.add(m[1]);
  return roles;
}

function statesIn(text: string): string[] {
  const states: string[] = [];
  if (/\bhover:/.test(text)) states.push('hover');
  if (/\bfocus(?:-visible)?:/.test(text)) states.push('focus');
  if (/\bdisabled:/.test(text)) states.push('disabled');
  if (/\bactive:/.test(text)) states.push('active');
  return states;
}

/** Exported PascalCase component names declared in a source file (function + arrow const). */
function exportedComponents(sf: SourceFile): string[] {
  const names = new Set<string>();
  for (const fn of sf.getFunctions()) {
    const n = fn.getName();
    if (fn.isExported() && n && /^[A-Z]/.test(n)) names.add(n);
  }
  for (const vs of sf.getVariableStatements()) {
    if (!vs.isExported()) continue;
    for (const d of vs.getDeclarations()) {
      const n = d.getName();
      if (/^[A-Z]/.test(n) && d.getInitializerIfKind(SyntaxKind.ArrowFunction)) names.add(n);
    }
  }
  return [...names];
}

export function addPrimitives(g: Graph, dsId: string, files: CodeFile[], classRoles?: Record<string, string>): void {
  const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
  const byName = new Map<string, string>(); // component name → primitive id

  // First pass: declare primitives (so composition edges can resolve).
  const parsed = files.map((f) => {
    const sf = project.addSourceFileAtPath(f.absPath);
    const comps = exportedComponents(sf);
    for (const name of comps) {
      const id = `${dsId}/${name}`;
      byName.set(name, id);
    }
    return { f, sf, comps };
  });

  for (const { f, sf, comps } of parsed) {
    const text = sf.getFullText();
    for (const name of comps) {
      const id = `${dsId}/${name}`;
      g.addNode(id, 'primitive', { name, source: { file: f.fileId } });
      g.addEdge(dsId, 'contains', id);
      g.addEdge(id, 'declaredIn', f.fileId);

      // props ← interface `<Name>Props`
      const iface = sf.getInterface(`${name}Props`);
      if (iface) {
        for (const p of iface.getProperties()) {
          const pid = `${id}#${p.getName()}`;
          g.addNode(pid, 'prop', { name: p.getName(), type: p.getType().getText(p), source: { file: f.fileId } });
          g.addEdge(id, 'hasProp', pid);
        }
      }

      // variants ← a `variants`/`tones` object literal's keys
      for (const decl of sf.getVariableDeclarations()) {
        if (!/variant|tone/i.test(decl.getName())) continue;
        const obj = decl.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
        if (!obj) continue;
        for (const prop of obj.getProperties()) {
          const pa = prop.asKind(SyntaxKind.PropertyAssignment);
          const key = pa?.getName();
          if (!pa || !key) continue;
          const vname = key.replace(/['"]/g, '');
          const vid = `${id}@${vname}`;
          g.addNode(vid, 'variant', { name: vname, source: { file: f.fileId } });
          g.addEdge(id, 'hasVariant', vid);
          // per-variant token usage (so impact analysis reaches the exact variant)
          for (const role of extractTokenRoles(pa.getInitializer()?.getText() ?? '', classRoles)) {
            const tokenId = `${dsId}/--${role}`;
            if (g.has(tokenId)) g.addEdge(vid, 'uses', tokenId);
          }
        }
      }

      // states ← interaction prefixes in classes
      for (const st of statesIn(text)) {
        const sid = `${id}:${st}`;
        g.addNode(sid, 'state', { name: st });
        g.addEdge(id, 'hasState', sid);
      }

      // token usage
      for (const role of extractTokenRoles(text, classRoles)) {
        const tokenId = `${dsId}/--${role}`;
        if (g.has(tokenId)) g.addEdge(id, 'uses', tokenId);
      }
    }

    // composition: sibling './X' imports of known components
    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();
      if (!spec.startsWith('./')) continue;
      for (const named of imp.getNamedImports()) {
        const target = byName.get(named.getName());
        for (const name of comps) {
          if (target && target !== `${dsId}/${name}`) g.addEdge(`${dsId}/${name}`, 'composes', target);
        }
      }
    }
  }
}
