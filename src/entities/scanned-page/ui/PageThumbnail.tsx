import React from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import {theme} from '@shared/config/theme';
import {AppIcon} from '@shared/ui/icon/AppIcon';
import {AppText} from '@shared/ui/typography/AppText';
import {ScannedPage} from '../model/types';

export interface PageThumbnailProps {
  page: ScannedPage;
  selected?: boolean;
  onPress: (pageId: string) => void;
  onRemove?: (pageId: string) => void;
}

export const PageThumbnail: React.FC<PageThumbnailProps> = ({
  page,
  selected = false,
  onPress,
  onRemove,
}) => {
  return (
    <Pressable
      onPress={() => onPress(page.id)}
      style={[styles.card, selected && styles.selected]}>
      <Image
        source={{uri: page.processedUri}}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.badge}>
        <AppText variant="mono">{page.pageIndex + 1}</AppText>
      </View>
      {onRemove ? (
        <Pressable
          onPress={() => onRemove(page.id)}
          hitSlop={8}
          style={styles.deleteButton}>
          <AppIcon name="trash" size={14} color={theme.colors.textPrimary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 82,
    height: 112,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 2,
    borderColor: theme.colors.borderSubtle,
    overflow: 'hidden',
  },
  selected: {
    borderColor: theme.colors.primary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radii.xs,
    backgroundColor: theme.colors.surfaceOverlay,
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

