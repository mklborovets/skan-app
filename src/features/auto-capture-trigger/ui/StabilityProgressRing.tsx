import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import {theme} from '@shared/config/theme';
import {Row} from '@shared/ui/layout/Row';
import {AppText} from '@shared/ui/typography/AppText';

export interface StabilityProgressRingProps {
  detected: boolean;
  progress: number;
  autoCaptureEnabled: boolean;
}

export const StabilityProgressRing: React.FC<StabilityProgressRingProps> = ({
  detected,
  progress,
  autoCaptureEnabled,
}) => {
  const size = 28;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const strokeDashoffset = circumference * (1 - clamped);

  const statusText = !detected
    ? 'Align document inside frame'
    : !autoCaptureEnabled
      ? 'Document detected • Manual capture'
      : clamped >= 0.85
        ? 'Capturing...'
        : 'Hold steady for auto-capture';

  return (
    <View style={styles.pill}>
      <Row gap="xs">
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme.colors.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={
              clamped >= 0.55 ? theme.colors.accent : theme.colors.primary
            }
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
        <AppText variant="caption" color="textPrimary">
          {statusText}
        </AppText>
      </Row>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    backgroundColor: theme.colors.surfaceOverlay,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: 'center',
  },
});

