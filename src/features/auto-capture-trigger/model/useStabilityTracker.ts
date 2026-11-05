import {useCallback, useRef, useState} from 'react';
import {computeQuadCornerDrift, ScanQuad} from '@entities/scan-quad';
import {SCAN_CONSTANTS} from '@shared/config/scanConstants';

export interface UseStabilityTrackerParams {
  autoCaptureEnabled: boolean;
  onStableTrigger: (stableQuad: ScanQuad) => void;
}

export interface StabilityTrackerState {
  progress: number;
  isStable: boolean;
  autoCaptureEnabled: boolean;
  toggleAutoCapture: () => void;
  evaluateQuadStability: (quad: ScanQuad | null, frameWidth: number) => void;
  resetStability: () => void;
}

export const useStabilityTracker = ({
  autoCaptureEnabled: initialEnabled,
  onStableTrigger,
}: UseStabilityTrackerParams): StabilityTrackerState => {
  const [autoCaptureEnabled, setAutoCaptureEnabled] =
    useState<boolean>(initialEnabled);
  const [progress, setProgress] = useState<number>(0);
  const [isStable, setIsStable] = useState<boolean>(false);

  const lastQuadRef = useRef<ScanQuad | null>(null);
  const stableFramesRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);

  const resetStability = useCallback(() => {
    lastQuadRef.current = null;
    stableFramesRef.current = 0;
    setProgress(0);
    setIsStable(false);
  }, []);

  const toggleAutoCapture = useCallback(() => {
    setAutoCaptureEnabled(prev => !prev);
    resetStability();
  }, [resetStability]);

  const evaluateQuadStability = useCallback(
    (quad: ScanQuad | null, frameWidth: number) => {
      if (!quad || frameWidth <= 0) {
        resetStability();
        return;
      }

      if (Date.now() < cooldownUntilRef.current) {
        return;
      }

      const prevQuad = lastQuadRef.current;
      lastQuadRef.current = quad;

      if (!prevQuad) {
        stableFramesRef.current = 1;
        setProgress(1 / SCAN_CONSTANTS.STABILITY_REQUIRED_FRAMES);
        return;
      }

      const meanDrift = computeQuadCornerDrift(prevQuad, quad);
      const maxAllowedDrift =
        frameWidth * SCAN_CONSTANTS.STABILITY_MAX_DRIFT_RATIO;

      if (meanDrift <= maxAllowedDrift) {
        stableFramesRef.current += 1;
      } else {
        stableFramesRef.current = Math.max(0, stableFramesRef.current - 4);
      }

      const ratio = Math.min(
        1,
        stableFramesRef.current / SCAN_CONSTANTS.STABILITY_REQUIRED_FRAMES,
      );
      setProgress(ratio);
      setIsStable(ratio >= 0.55);

      if (
        autoCaptureEnabled &&
        stableFramesRef.current >= SCAN_CONSTANTS.STABILITY_REQUIRED_FRAMES
      ) {
        cooldownUntilRef.current = Date.now() + 2200;
        stableFramesRef.current = 0;
        setProgress(1);
        onStableTrigger(quad);
      }
    },
    [autoCaptureEnabled, onStableTrigger, resetStability],
  );

  return {
    progress,
    isStable,
    autoCaptureEnabled,
    toggleAutoCapture,
    evaluateQuadStability,
    resetStability,
  };
};

