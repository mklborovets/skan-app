import {useCallback, useMemo, useRef, useState} from 'react';
import {PanResponder, PanResponderInstance} from 'react-native';
import {
  CornerKey,
  createDefaultScanQuad,
  FrameDimensions,
  ScanQuad,
  updateQuadCornerClamped,
} from '@entities/scan-quad';
import {SCAN_CONSTANTS} from '@shared/config/scanConstants';
import {Point2D} from '@shared/lib/geometry/pointInterpolation';

export interface UseCornerGesturesParams {
  initialQuad: ScanQuad;
  boardSize: FrameDimensions;
  onQuadChanged?: (quad: ScanQuad) => void;
  onUserGestureStart?: () => void;
}

export interface CornerGesturesState {
  quad: ScanQuad;
  activeCorner: CornerKey | null;
  activePoint: Point2D | null;
  setQuad: (quad: ScanQuad) => void;
  resetToFullBounds: () => void;
  getPanHandlersForCorner: (
    cornerKey: CornerKey,
  ) => PanResponderInstance['panHandlers'];
}

export const useCornerGestures = ({
  initialQuad,
  boardSize,
  onQuadChanged,
  onUserGestureStart,
}: UseCornerGesturesParams): CornerGesturesState => {
  const [quad, setQuadState] = useState<ScanQuad>(initialQuad);
  const [activeCorner, setActiveCorner] = useState<CornerKey | null>(null);
  const startPointRef = useRef<Point2D>({x: 0, y: 0});
  const latestQuadRef = useRef<ScanQuad>(initialQuad);
  latestQuadRef.current = quad;

  const boardSizeRef = useRef<FrameDimensions>(boardSize);
  boardSizeRef.current = boardSize;

  const onUserGestureStartRef = useRef(onUserGestureStart);
  onUserGestureStartRef.current = onUserGestureStart;

  const setQuad = useCallback(
    (newQuad: ScanQuad) => {
      latestQuadRef.current = newQuad;
      setQuadState(newQuad);
      onQuadChanged?.(newQuad);
    },
    [onQuadChanged],
  );

  const updateCorner = useCallback(
    (cornerKey: CornerKey, candidate: Point2D) => {
      const currentBoardSize = boardSizeRef.current;
      if (currentBoardSize.width <= 0 || currentBoardSize.height <= 0) {
        return;
      }
      const nextQuad = updateQuadCornerClamped(
        latestQuadRef.current,
        cornerKey,
        candidate,
        currentBoardSize,
        SCAN_CONSTANTS.CORNER_SNAP_RADIUS,
      );
      latestQuadRef.current = nextQuad;
      setQuad(nextQuad);
      onQuadChanged?.(nextQuad);
    },
    [onQuadChanged, setQuad],
  );

  const responders = useMemo(() => {
    const createForKey = (cornerKey: CornerKey): PanResponderInstance =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          startPointRef.current = {...latestQuadRef.current[cornerKey]};
          setActiveCorner(cornerKey);
          onUserGestureStartRef.current?.();
        },
        onPanResponderMove: (_, gestureState) => {
          const nextPt: Point2D = {
            x: startPointRef.current.x + gestureState.dx,
            y: startPointRef.current.y + gestureState.dy,
          };
          updateCorner(cornerKey, nextPt);
        },
        onPanResponderRelease: () => {
          setActiveCorner(null);
        },
        onPanResponderTerminate: () => {
          setActiveCorner(null);
        },
      });

    return {
      topLeft: createForKey('topLeft'),
      topRight: createForKey('topRight'),
      bottomRight: createForKey('bottomRight'),
      bottomLeft: createForKey('bottomLeft'),
    };
  }, [updateCorner]);

  const getPanHandlersForCorner = useCallback(
    (cornerKey: CornerKey) => responders[cornerKey].panHandlers,
    [responders],
  );

  const resetToFullBounds = useCallback(() => {
    const currentBoardSize = boardSizeRef.current;
    if (currentBoardSize.width <= 0 || currentBoardSize.height <= 0) {
      return;
    }
    const fullQuad = createDefaultScanQuad(currentBoardSize, 0.04);
    latestQuadRef.current = fullQuad;
    setQuad(fullQuad);
    onUserGestureStartRef.current?.();
    onQuadChanged?.(fullQuad);
  }, [onQuadChanged, setQuad]);

  const activePoint = activeCorner ? quad[activeCorner] : null;

  return {
    quad,
    activeCorner,
    activePoint,
    setQuad,
    resetToFullBounds,
    getPanHandlersForCorner,
  };
};

