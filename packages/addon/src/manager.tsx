import React from 'react';
import { addons, types } from '@storybook/manager-api';
import { AddonPanel } from '@storybook/components';
import {
  ADDON_ID, PANEL_ID, CHARTERS_PANEL_ID, DS_TAB_ID, CREATE_TAB_ID, TOOL_ID,
  PROPERTIES_PANEL_ID, WAND_RESULTS_PANEL_ID, DIFF_PANEL_ID,
  VIEW_MODE_DS, VIEW_MODE_CREATE,
} from './constants';
import { SystemTab } from './SystemTab';
import { DesignSystemTab } from './DesignSystemTab';
import { CreateWizard } from './CreateWizard';
import { Tool } from './Tool';
import { ChartersTab } from './charters/ChartersTab';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { WandResultsPanel } from './panels/WandResultsPanel';
import { DiffPanel } from './panels/DiffPanel';

/**
 * emdesign manager UI:
 *  - TOOL   (toolbar)      → tools + ChatModeController (sidebar header toggle + chat panel)
 *  - PANEL  (bottom drawer)→ Emdesign — system/status/logs dashboard (includes Services)
 *  - PANEL  (bottom drawer)→ Charters — component/story charter validation results
 *  - TAB    System         → browse + edit design systems
 *  - TAB    + Create       → the creation wizard
 * Each TAB owns a viewMode + route so it is a top-level surface with its own URL.
 */
const tabRoute = (vm: string) => ({ storyId, refId }: { storyId?: string; refId?: string }) =>
  refId ? `/${vm}/${refId}_${storyId ?? ''}` : `/${vm}/${storyId ?? ''}`;

addons.register(ADDON_ID, () => {
  addons.add(TOOL_ID, {
    type: types.TOOL,
    title: 'emdesign tools',
    match: ({ viewMode }) => viewMode === 'story',
    render: () => <Tool />,
  });

  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'Emdesign',
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => (
      <AddonPanel active={!!active}>
        <SystemTab />
      </AddonPanel>
    ),
  });

  addons.add(DS_TAB_ID, {
    type: types.TAB,
    title: 'System',
    route: tabRoute(VIEW_MODE_DS),
    match: ({ viewMode }) => viewMode === VIEW_MODE_DS,
    render: ({ active }) => (active ? <DesignSystemTab /> : null),
  });

  addons.add(CHARTERS_PANEL_ID, {
    type: types.PANEL,
    title: 'Charters',
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => (
      <AddonPanel active={!!active}>
        <ChartersTab />
      </AddonPanel>
    ),
  });

  addons.add(CREATE_TAB_ID, {
    type: types.TAB,
    title: '+ Create',
    route: tabRoute(VIEW_MODE_CREATE),
    match: ({ viewMode }) => viewMode === VIEW_MODE_CREATE,
    render: ({ active }) => (active ? <CreateWizard /> : null),
  });

  // ── Phase 1: Interactive Design Surface panels ──────────────────────

  addons.add(PROPERTIES_PANEL_ID, {
    type: types.PANEL,
    title: 'Properties',
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => (
      <AddonPanel active={!!active}>
        <PropertiesPanel active={!!active} />
      </AddonPanel>
    ),
  });

  addons.add(WAND_RESULTS_PANEL_ID, {
    type: types.PANEL,
    title: 'Wand Results',
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => (
      <AddonPanel active={!!active}>
        <WandResultsPanel active={!!active} />
      </AddonPanel>
    ),
  });

  addons.add(DIFF_PANEL_ID, {
    type: types.PANEL,
    title: 'Diff',
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => (
      <AddonPanel active={!!active}>
        <DiffPanel active={!!active} />
      </AddonPanel>
    ),
  });

  // Chat is managed by ChatModeController (in Tool.tsx, which is always mounted in story view).
  // It portals the toggle into the sidebar header and the chat panel into the sidebar container.
});
