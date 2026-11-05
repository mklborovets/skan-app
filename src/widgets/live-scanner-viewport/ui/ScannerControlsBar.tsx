import React from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import {theme} from '@shared/config/theme';
import {IconButton} from '@shared/ui/button/IconButton';
import {AppIcon} from '@shared/ui/icon/AppIcon';
import {Row} from '@shared/ui/layout/Row';
import {AppText} from '@shared/ui/typography/AppText';

export interface ScannerControlsBarProps {
  pageCount: number;
  lastThumbnailUri: string | null;
  autoCaptureEnabled: boolean;
  torchOn: boolean;
  isCapturing: boolean;
  onCapturePress: () => void;
  onToggleAutoCapture: () => void;
  onToggleTorch: () => void;
  onReviewPress: () => void;
  onClosePress: () => void;
}

export const ScannerControlsBar: React.FC<ScannerControlsBarProps> = ({
  pageCount,
  lastThumbnailUri,
  autoCaptureEnabled,
  torchOn,
  isCapturing,
  onCapturePress,
  onToggleAutoCapture,
  onToggleTorch,
  onReviewPress,
  onClosePress,
}) => {
  return (
    <View style={styles.container}>
      <Row justify="space-between" style={styles.topRow}>
        <IconButton icon="close" onPress={onClosePress} />
        <Pressable
          onPress={onToggleAutoCapture}
          style={[
            styles.modeChip,
            autoCaptureEnabled && styles.modeChipActive,
          ]}>
          <AppIcon
            name="sparkles"
            size={16}
            color={
              autoCaptureEnabled
                ? theme.colors.accent
                : theme.colors.textSecondary
            }
          />
          <AppText
            variant="caption"
            color={autoCaptureEnabled ? 'accent' : 'textSecondary'}>
            {autoCaptureEnabled ? 'AUTO ON' : 'MANUAL'}
          </AppText>
        </Pressable>
        <IconButton
          icon={torchOn ? 'flashOn' : 'flashOff'}
          active={torchOn}
          onPress={onToggleTorch}
        />
      </Row>

      <Row justify="space-between" style={styles.bottomRow}>
        <View style={styles.sideSlot} />
        <Pressable
          onPress={onCapturePress}
          disabled={isCapturing}
          style={({pressed}) => [
            styles.shutterOuter,
            pressed && styles.shutterPressed,
          ]}>
          <View style={styles.shutterInner} />
        </Pressable>

        <View style={styles.sideSlot}>
          {pageCount > 0 ? (
            <Pressable onPress={onReviewPress} style={styles.pageCounterBtn}>
              {lastThumbnailUri ? (
                <Image
                  source={{uri: lastThumbnailUri}}
                  style={styles.thumb}
                  resizeMode="cover"
                />
              ) : null}
              <View style={styles.countBadge}>
                <AppText variant="mono">{pageCount}</AppText>
              </View>
            </Pressable>
          ) : null}
        </View>
      </Row>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  topRow: {
    width: '100%',
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceOverlay,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modeChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentMuted,
  },
  bottomRow: {
    width: '100%',
  },
  sideSlot: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: theme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  shutterPressed: {
    transform: [{scale: 0.94}],
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.textPrimary,
  },
  pageCounterBtn: {
    width: 54,
    height: 66,
    borderRadius: theme.radii.sm,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceElevated,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  countBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radii.xs,
    backgroundColor: theme.colors.primary,
  },
});

