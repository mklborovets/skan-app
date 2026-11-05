import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {theme} from '@shared/config/theme';
import {AppText} from '@shared/ui/typography/AppText';

export interface ProcessingOverlayProps {
  visible: boolean;
  label: string;
  progressText?: string;
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({
  visible,
  label,
  progressText,
}) => {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <AppText variant="bodyStrong" align="center">
          {label}
        </AppText>
        {progressText ? (
          <AppText variant="caption" color="textSecondary" align="center">
            {progressText}
          </AppText>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.surfaceOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    minWidth: 220,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
});

