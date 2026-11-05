import React from 'react';
import {StyleSheet, View} from 'react-native';
import {theme} from '@shared/config/theme';
import {AppText} from '@shared/ui/typography/AppText';
import {DocumentType} from '../model/types';

export interface DocumentTypeBadgeProps {
  docType: DocumentType;
}

const LABELS: Record<DocumentType, string> = {
  standard: 'A4 Doc',
  passport: 'Passport',
  receipt: 'Receipt',
  business_card: 'Business Card',
  id_card: 'ID Card',
};

export const DocumentTypeBadge: React.FC<DocumentTypeBadgeProps> = ({
  docType,
}) => {
  return (
    <View style={styles.badge}>
      <AppText variant="caption" color="primary">
        {LABELS[docType]}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radii.xs,
    backgroundColor: theme.colors.primaryMuted,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
});
