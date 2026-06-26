import type { MedesignPlugin } from '@medesign/plugin-api';
import { reactPlugin } from '@medesign/plugin-react';
import { cssPlugin } from '@medesign/plugin-css';
import { tailwindPlugin } from '@medesign/plugin-tailwindcss';
import { shadcnPlugin } from '@medesign/plugin-shadcn';
import { corePlugin } from '@medesign/plugin-core';

/** Built-in plugins (each a separate @medesign/plugin-* package). External plugins
 *  (`@medesign/plugin-<id>` / `medesign-plugin-<id>`) can be added at startup via registerPlugin();
 *  resolvePlugin is the single lookup point. */
const REGISTRY = new Map<string, MedesignPlugin>([
  [reactPlugin.id, reactPlugin],
  [cssPlugin.id, cssPlugin],
  [tailwindPlugin.id, tailwindPlugin],
  [shadcnPlugin.id, shadcnPlugin],
  [corePlugin.id, corePlugin],
]);

export function registerPlugin(plugin: MedesignPlugin): void {
  REGISTRY.set(plugin.id, plugin);
}

export function resolvePlugin(id: string): MedesignPlugin | undefined {
  return REGISTRY.get(id);
}

export function availablePlugins(): Array<{ id: string; kind: string; implemented: boolean }> {
  return Array.from(REGISTRY.values()).map((p) => ({ id: p.id, kind: p.kind, implemented: !!p.codegenInstructions }));
}
