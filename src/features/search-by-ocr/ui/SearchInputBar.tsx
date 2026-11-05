import React from 'react';
import {Pressable, StyleSheet, TextInput, View} from 'react-native';
import {theme} from '@shared/config/theme';
import {AppIcon} from '@shared/ui/icon/AppIcon';

export interface SearchInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  placeholder?: string;
}

export const SearchInputBar: React.FC<SearchInputBarProps> = ({
  value,
  onChangeText,
  onClear,
  placeholder = 'Search inside scanned documents (OCR)...',
}) => {
  return (
    <View style={styles.bar}>
      <AppIcon name="search" size={18} color={theme.colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 ? (
        <Pressable onPress={onClear} hitSlop={8}>
          <AppIcon name="close" size={16} color={theme.colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: theme.spacing.sm,
    minHeight: 46,
  },
  input: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 15,
    paddingVertical: 8,
  },
});
