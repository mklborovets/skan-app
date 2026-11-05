import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Camera} from 'react-native-vision-camera';
import {StabilityProgressRing} from '@features/auto-capture-trigger';
import {QuadOverlaySvg} from '@features/detect-document-edges';
import {theme} from '@shared/config/theme';
import {PrimaryButton} from '@shared/ui/button/PrimaryButton';
import {ProcessingOverlay} from '@shared/ui/loader/ProcessingOverlay';
import {AppText} from '@shared/ui/typography/AppText';
import {LiveScannerControllerState} from '../model/useLiveScannerController';
import {ScannerControlsBar} from './ScannerControlsBar';

export interface LiveScannerViewportProps {
  controller: LiveScannerControllerState;
}

export const LiveScannerViewport: React.FC<LiveScannerViewportProps> = ({
  controller,
}) => {
  if (!controller.hasPermission) {
    return (
      <View style={styles.permissionBox}>
        <AppText variant="h2" align="center">
          Camera Access Required
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          SKAN processes all document edges on-device at 30 FPS without cloud
          services.
        </AppText>
        <PrimaryButton
          label="Grant Camera Permission"
          icon="camera"
          onPress={() => {
            void controller.ensurePermission();
          }}
        />
        <PrimaryButton
          label="Open System Settings"
          variant="secondary"
          onPress={() => {
            void controller.openSettings();
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.viewport} onLayout={controller.onViewportLayout}>
      {controller.device ? (
        <Camera
          ref={controller.cameraRef}
          style={StyleSheet.absoluteFill}
          device={controller.device}
          isActive={!controller.isCapturing}
          photo
          pixelFormat="yuv"
          torch={controller.torchOn ? 'on' : 'off'}
          frameProcessor={controller.frameProcessor}
        />
      ) : (
        <View style={styles.simulatedFeed}>
          <AppText variant="caption" color="textSecondary">
            Camera Simulator Mode (Ready to Capture)
          </AppText>
        </View>
      )}

      <QuadOverlaySvg
        quad={controller.smoothedQuad}
        width={controller.viewportSize.width}
        height={controller.viewportSize.height}
        isStable={controller.isStable}
      />

      <View style={styles.stabilityWrapper}>
        <StabilityProgressRing
          detected={controller.smoothedQuad !== null}
          progress={controller.stabilityProgress}
          autoCaptureEnabled={controller.autoCaptureEnabled}
        />
      </View>

      <ScannerControlsBar
        pageCount={controller.pageCount}
        lastThumbnailUri={controller.lastThumbnailUri}
        autoCaptureEnabled={controller.autoCaptureEnabled}
        torchOn={controller.torchOn}
        isCapturing={controller.isCapturing}
        onCapturePress={() => {
          void controller.onCapturePress();
        }}
        onToggleAutoCapture={controller.onToggleAutoCapture}
        onToggleTorch={controller.onToggleTorch}
        onReviewPress={controller.onReviewPress}
        onClosePress={controller.onClosePress}
      />

      <ProcessingOverlay
        visible={controller.isCapturing}
        label="Detecting & Warping Document..."
      />
    </View>
  );
};

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  simulatedFeed: {
    flex: 1,
    backgroundColor: '#0E1726',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stabilityWrapper: {
    position: 'absolute',
    top: 76,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  permissionBox: {
    flex: 1,
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
});
