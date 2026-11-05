import React from 'react';
import {StyleSheet, View} from 'react-native';
import {DocumentTypeBadge} from '@entities/document';
import {ClassificationResult} from '@shared/lib/classification/documentClassifier';
import {theme} from '@shared/config/theme';
import {AppIcon} from '@shared/ui/icon/AppIcon';
import {Row} from '@shared/ui/layout/Row';
import {AppText} from '@shared/ui/typography/AppText';

export interface ClassificationSummaryChipProps {
  result: ClassificationResult | null;
}

export const ClassificationSummaryChip: React.FC<
  ClassificationSummaryChipProps
> = ({result}) => {
  if (!result) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Row justify="space-between">
        <Row gap="xs">
          <DocumentTypeBadge docType={result.docType} />
          <AppText variant="caption" color="textSecondary">
            {`${Math.round(result.confidence * 100)}% match`}
          </AppText>
        </Row>
        {result.detectedBarcodes.length > 0 ? (
          <Row gap="xxs">
            <AppIcon name="qrCode" size={14} color={theme.colors.accent} />
            <AppText variant="mono" color="accent" numberOfLines={1}>
              {result.detectedBarcodes[0]}
            </AppText>
          </Row>
        ) : null}
      </Row>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
});
