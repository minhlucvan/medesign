import React from 'react';
import { addons, types } from '@storybook/manager-api';
import { AddonPanel } from '@storybook/components';
import {
  ADDON_ID, PANEL_ID, DS_TAB_ID, CREATE_TAB_ID, TOOL_ID,
  VIEW_MODE_DS, VIEW_MODE_CREATE,
} from './constants';
import { SystemTab } from './SystemTab';
import { DesignSystemTab } from './DesignSystemTab';
import { CreateWizard } from './CreateWizard';
import { Tool } from './Tool';

/**
 * medesign manager UI:
 *  - TOOL   (toolbar)      → comment · copy · pen tools (+ the canvas→intent bridge) · "+ Create" jump
 *  - PANEL  (bottom drawer)→ medesign — the system/status/logs dashboard (master/debug view)
 *  - TAB    System         → browse + edit design systems
 *  - TAB    + Create       → the creation wizard (component · story · view · design system)
 * Each TAB owns a viewMode + route so it is a top-level surface with its own URL.
 */
const tabRoute = (vm: string) => ({ storyId, refId }: { storyId?: string; refId?: string }) =>
  refId ? `/${vm}/${refId}_${storyId ?? ''}` : `/${vm}/${storyId ?? ''}`;

addons.register(ADDON_ID, () => {
  addons.add(TOOL_ID, {
    type: types.TOOL,
    title: 'medesign tools',
    match: ({ viewMode }) => viewMode === 'story',
    render: () => <Tool />,
  });

  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'Medesign',
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

  addons.add(CREATE_TAB_ID, {
    type: types.TAB,
    title: '+ Create',
    route: tabRoute(VIEW_MODE_CREATE),
    match: ({ viewMode }) => viewMode === VIEW_MODE_CREATE,
    render: ({ active }) => (active ? <CreateWizard /> : null),
  });
});
