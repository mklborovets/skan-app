import {useCallback, useRef, useState} from 'react';
import {
  FrameDimensions,
  QuadDetectionFrame,
  scaleQuadBetweenDimensions,
  ScanQuad,
  smoothQuadEma,
} from '@entities/scan-quad';
import {SCAN_CONSTANTS} from '@shared/config/scanConstants';

export interface SmoothedQuadState {
  visible: boolean;
  smoothedQuad: ScanQuad | null;
  confidence: number;
  onDetectionFrame: (
    detection: QuadDetectionFrame,
    viewportSize: FrameDimensions,
  ) => ScanQuad | null;
  resetSmoothing: () => void;
}

export const useFrameSmoothing = (
  alpha: number = SCAN_CONSTANTS.EMA_SMOOTHING_ALPHA,
): SmoothedQuadState => {
  const previousQuadRef = useRef<ScanQuad | null>(null);
  const missedFramesRef = useRef<number>(0);
  const [smoothedQuad, setSmoothedQuad] = useState<ScanQuad | null>(null);
  const [confidence, setConfidence] = useState<number>(0);

  const onDetectionFrame = useCallback(
    (
      detection: QuadDetectionFrame,
      viewportSize: FrameDimensions,
    ): ScanQuad | null => {
      if (
        !detection.detected ||
        viewportSize.width <= 0 ||
        viewportSize.height <= 0
      ) {
        missedFramesRef.current += 1;
        if (missedFramesRef.current > 6) {
          previousQuadRef.current = null;
          setSmoothedQuad(null);
          setConfidence(0);
        }
        return previousQuadRef.current;
      }

      missedFramesRef.current = 0;
      const scaled = scaleQuadBetweenDimensions(
        detection.quad,
        detection.sourceSize,
        viewportSize,
      );

      const nextQuad = previousQuadRef.current
        ? smoothQuadEma(previousQuadRef.current, scaled, alpha)
        : scaled;

      previousQuadRef.current = nextQuad;
      setSmoothedQuad(nextQuad);
      setConfidence(detection.confidence);
      return nextQuad;
    },
    [alpha],
  );

  const resetSmoothing = useCallback(() => {
    previousQuadRef.current = null;
    missedFramesRef.current = 0;
    setSmoothedQuad(null);
    setConfidence(0);
  }, []);

  return {
    visible: smoothedQuad !== null,
    smoothedQuad,
    confidence,
    onDetectionFrame,
    resetSmoothing,
  };
};
