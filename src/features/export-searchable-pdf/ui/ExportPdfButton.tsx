import React from 'react';
import {StyleSheet, View} from 'react-native';
import {PrimaryButton} from '@shared/ui/button/PrimaryButton';
import {ProcessingOverlay} from '@shared/ui/loader/ProcessingOverlay';

export interface ExportPdfButtonProps {
  disabled?: boolean;
  isExporting: boolean;
  progressText?: string;
  pageCount: number;
  onPress: () => void;
}

export const ExportPdfButton: React.FC<ExportPdfButtonProps> = ({
  disabled = false,
  isExporting,
  progressText,
  pageCount,
  onPress,
}) => {
  return (
    <View style={styles.wrapper}>
      <PrimaryButton
        label={`Save Searchable PDF (${pageCount} p.)`}
        icon="fileCheck"
        disabled={disabled || pageCount === 0}
        loading={isExporting}
        onPress={onPress}
      />
      <ProcessingOverlay
        visible={isExporting}
        label="Generating Searchable PDF"
        progressText={progressText}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
});

