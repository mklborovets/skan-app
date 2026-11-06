import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import Svg, {Polygon} from 'react-native-svg';
import {buildSvgPolygonPoints, CORNER_KEYS} from '@entities/scan-quad';
import {
  DraggableCornerPin,
  MagnifierLoupe,
} from '@features/adjust-crop-corners';
import {theme} from '@shared/config/theme';
import {IconButton} from '@shared/ui/button/IconButton';
import {PrimaryButton} from '@shared/ui/button/PrimaryButton';
import {Row} from '@shared/ui/layout/Row';
import {ProcessingOverlay} from '@shared/ui/loader/ProcessingOverlay';
import {AppText} from '@shared/ui/typography/AppText';
import {InteractiveCropControllerState} from '../model/useInteractiveCropController';

export interface InteractiveCropBoardProps {
  controller: InteractiveCropControllerState;
}

export const InteractiveCropBoard: React.FC<InteractiveCropBoardProps> = ({
  controller,
}) => {
  const {gestures, boardSize, rawUri} = controller;
  const polygonPoints = buildSvgPolygonPoints(gestures.quad);

  return (
    <View style={styles.container}>
      <Row justify="space-between" style={styles.header}>
        <IconButton icon="arrowLeft" onPress={controller.onCancel} />
        <AppText variant="h3">Adjust Perspective Corners</AppText>
        <IconButton
          icon="maximize"
          onPress={() => {
            controller.gestures.resetToFullBounds();
          }}
          accessibilityLabel="Expand corners"
        />
      </Row>

      <View style={styles.boardViewport} onLayout={controller.onBoardLayout}>
        <View
          style={[
            styles.board,
            {width: boardSize.width, height: boardSize.height},
          ]}>
          {rawUri ? (
            <Image
              source={{uri: rawUri}}
              style={styles.image}
              resizeMode="stretch"
            />
          ) : null}

          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width={boardSize.width} height={boardSize.height}>
              <Polygon
                points={polygonPoints}
                fill={theme.colors.quadFill}
                stroke={theme.colors.accent}
                strokeWidth={2.5}
              />
            </Svg>
          </View>

          {CORNER_KEYS.map(key => (
            <DraggableCornerPin
              key={key}
              point={gestures.quad[key]}
              active={gestures.activeCorner === key}
              panHandlers={gestures.getPanHandlersForCorner(key)}
            />
          ))}

          <MagnifierLoupe
            visible={gestures.activeCorner !== null}
            imageUri={rawUri}
            focalPoint={gestures.activePoint}
            boardSize={boardSize}
          />
        </View>
      </View>

      <Row justify="space-between" style={styles.footer}>
        <PrimaryButton
          label="Auto-Fit"
          icon="wand"
          variant="secondary"
          onPress={() => {
            void controller.onAutoDetectCorners();
          }}
          style={styles.buttonHalf}
        />
        <PrimaryButton
          label="Apply"
          icon="check"
          loading={controller.isProcessing}
          onPress={() => {
            void controller.onConfirmCrop();
          }}
          style={styles.buttonHalf}
        />
      </Row>

      <ProcessingOverlay
        visible={controller.isProcessing}
        label="Applying Perspective Warp..."
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  header: {
    width: '100%',
  },
  boardViewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  board: {
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  footer: {
    width: '100%',
  },
  buttonHalf: {
    flex: 1,
  },
});

