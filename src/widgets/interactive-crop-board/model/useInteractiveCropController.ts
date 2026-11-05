import {useCallback, useMemo, useState} from 'react';
import {LayoutChangeEvent} from 'react-native';
import {
  createDefaultScanQuad,
  FrameDimensions,
  scaleQuadBetweenDimensions,
  ScanQuad,
} from '@entities/scan-quad';
import {useScanSessionStore} from '@entities/scanned-page';
import {
  CornerGesturesState,
  useCornerGestures,
} from '@features/adjust-crop-corners';
import {
  detectStaticEdges,
  warpAndFilterImage,
} from '@shared/api/native-modules';
import {
  buildProcessedPageFilePath,
  ensureFileUriPrefix,
} from '@shared/lib/file-system/pathResolver';

export interface UseInteractiveCropControllerParams {
  pageId: string;
  onApplyCompleted: () => void;
  onCancel: () => void;
}

export interface InteractiveCropControllerState {
  rawUri: string;
  boardSize: FrameDimensions;
  isProcessing: boolean;
  gestures: CornerGesturesState;
  onBoardLayout: (event: LayoutChangeEvent) => void;
  onAutoDetectCorners: () => Promise<void>;
  onConfirmCrop: () => Promise<void>;
  onCancel: () => void;
}

export const useInteractiveCropController = ({
  pageId,
  onApplyCompleted,
  onCancel,
}: UseInteractiveCropControllerParams): InteractiveCropControllerState => {
  const page = useScanSessionStore(state =>
    state.pages.find(p => p.id === pageId),
  );
  const updatePageCropAndFilter = useScanSessionStore(
    state => state.updatePageCropAndFilter,
  );

  const [boardSize, setBoardSize] = useState<FrameDimensions>({
    width: 340,
    height: 460,
  });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const sourceSize: FrameDimensions = useMemo(
    () => ({
      width: page?.width ?? 1080,
      height: page?.height ?? 1440,
    }),
    [page?.height, page?.width],
  );

  const initialBoardQuad: ScanQuad = useMemo(() => {
    if (!page) {
      return createDefaultScanQuad(boardSize);
    }
    return scaleQuadBetweenDimensions(page.corners, sourceSize, boardSize);
  }, [boardSize, page, sourceSize]);

  const gestures = useCornerGestures({
    initialQuad: initialBoardQuad,
    boardSize,
  });

  const onBoardLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const {width, height} = event.nativeEvent.layout;
      if (width <= 0 || height <= 0) {
        return;
      }
      const nextBoard = {width, height};
      setBoardSize(nextBoard);
      if (page) {
        const scaled = scaleQuadBetweenDimensions(
          page.corners,
          sourceSize,
          nextBoard,
        );
        gestures.setQuad(scaled);
      }
    },
    [gestures, page, sourceSize],
  );

  const onAutoDetectCorners = useCallback(async () => {
    if (!page) {
      return;
    }
    setIsProcessing(true);
    try {
      const detection = await detectStaticEdges(page.rawUri);
      if (detection.detected) {
        const scaled = scaleQuadBetweenDimensions(
          detection.corners,
          {width: detection.frameWidth, height: detection.frameHeight},
          boardSize,
        );
        gestures.setQuad(scaled);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [boardSize, gestures, page]);

  const onConfirmCrop = useCallback(async () => {
    if (!page) {
      onApplyCompleted();
      return;
    }
    setIsProcessing(true);
    try {
      const fullResQuad = scaleQuadBetweenDimensions(
        gestures.quad,
        boardSize,
        sourceSize,
      );
      const outputPath = buildProcessedPageFilePath(
        page.id,
        page.filterPreset,
      );

      const warped = await warpAndFilterImage({
        inputUri: page.rawUri,
        outputUri: ensureFileUriPrefix(outputPath),
        corners: fullResQuad,
        preset: page.filterPreset,
      });

      updatePageCropAndFilter({
        pageId: page.id,
        processedUri: warped.outputUri,
        corners: fullResQuad,
        filterPreset: page.filterPreset,
        width: warped.width,
        height: warped.height,
      });

      onApplyCompleted();
    } finally {
      setIsProcessing(false);
    }
  }, [
    boardSize,
    gestures.quad,
    onApplyCompleted,
    page,
    sourceSize,
    updatePageCropAndFilter,
  ]);

  return {
    rawUri: page?.rawUri ?? '',
    boardSize,
    isProcessing,
    gestures,
    onBoardLayout,
    onAutoDetectCorners,
    onConfirmCrop,
    onCancel,
  };
};

