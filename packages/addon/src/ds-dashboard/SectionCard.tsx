import React, { useState } from 'react';
import { styled } from '@storybook/theming';
import type { RefinementScope } from '../constants';
import { addons } from '@storybook/manager-api';
import { EVT_CHAT_MODE } from '../channel';

const CardWrapper = styled.div(({ theme }) => ({
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: theme.appBorderRadius,
  background: theme.background.content,
  marginBottom: 12,
}));

const Header = styled.div<{ clickable?: boolean }>(({ theme, clickable }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px',
  cursor: clickable ? 'pointer' : 'default',
  userSelect: 'none',
  borderBottom: 'none',
}));

const Title = styled.div(({ theme }) => ({
  flex: 1,
  font: `700 13px ${theme.typography.fonts.base}`,
  color: theme.color.defaultText,
}));

const ToggleIcon = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
  fontSize: 12,
  width: 16,
  textAlign: 'center',
}));

const Body = styled.div(({ theme }) => ({
  padding: '0 12px 12px',
  borderTop: `1px solid ${theme.appBorderColor}`,
  margin: '0 0 0 0',
}));

const ActionBar = styled.div(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '8px 12px',
  borderTop: `1px solid ${theme.appBorderColor}`,
}));

const AiButton = styled.button(({ theme }) => ({
  cursor: 'pointer',
  padding: '4px 10px',
  borderRadius: theme.appBorderRadius,
  border: `1px solid ${theme.color.secondary}`,
  background: theme.color.secondary,
  color: theme.color.lightest,
  font: `600 11px ${theme.typography.fonts.base}`,
}));

export interface SectionCardProps {
  title: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  scope: RefinementScope;
  children?: React.ReactNode;
  onAction?: (payload: { scope: RefinementScope; instruction?: string }) => void;
  refinementStatus?: 'idle' | 'refining' | 'queued' | 'success' | 'error';
  refinementError?: string;
}

export function SectionCard({
  title,
  collapsible = true,
  defaultCollapsed = true,
  scope,
  children,
  onAction,
  refinementStatus,
  refinementError,
}: SectionCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <CardWrapper>
      <Header clickable={collapsible} onClick={() => collapsible && setCollapsed(!collapsed)}>
        <Title>{title}</Title>
        {collapsible && <ToggleIcon>{collapsed ? '▼' : '▲'}</ToggleIcon>}
      </Header>
      {!collapsed && <Body>{children}</Body>}
      <ActionBar>
        <AiButton onClick={() => {
          addons.getChannel().emit(EVT_CHAT_MODE, { enabled: true, sessionId: undefined });
        }}>
          ✦ AI
        </AiButton>
      </ActionBar>
    </CardWrapper>
  );
}
