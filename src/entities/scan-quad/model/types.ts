import {Point2D} from '@shared/lib/geometry/pointInterpolation';

export type CornerKey = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

export interface ScanQuad {
  topLeft: Point2D;
  topRight: Point2D;
  bottomRight: Point2D;
  bottomLeft: Point2D;
}

export interface FrameDimensions {
  width: number;
  height: number;
}

export interface QuadDetectionFrame {
  detected: boolean;
  quad: ScanQuad;
  confidence: number;
  areaRatio: number;
  sourceSize: FrameDimensions;
}
