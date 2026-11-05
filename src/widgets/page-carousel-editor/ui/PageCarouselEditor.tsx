import React from 'react';
import {Image, StyleSheet, TextInput, View} from 'react-native';
import {FilterPresetSelector} from '@features/apply-image-filter';
import {ClassificationSummaryChip} from '@features/classify-document-type';
import {DraggablePageGrid} from '@features/reorder-document-pages';
import {theme} from '@shared/config/theme';
import {IconButton} from '@shared/ui/button/IconButton';
import {Row} from '@shared/ui/layout/Row';
import {ProcessingOverlay} from '@shared/ui/loader/ProcessingOverlay';
import {AppText} from '@shared/ui/typography/AppText';
import {PageCarouselControllerState} from '../model/usePageCarouselController';

export interface PageCarouselEditorProps {
  controller: PageCarouselControllerState;
  footerActionSlot?: React.ReactNode;
}

export const PageCarouselEditor: React.FC<PageCarouselEditorProps> = ({
  controller,
  footerActionSlot,
}) => {
  const {activePage, pages} = controller;

  return (
    <View style={styles.container}>
      <Row justify="space-between" style={styles.header}>
        <IconButton icon="arrowLeft" onPress={controller.onBack} />
        <TextInput
          value={controller.documentTitle}
          onChangeText={controller.setDocumentTitle}
          placeholder="Document title"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.titleInput}
        />
        <IconButton
          icon="crop"
          disabled={!activePage}
          onPress={controller.onEditCropPress}
          accessibilityLabel="Adjust corners"
        />
      </Row>

      <View style={styles.previewCard}>
        {activePage ? (
          <Image
            source={{uri: activePage.processedUri}}
            style={styles.previewImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.emptyPreview}>
            <AppText variant="body" color="textSecondary">
              No pages in current scan session
            </AppText>
          </View>
        )}
      </View>

      <ClassificationSummaryChip result={controller.classification} />

      {activePage ? (
        <FilterPresetSelector
          activePreset={activePage.filterPreset}
          disabled={controller.isApplyingFilter}
          onSelectPreset={controller.onSelectPreset}
        />
      ) : null}

      <DraggablePageGrid
        pages={pages}
        activePageId={activePage?.id ?? null}
        onSelectPage={controller.onSelectPage}
        onMoveLeft={controller.onMoveLeft}
        onMoveRight={controller.onMoveRight}
        onRemovePage={controller.onRemovePage}
        onAddPagePress={controller.onAddPagePress}
      />

      {footerActionSlot ? (
        <View style={styles.footerSlot}>{footerActionSlot}</View>
      ) : null}

      <ProcessingOverlay
        visible={controller.isApplyingFilter}
        label="Applying OpenCV Filter..."
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  header: {
    width: '100%',
  },
  titleInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  previewCard: {
    flex: 1,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  emptyPreview: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  footerSlot: {
    width: '100%',
  },
});

