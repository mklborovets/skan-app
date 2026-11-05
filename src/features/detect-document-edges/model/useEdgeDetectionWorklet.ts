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

      const rawWidth = raw.frameWidth ?? frame.width;
      const rawHeight = raw.frameHeight ?? frame.height;
      const detected = Boolean(raw.detected);
      const orientation = frame.orientation;
      const isLandscapeBuffer =
        rawWidth > rawHeight &&
        (orientation === 'landscape-right' || orientation === 'landscape-left');

      const tl = {x: raw.tlX ?? 0, y: raw.tlY ?? 0};
      const tr = {x: raw.trX ?? rawWidth, y: raw.trY ?? 0};
      const br = {x: raw.brX ?? rawWidth, y: raw.brY ?? rawHeight};
      const bl = {x: raw.blX ?? 0, y: raw.blY ?? rawHeight};

      const quad = !isLandscapeBuffer
        ? {topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl}
        : orientation === 'landscape-right'
          ? {
              topLeft: {x: rawHeight - bl.y, y: bl.x},
              topRight: {x: rawHeight - tl.y, y: tl.x},
              bottomRight: {x: rawHeight - tr.y, y: tr.x},
              bottomLeft: {x: rawHeight - br.y, y: br.x},
            }
          : {
              topLeft: {x: tr.y, y: rawWidth - tr.x},
              topRight: {x: br.y, y: rawWidth - br.x},
              bottomRight: {x: bl.y, y: rawWidth - bl.x},
              bottomLeft: {x: tl.y, y: rawWidth - tl.x},
            };

      const detectionFrame: QuadDetectionFrame = {
        detected,
        confidence: raw.confidence ?? 0,
        areaRatio: raw.areaRatio ?? 0,
        sourceSize: isLandscapeBuffer
          ? {width: rawHeight, height: rawWidth}
          : {width: rawWidth, height: rawHeight},
        quad,
      };

      notifyDetectionOnJs(detectionFrame);
    },
    [enabled, plugin, notifyDetectionOnJs],
  );
};

