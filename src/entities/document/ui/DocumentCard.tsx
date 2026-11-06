import React from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import {theme} from '@shared/config/theme';
import {IconButton} from '@shared/ui/button/IconButton';
import {AppIcon} from '@shared/ui/icon/AppIcon';
import {Row} from '@shared/ui/layout/Row';
import {AppText} from '@shared/ui/typography/AppText';
import {ScannedDocument} from '../model/types';
import {DocumentTypeBadge} from './DocumentTypeBadge';

export interface DocumentCardProps {
  document: ScannedDocument;
  formattedDate: string;
  onPress: (document: ScannedDocument) => void;
  onShare?: (document: ScannedDocument) => void;
  onDelete?: (documentId: string) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  formattedDate,
  onPress,
  onShare,
  onDelete,
}) => {
  return (
    <Pressable
      onPress={() => onPress(document)}
      style={({pressed}) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.thumbnailBox}>
        {document.coverUri ? (
          <Image
            source={{uri: document.coverUri}}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <AppIcon name="fileText" size={26} color={theme.colors.textMuted} />
        )}
      </View>

      <View style={styles.infoColumn}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {document.title}
        </AppText>
        <Row gap="xs" align="center" style={styles.metaRow}>
          <DocumentTypeBadge docType={document.docType} />
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {`${document.pageCount} p. • ${formattedDate}`}
          </AppText>
        </Row>
        {document.matchedSnippet ? (
          <View style={styles.snippetContainer}>
            <AppIcon name="search" size={12} color={theme.colors.accent} />
            <AppText
              variant="caption"
              color="accent"
              numberOfLines={1}
              style={styles.snippet}>
              {document.matchedSnippet}
            </AppText>
          </View>
        ) : null}
      </View>

      <Row gap="xs" style={styles.actionButtons}>
        {onShare ? (
          <IconButton
            icon="share"
            size={36}
            iconSize={16}
            onPress={() => onShare(document)}
          />
        ) : null}
        {onDelete ? (
          <IconButton
            icon="trash"
            size={36}
            iconSize={16}
            color={theme.colors.danger}
            onPress={() => onDelete(document.id)}
          />
        ) : null}
      </Row>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
    minHeight: 98,
  },
  pressed: {
    opacity: 0.85,
  },
  thumbnailBox: {
    width: 56,
    height: 74,
    borderRadius: theme.radii.xs,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  infoColumn: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
  },
  metaRow: {
    flexWrap: 'nowrap',
  },
  snippetContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: theme.radii.xs,
    marginTop: 2,
  },
  snippet: {
    flex: 1,
    lineHeight: 15,
  },
  actionButtons: {
    alignSelf: 'center',
  },
});

