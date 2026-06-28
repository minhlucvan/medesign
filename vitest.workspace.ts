import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Existing package tests
  'packages/backend',
  'packages/graph',
  'packages/dsr',
  'packages/vision-critic',
  // Addon (Storybook panel, toolbar tools, channel events)
  'packages/addon',
  // Integration & surface tests
  'tests',
]);
