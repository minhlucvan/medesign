/**
 * Storybook preset entry for @medesign/addon.
 * - managerEntries → the panel (manager UI); the manager builder resolves bare specifiers.
 * - previewAnnotations → the in-iframe overlay (point-to-element commenting). The Vite preview
 *   builder needs an ABSOLUTE path here (a bare specifier gets mangled to a root URL → 404), so we
 *   resolve it via createRequire.
 * Referenced from a project's .storybook/main.ts via the addon name "@medesign/addon".
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function managerEntries(entry = []) {
  return [...entry, '@medesign/addon/manager'];
}

export function previewAnnotations(entry = []) {
  return [...entry, require.resolve('@medesign/addon/preview')];
}
