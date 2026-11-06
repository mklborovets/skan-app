import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Image, LayoutChangeEvent} from 'react-native';
import {
  createDefaultScanQuad,
  FrameDimensions,
  scaleQuadBetweenDimensions,
  ScanQuad,
} from '@entities/scan-quad';
import {pageRepository, useScanSessionStore} from '@entities/scanned-page';
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
import {deleteFileIfExists} from '@shared/lib/file-system/tempFileCleaner';

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
  const [rawImageSize, setRawImageSize] = useState<FrameDimensions | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const hasInitializedRef = useRef<boolean>(false);

  const sourceSize: FrameDimensions = useMemo(() => {
    if (rawImageSize && rawImageSize.width > 0 && rawImageSize.height > 0) {
      return rawImageSize;
    }
    const maxCornerX = page
      ? Math.max(
          page.corners.topLeft.x,
          page.corners.topRight.x,
          page.corners.bottomRight.x,
          page.corners.bottomLeft.x,
        )
      : 0;
    const maxCornerY = page
      ? Math.max(
          page.corners.topLeft.y,
          page.corners.topRight.y,
          page.corners.bottomRight.y,
          page.corners.bottomLeft.y,
        )
      : 0;
    return {
      width: Math.max(page?.width ?? 1080, Math.round(maxCornerX / 0.92)),
      height: Math.max(page?.height ?? 1440, Math.round(maxCornerY / 0.92)),
    };
  }, [page, rawImageSize]);

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

  useEffect(() => {
    if (!page?.rawUri) {
      return;
    }
    let active = true;
    Image.getSize(
      page.rawUri,
      (width, height) => {
        if (active && width > 0 && height > 0) {
          setRawImageSize({width, height});
        }
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [page?.rawUri]);

  const onBoardLayout = useCallback((event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) {
      return;
    }
    setBoardSize({width, height});
  }, []);

  useEffect(() => {
    if (!page || boardSize.width <= 0 || boardSize.height <= 0) {
      return;
    }
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const initialQuad = scaleQuadBetweenDimensions(
        page.corners,
        sourceSize,
        boardSize,
      );
      gestures.setQuad(initialQuad);
    }
  }, [boardSize, gestures, page, sourceSize]);

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
      } else {
        gestures.resetToFullBounds();
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
      const previousProcessedUri = page.processedUri;
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

      const nextWidth = warped.width > 0 ? warped.width : page.width;
      const nextHeight = warped.height > 0 ? warped.height : page.height;

      updatePageCropAndFilter({
        pageId: page.id,
        processedUri: warped.outputUri,
        corners: fullResQuad,
        filterPreset: page.filterPreset,
        width: nextWidth,
        height: nextHeight,
      });

      await pageRepository.upsertPage({
        ...page,
        processedUri: warped.outputUri,
        corners: fullResQuad,
        width: nextWidth,
        height: nextHeight,
      });

      if (
        previousProcessedUri &&
        previousProcessedUri !== page.rawUri &&
        previousProcessedUri !== warped.outputUri
      ) {
        await deleteFileIfExists(previousProcessedUri);
      }

      onApplyCompleted();
    } catch (cropErr) {
      console.warn('[InteractiveCrop] Warp failed:', cropErr);
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

