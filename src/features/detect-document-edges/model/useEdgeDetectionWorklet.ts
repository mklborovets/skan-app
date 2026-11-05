import {useMemo} from 'react';
import {
  Frame,
  ReadonlyFrameProcessor,
  useFrameProcessor,
  VisionCameraProxy,
} from 'react-native-vision-camera';
import {useRunOnJS} from 'react-native-worklets-core';
import {QuadDetectionFrame} from '@entities/scan-quad';

interface NativeEdgePluginPayload {
  skipped?: boolean;
  detected?: boolean;
  tlX?: number;
  tlY?: number;
  trX?: number;
  trY?: number;
  brX?: number;
  brY?: number;
  blX?: number;
  blY?: number;
  confidence?: number;
  areaRatio?: number;
  frameWidth?: number;
  frameHeight?: number;
}

export interface UseEdgeDetectionWorkletParams {
  enabled: boolean;
  onQuadDetected: (detection: QuadDetectionFrame) => void;
}

export const useEdgeDetectionWorklet = ({
  enabled,
  onQuadDetected,
}: UseEdgeDetectionWorkletParams): ReadonlyFrameProcessor => {
  const plugin = useMemo(
    () => VisionCameraProxy.initFrameProcessorPlugin('detectDocumentEdges', {}),
    [],
  );

  const notifyDetectionOnJs = useRunOnJS(
    (payload: QuadDetectionFrame) => {
      onQuadDetected(payload);
    },
    [onQuadDetected],
  );

  return useFrameProcessor(
    (frame: Frame) => {
      'worklet';
      if (!enabled || !plugin) {
        return;
      }

      const raw = plugin.call(frame) as unknown as
        | NativeEdgePluginPayload
        | undefined;
      if (!raw || raw.skipped) {
        return;
      }

      const frameWidth = raw.frameWidth ?? frame.width;
      const frameHeight = raw.frameHeight ?? frame.height;
      const detected = Boolean(raw.detected);

      const detectionFrame: QuadDetectionFrame = {
        detected,
        confidence: raw.confidence ?? 0,
        areaRatio: raw.areaRatio ?? 0,
        sourceSize: {
          width: frameWidth,
          height: frameHeight,
        },
        quad: {
          topLeft: {x: raw.tlX ?? 0, y: raw.tlY ?? 0},
          topRight: {x: raw.trX ?? frameWidth, y: raw.trY ?? 0},
          bottomRight: {x: raw.brX ?? frameWidth, y: raw.brY ?? frameHeight},
          bottomLeft: {x: raw.blX ?? 0, y: raw.blY ?? frameHeight},
        },
      };

      notifyDetectionOnJs(detectionFrame);
    },
    [enabled, plugin, notifyDetectionOnJs],
  );
};
