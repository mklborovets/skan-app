export type {
  CornerKey,
  FrameDimensions,
  QuadDetectionFrame,
  ScanQuad,
} from './model/types';
export {
  buildSvgPolygonPoints,
  computeContainedBoardSize,
  computeQuadCornerDrift,
  CORNER_KEYS,
  createDefaultScanQuad,
  parseQuadCornersJson,
  projectQuadToCoverViewport,
  scaleQuadBetweenDimensions,
  serializeQuadCorners,
  smoothQuadEma,
  unprojectQuadFromCoverViewport,
  updateQuadCornerClamped,
} from './lib/quadGeometryMath';
