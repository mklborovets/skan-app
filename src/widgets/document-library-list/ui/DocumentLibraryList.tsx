import React from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {DocumentCard, ScannedDocument} from '@entities/document';
import {theme} from '@shared/config/theme';
import {PrimaryButton} from '@shared/ui/button/PrimaryButton';
import {AppIcon} from '@shared/ui/icon/AppIcon';
import {AppText} from '@shared/ui/typography/AppText';
import {DocumentLibraryControllerState} from '../model/useDocumentLibraryController';
import {LibrarySearchHeader} from './LibrarySearchHeader';

export interface DocumentLibraryListProps {
  controller: DocumentLibraryControllerState;
}

export const DocumentLibraryList: React.FC<DocumentLibraryListProps> = ({
  controller,
}) => {
  const renderItem = ({item}: {item: ScannedDocument}) => (
    <DocumentCard
      document={item}
      formattedDate={controller.formatTimestamp(item.updatedAt)}
      onPress={doc => {
        void controller.onSelectDocument(doc);
      }}
      onShare={doc => {
        void controller.onShareDocument(doc);
      }}
      onDelete={docId => {
        void controller.onDeleteDocument(docId);
      }}
    />
  );

  return (
    <View style={styles.container}>
      <LibrarySearchHeader
        totalCount={controller.documents.length}
        query={controller.search.query}
        onChangeQuery={controller.search.onChangeQuery}
        onClearQuery={controller.search.onClearQuery}
        onStartScanPress={controller.onStartScanPress}
      />

      <FlatList
        data={controller.documents}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <AppIcon
              name="fileStack"
              size={42}
              color={theme.colors.textMuted}
            />
            <AppText variant="h3" align="center">
              {controller.search.query
                ? 'No matching OCR text found'
                : 'Your On-Device Library is Empty'}
            </AppText>
            <AppText variant="body" color="textSecondary" align="center">
              {controller.search.query
                ? 'Try a different keyword from your scanned pages.'
                : 'Capture multi-page documents with real-time OpenCV edge detection and searchable PDF export.'}
            </AppText>
            {!controller.search.query ? (
              <PrimaryButton
                label="Start First Scan"
                icon="scan"
                onPress={controller.onStartScanPress}
              />
            ) : null}
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  listContent: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xxl,
  },
  emptyBox: {
    marginTop: theme.spacing.xxl,
    padding: theme.spacing.xl,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
});

