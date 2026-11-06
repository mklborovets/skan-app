import {useMemo} from 'react';
import {
  Frame,
  ReadonlyFrameProcessor,
  useFrameProcessor,
  VisionCameraProxy,
} from 'react-native-vision-camera';
import {useRunOnJS} from 'react-native-worklets-core';
import {QuadDetectionFrame, ScanQuad} from '@entities/scan-quad';
import {Point2D} from '@shared/lib/geometry/pointInterpolation';

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

const sortQuadWorklet = (pts: [Point2D, Point2D, Point2D, Point2D]): ScanQuad => {
  'worklet';
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) * 0.25;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) * 0.25;

  const ordered: [Point2D, Point2D, Point2D, Point2D] = [
    pts[0],
    pts[1],
    pts[2],
    pts[3],
  ];
  ordered.sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );

  const p0 = ordered[0];
  let p1 = ordered[1];
  const p2 = ordered[2];
  let p3 = ordered[3];

  const cross =
    (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
  if (cross < 0) {
    const tmp = p1;
    p1 = p3;
    p3 = tmp;
  }

  const candidates: [ScanQuad, ScanQuad, ScanQuad, ScanQuad] = [
    {topLeft: p0, topRight: p1, bottomRight: p2, bottomLeft: p3},
    {topLeft: p1, topRight: p2, bottomRight: p3, bottomLeft: p0},
    {topLeft: p2, topRight: p3, bottomRight: p0, bottomLeft: p1},
    {topLeft: p3, topRight: p0, bottomRight: p1, bottomLeft: p2},
  ];

  let bestQuad: ScanQuad = candidates[0];
  let bestScore = -1e9;
  for (const cand of candidates) {
    const topDx = cand.topRight.x - cand.topLeft.x;
    const topDy = cand.topRight.y - cand.topLeft.y;
    const topLen = Math.hypot(topDx, topDy) || 1;

    const rightDx = cand.bottomRight.x - cand.topRight.x;
    const rightDy = cand.bottomRight.y - cand.topRight.y;
    const rightLen = Math.hypot(rightDx, rightDy) || 1;

    const botDx = cand.bottomLeft.x - cand.bottomRight.x;
    const botDy = cand.bottomLeft.y - cand.bottomRight.y;
    const botLen = Math.hypot(botDx, botDy) || 1;

    const leftDx = cand.topLeft.x - cand.bottomLeft.x;
    const leftDy = cand.topLeft.y - cand.bottomLeft.y;
    const leftLen = Math.hypot(leftDx, leftDy) || 1;

    const score =
      topDx / topLen +
      rightDy / rightLen -
      botDx / botLen -
      leftDy / leftLen;
    if (score > bestScore) {
      bestScore = score;
      bestQuad = cand;
    }
  }

  return bestQuad;
};

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
          ? sortQuadWorklet([
              {x: rawHeight - tl.y, y: tl.x},
              {x: rawHeight - tr.y, y: tr.x},
              {x: rawHeight - br.y, y: br.x},
              {x: rawHeight - bl.y, y: bl.x},
            ])
          : sortQuadWorklet([
              {x: tl.y, y: rawWidth - tl.x},
              {x: tr.y, y: rawWidth - tr.x},
              {x: br.y, y: rawWidth - br.x},
              {x: bl.y, y: rawWidth - bl.x},
            ]);

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
