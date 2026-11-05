import React from 'react';
import {Pressable, StyleProp, StyleSheet, ViewStyle} from 'react-native';
import {theme} from '@shared/config/theme';
import {AppIcon} from '@shared/ui/icon/AppIcon';
import {IconName} from '@shared/ui/icon/iconRegistry';

export interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  size?: number;
  iconSize?: number;
  color?: string;
  active?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  size = 42,
  iconSize = 20,
  color = theme.colors.textPrimary,
  active = false,
  disabled = false,
  accessibilityLabel,
  style,
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? icon}
      style={({pressed}) => [
        styles.button,
        {width: size, height: size, borderRadius: size / 2},
        active && styles.active,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <AppIcon
        name={icon}
        size={iconSize}
        color={active ? theme.colors.primary : color}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.4,
  },
});

