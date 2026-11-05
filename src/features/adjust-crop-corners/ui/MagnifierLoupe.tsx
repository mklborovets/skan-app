import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {FrameDimensions} from '@entities/scan-quad';
import {SCAN_CONSTANTS} from '@shared/config/scanConstants';
import {theme} from '@shared/config/theme';
import {Point2D} from '@shared/lib/geometry/pointInterpolation';

export interface MagnifierLoupeProps {
  visible: boolean;
  imageUri: string;
  focalPoint: Point2D | null;
  boardSize: FrameDimensions;
}

export const MagnifierLoupe: React.FC<MagnifierLoupeProps> = ({
  visible,
  imageUri,
  focalPoint,
  boardSize,
}) => {
  if (
    !visible ||
    !focalPoint ||
    boardSize.width <= 0 ||
    boardSize.height <= 0
  ) {
    return null;
  }

  const diameter = SCAN_CONSTANTS.LOUPE_DIAMETER;
  const radius = diameter / 2;
  const zoom = SCAN_CONSTANTS.LOUPE_ZOOM_FACTOR;

  const loupeLeft = Math.max(
    12,
    Math.min(boardSize.width - diameter - 12, focalPoint.x - radius),
  );
  const loupeTop =
    focalPoint.y > diameter + 36
      ? focalPoint.y - diameter - 28
      : focalPoint.y + 28;

  const imageTranslateX = radius - focalPoint.x * zoom;
  const imageTranslateY = radius - focalPoint.y * zoom;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.loupeContainer,
        {
          width: diameter,
          height: diameter,
          borderRadius: radius,
          left: loupeLeft,
          top: loupeTop,
        },
      ]}>
      <Image
        source={{uri: imageUri}}
        style={{
          width: boardSize.width * zoom,
          height: boardSize.height * zoom,
          transform: [
            {translateX: imageTranslateX},
            {translateY: imageTranslateY},
          ],
        }}
        resizeMode="stretch"
      />
      <View style={styles.crosshairHorizontal} />
      <View style={styles.crosshairVertical} />
    </View>
  );
};

const styles = StyleSheet.create({
  loupeContainer: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surface,
    zIndex: 50,
  },
  crosshairHorizontal: {
    position: 'absolute',
    top: '50%',
    left: '25%',
    right: '25%',
    height: 1.5,
    backgroundColor: theme.colors.accent,
  },
  crosshairVertical: {
    position: 'absolute',
    left: '50%',
    top: '25%',
    bottom: '25%',
    width: 1.5,
    backgroundColor: theme.colors.accent,
  },
});
