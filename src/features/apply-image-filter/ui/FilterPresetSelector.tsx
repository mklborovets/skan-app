import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {FilterPresetId} from '@shared/api/native-modules';
import {theme} from '@shared/config/theme';
import {AppIcon} from '@shared/ui/icon/AppIcon';
import {AppText} from '@shared/ui/typography/AppText';
import {FILTER_PRESET_OPTIONS} from '../model/useImageFilterProcessor';

export interface FilterPresetSelectorProps {
  activePreset: FilterPresetId;
  disabled?: boolean;
  onSelectPreset: (preset: FilterPresetId) => void;
}

export const FilterPresetSelector: React.FC<FilterPresetSelectorProps> = ({
  activePreset,
  disabled = false,
  onSelectPreset,
}) => {
  return (
    <View style={styles.bar}>
      {FILTER_PRESET_OPTIONS.map(option => {
        const selected = option.id === activePreset;
        return (
          <Pressable
            key={option.id}
            disabled={disabled}
            onPress={() => onSelectPreset(option.id)}
            style={[styles.chip, selected && styles.chipSelected]}>
            <AppIcon
              name={option.icon}
              size={16}
              color={
                selected ? theme.colors.primary : theme.colors.textSecondary
              }
            />
            <AppText
              variant="caption"
              color={selected ? 'primary' : 'textSecondary'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  chipSelected: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
  },
});

