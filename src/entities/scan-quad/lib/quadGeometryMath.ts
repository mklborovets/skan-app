import {
  clampPointToBounds,
  distanceBetweenPoints,
  emaSmoothPoint,
  Point2D,
} from '@shared/lib/geometry/pointInterpolation';
import {CornerKey, FrameDimensions, ScanQuad} from '../model/types';

export const CORNER_KEYS: readonly CornerKey[] = [
  'topLeft',
  'topRight',
  'bottomRight',
  'bottomLeft',
] as const;

export const createDefaultScanQuad = (
  size: FrameDimensions,
  marginRatio = 0.08,
): ScanQuad => {
  const padX = Math.round(size.width * marginRatio);
  const padY = Math.round(size.height * marginRatio);
  return {
    topLeft: {x: padX, y: padY},
    topRight: {x: size.width - padX, y: padY},
    bottomRight: {x: size.width - padX, y: size.height - padY},
    bottomLeft: {x: padX, y: size.height - padY},
  };
};

export const scaleQuadBetweenDimensions = (
  quad: ScanQuad,
  fromSize: FrameDimensions,
  toSize: FrameDimensions,
): ScanQuad => {
  if (fromSize.width <= 0 || fromSize.height <= 0) {
    return createDefaultScanQuad(toSize);
  }
  const scaleX = toSize.width / fromSize.width;
  const scaleY = toSize.height / fromSize.height;

  return {
    topLeft: {
      x: quad.topLeft.x * scaleX,
      y: quad.topLeft.y * scaleY,
    },
    topRight: {
      x: quad.topRight.x * scaleX,
      y: quad.topRight.y * scaleY,
    },
    bottomRight: {
      x: quad.bottomRight.x * scaleX,
      y: quad.bottomRight.y * scaleY,
    },
    bottomLeft: {
      x: quad.bottomLeft.x * scaleX,
      y: quad.bottomLeft.y * scaleY,
    },
  };
};

export const smoothQuadEma = (
  previous: ScanQuad,
  current: ScanQuad,
  alpha: number,
): ScanQuad => ({
  topLeft: emaSmoothPoint(previous.topLeft, current.topLeft, alpha),
  topRight: emaSmoothPoint(previous.topRight, current.topRight, alpha),
  bottomRight: emaSmoothPoint(previous.bottomRight, current.bottomRight, alpha),
  bottomLeft: emaSmoothPoint(previous.bottomLeft, current.bottomLeft, alpha),
});

export const computeQuadCornerDrift = (a: ScanQuad, b: ScanQuad): number => {
  const d0 = distanceBetweenPoints(a.topLeft, b.topLeft);
  const d1 = distanceBetweenPoints(a.topRight, b.topRight);
  const d2 = distanceBetweenPoints(a.bottomRight, b.bottomRight);
  const d3 = distanceBetweenPoints(a.bottomLeft, b.bottomLeft);
  return (d0 + d1 + d2 + d3) / 4;
};

export const updateQuadCornerClamped = (
  quad: ScanQuad,
  cornerKey: CornerKey,
  nextPoint: Point2D,
  bounds: FrameDimensions,
  snapRadius = 0,
): ScanQuad => {
  const clamped = clampPointToBounds(nextPoint, bounds.width, bounds.height, 4);
  const snappedX =
    clamped.x < snapRadius
      ? 4
      : bounds.width - clamped.x < snapRadius
        ? bounds.width - 4
        : clamped.x;
  const snappedY =
    clamped.y < snapRadius
      ? 4
      : bounds.height - clamped.y < snapRadius
        ? bounds.height - 4
        : clamped.y;

  return {
    ...quad,
    [cornerKey]: {x: snappedX, y: snappedY},
  };
};

export const serializeQuadCorners = (quad: ScanQuad): string =>
  JSON.stringify(quad);

export const parseQuadCornersJson = (
  jsonStr: string,
  fallbackSize: FrameDimensions = {width: 1080, height: 1440},
): ScanQuad => {
  try {
    const parsed = JSON.parse(jsonStr) as Partial<ScanQuad>;
    if (
      parsed.topLeft &&
      parsed.topRight &&
      parsed.bottomRight &&
      parsed.bottomLeft
    ) {
      return {
        topLeft: parsed.topLeft,
        topRight: parsed.topRight,
        bottomRight: parsed.bottomRight,
        bottomLeft: parsed.bottomLeft,
      };
    }
  } catch {
    return createDefaultScanQuad(fallbackSize);
  }
  return createDefaultScanQuad(fallbackSize);
};

export const buildSvgPolygonPoints = (quad: ScanQuad): string =>
  `${quad.topLeft.x},${quad.topLeft.y} ${quad.topRight.x},${quad.topRight.y} ${quad.bottomRight.x},${quad.bottomRight.y} ${quad.bottomLeft.x},${quad.bottomLeft.y}`;

