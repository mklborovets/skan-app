import React from 'react';
import {FlatList, Image, ScrollView, StyleSheet, View} from 'react-native';
import {DocumentTypeBadge} from '@entities/document';
import {ScannedPage} from '@entities/scanned-page';
import {theme} from '@shared/config/theme';
import {IconButton} from '@shared/ui/button/IconButton';
import {PrimaryButton} from '@shared/ui/button/PrimaryButton';
import {Row} from '@shared/ui/layout/Row';
import {SafeScreenContainer} from '@shared/ui/layout/SafeScreenContainer';
import {BottomSheetModal} from '@shared/ui/modal/BottomSheetModal';
import {AppText} from '@shared/ui/typography/AppText';
import {usePdfPreviewController} from '../model/usePdfPreviewController';

export interface PdfPreviewPageProps {
  documentId: string;
  onEditDocument: () => void;
  onBackToLibrary: () => void;
  extraActionsSlot?: React.ReactNode;
}

export const PdfPreviewPage: React.FC<PdfPreviewPageProps> = ({
  documentId,
  onEditDocument,
  onBackToLibrary,
  extraActionsSlot,
}) => {
  const controller = usePdfPreviewController({
    documentId,
    onEditDocument,
    onBackToLibrary,
  });

  const renderPageItem = ({item, index}: {item: ScannedPage; index: number}) => (
    <View style={styles.pageSheet}>
      <Row justify="space-between" style={styles.sheetHeader}>
        <AppText variant="caption" color="textSecondary">
          {`A4 Page ${index + 1} of ${controller.pages.length}`}
        </AppText>
        <AppText variant="mono" color="accent">
          300 DPI • Searchable OCR
        </AppText>
      </Row>
      <Image
        source={{uri: item.processedUri}}
        style={styles.sheetImage}
        resizeMode="contain"
      />
    </View>
  );

  return (
    <SafeScreenContainer padded>
      <Row justify="space-between" style={styles.header}>
        <IconButton icon="arrowLeft" onPress={controller.onBackToLibrary} />
        <View style={styles.titleBlock}>
          <AppText variant="h3" numberOfLines={1}>
            {controller.document?.title ?? 'PDF Preview'}
          </AppText>
          {controller.document ? (
            <DocumentTypeBadge docType={controller.document.docType} />
          ) : null}
        </View>
        <Row gap="xs">
          <IconButton
            icon="fileText"
            onPress={() => controller.setShowOcrModal(true)}
            accessibilityLabel="Inspect OCR layer"
          />
          <IconButton
            icon="sliders"
            onPress={controller.onEditDocument}
            accessibilityLabel="Edit pages"
          />
        </Row>
      </Row>

      <FlatList
        data={controller.pages}
        keyExtractor={item => item.id}
        renderItem={renderPageItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        {extraActionsSlot}
        <PrimaryButton
          label="Share / Export Searchable PDF"
          icon="share"
          onPress={() => {
            void controller.onSharePdf();
          }}
        />
      </View>

      <BottomSheetModal
        visible={controller.showOcrModal}
        title="Embedded OCR Text Layer"
        onClose={() => controller.setShowOcrModal(false)}>
        <ScrollView style={styles.ocrScroll}>
          <AppText variant="body" color="textSecondary">
            {controller.combinedOcrText}
          </AppText>
        </ScrollView>
      </BottomSheetModal>
    </SafeScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingVertical: theme.spacing.sm,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  listContent: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  pageSheet: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  sheetHeader: {
    width: '100%',
  },
  sheetImage: {
    width: '100%',
    height: 390,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radii.xs,
  },
  footer: {
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  ocrScroll: {
    maxHeight: 320,
  },
});
