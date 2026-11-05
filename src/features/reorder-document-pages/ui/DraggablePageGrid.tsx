import React from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {PageThumbnail, ScannedPage} from '@entities/scanned-page';
import {theme} from '@shared/config/theme';
import {AppIcon} from '@shared/ui/icon/AppIcon';
import {Row} from '@shared/ui/layout/Row';
import {AppText} from '@shared/ui/typography/AppText';

export interface DraggablePageGridProps {
  pages: ScannedPage[];
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  onMoveLeft: (index: number) => void;
  onMoveRight: (index: number) => void;
  onRemovePage: (pageId: string) => void;
  onAddPagePress: () => void;
}

export const DraggablePageGrid: React.FC<DraggablePageGridProps> = ({
  pages,
  activePageId,
  onSelectPage,
  onMoveLeft,
  onMoveRight,
  onRemovePage,
  onAddPagePress,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}>
      {pages.map((page, index) => (
        <View key={page.id} style={styles.itemColumn}>
          <PageThumbnail
            page={page}
            selected={page.id === activePageId}
            onPress={onSelectPage}
            onRemove={onRemovePage}
          />
          <Row justify="space-between" style={styles.reorderBar}>
            <Pressable
              disabled={index === 0}
              onPress={() => onMoveLeft(index)}
              style={[styles.moveBtn, index === 0 && styles.moveBtnDisabled]}>
              <AppText variant="caption" color="textSecondary">
                {'<'}
              </AppText>
            </Pressable>
            <AppIcon
              name="gripVertical"
              size={12}
              color={theme.colors.textMuted}
            />
            <Pressable
              disabled={index === pages.length - 1}
              onPress={() => onMoveRight(index)}
              style={[
                styles.moveBtn,
                index === pages.length - 1 && styles.moveBtnDisabled,
              ]}>
              <AppText variant="caption" color="textSecondary">
                {'>'}
              </AppText>
            </Pressable>
          </Row>
        </View>
      ))}

      <Pressable onPress={onAddPagePress} style={styles.addCard}>
        <AppIcon name="plus" size={24} color={theme.colors.primary} />
        <AppText variant="caption" color="primary">
          Add Page
        </AppText>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    alignItems: 'flex-start',
  },
  itemColumn: {
    alignItems: 'center',
    gap: 4,
  },
  reorderBar: {
    width: 82,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xs,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  moveBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  moveBtnDisabled: {
    opacity: 0.3,
  },
  addCard: {
    width: 82,
    height: 112,
    borderRadius: theme.radii.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});

