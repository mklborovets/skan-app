import React from 'react';
import {theme} from '@shared/config/theme';
import {IconName, iconRegistry} from './iconRegistry';

export interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  size = 20,
  color = theme.colors.textPrimary,
  strokeWidth = 2,
}) => {
  const IconComponent = iconRegistry[name];
  return (
    <IconComponent size={size} color={color} strokeWidth={strokeWidth} />
  );
};

