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
        <Row gap="xs" wrap>
          <DocumentTypeBadge docType={document.docType} />
          <AppText variant="caption" color="textSecondary">
            {`${document.pageCount} p. • ${formattedDate}`}
          </AppText>
        </Row>
        {document.matchedSnippet ? (
          <AppText
            variant="caption"
            color="accent"
            numberOfLines={2}
            style={styles.snippet}>
            {document.matchedSnippet}
          </AppText>
        ) : null}
      </View>

      <Row gap="xs">
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
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  infoColumn: {
    flex: 1,
    gap: 6,
  },
  snippet: {
    marginTop: 2,
  },
});

