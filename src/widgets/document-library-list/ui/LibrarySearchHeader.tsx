import React from 'react';
import {StyleSheet, View} from 'react-native';
import {SearchInputBar} from '@features/search-by-ocr';
import {theme} from '@shared/config/theme';
import {PrimaryButton} from '@shared/ui/button/PrimaryButton';
import {Row} from '@shared/ui/layout/Row';
import {AppText} from '@shared/ui/typography/AppText';

export interface LibrarySearchHeaderProps {
  totalCount: number;
  query: string;
  onChangeQuery: (text: string) => void;
  onClearQuery: () => void;
  onStartScanPress: () => void;
}

export const LibrarySearchHeader: React.FC<LibrarySearchHeaderProps> = ({
  totalCount,
  query,
  onChangeQuery,
  onClearQuery,
  onStartScanPress,
}) => {
  return (
    <View style={styles.header}>
      <Row justify="space-between">
        <View>
          <AppText variant="h1">SKAN</AppText>
          <AppText variant="caption" color="textSecondary">
            {`${totalCount} on-device documents`}
          </AppText>
        </View>
        <PrimaryButton
          label="New Scan"
          icon="camera"
          onPress={onStartScanPress}
        />
      </Row>

      <SearchInputBar
        value={query}
        onChangeText={onChangeQuery}
        onClear={onClearQuery}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
});

