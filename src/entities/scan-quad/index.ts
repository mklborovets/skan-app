export type {
  CornerKey,
  FrameDimensions,
  QuadDetectionFrame,
  ScanQuad,
} from './model/types';
export {
  buildSvgPolygonPoints,
  computeQuadCornerDrift,
  CORNER_KEYS,
  createDefaultScanQuad,
  parseQuadCornersJson,
  scaleQuadBetweenDimensions,
  serializeQuadCorners,
  smoothQuadEma,
  updateQuadCornerClamped,
} from './lib/quadGeometryMath';

