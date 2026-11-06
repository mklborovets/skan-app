import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, LayoutChangeEvent } from 'react-native';
import { useDocumentStore } from '@entities/document';
import {
  computeContainedBoardSize,
  createDefaultScanQuad,
  FrameDimensions,
  scaleQuadBetweenDimensions,
  ScanQuad,
} from '@entities/scan-quad';
import { pageRepository, useScanSessionStore } from '@entities/scanned-page';
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
import { deleteFileIfExists } from '@shared/lib/file-system/tempFileCleaner';

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
  const updatePageOcrResult = useScanSessionStore(
    state => state.updatePageOcrResult,
  );

  const [containerSize, setContainerSize] = useState<FrameDimensions>({
    width: 340,
    height: 460,
  });
  const [rawImageSize, setRawImageSize] = useState<FrameDimensions | null>(() => {
    if (page?.width && page.height && page.width > 0 && page.height > 0) {
      return { width: page.width, height: page.height };
    }
    return null;
  });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const hasUserEditedRef = useRef<boolean>(false);

  const sourceSize: FrameDimensions = useMemo(() => {
    if (rawImageSize && rawImageSize.width > 0 && rawImageSize.height > 0) {
      return rawImageSize;
    }
    if (page?.width && page.height && page.width > 0 && page.height > 0) {
      return { width: page.width, height: page.height };
    }
    return { width: 1080, height: 1440 };
  }, [page?.height, page?.width, rawImageSize]);

  const boardSize: FrameDimensions = useMemo(
    () => computeContainedBoardSize(containerSize, sourceSize),
    [containerSize, sourceSize],
  );

  const initialBoardQuad: ScanQuad = useMemo(() => {
    if (!page?.corners) {
      return createDefaultScanQuad(boardSize);
    }
    return scaleQuadBetweenDimensions(page.corners, sourceSize, boardSize);
  }, [boardSize, page?.corners, sourceSize]);

  const handleUserGestureStart = useCallback(() => {
    hasUserEditedRef.current = true;
  }, []);

  const gestures = useCornerGestures({
    initialQuad: initialBoardQuad,
    boardSize,
    onUserGestureStart: handleUserGestureStart,
  });

  const setQuadRef = useRef(gestures.setQuad);
  setQuadRef.current = gestures.setQuad;

  const currentQuadRef = useRef(gestures.quad);
  currentQuadRef.current = gestures.quad;

  const containerSizeRef = useRef(containerSize);
  containerSizeRef.current = containerSize;

  const boardSizeRef = useRef(boardSize);
  boardSizeRef.current = boardSize;

  const sourceSizeRef = useRef(sourceSize);
  sourceSizeRef.current = sourceSize;

  const pageCornersRef = useRef(page?.corners);
  pageCornersRef.current = page?.corners;

  useEffect(() => {
    if (!page?.rawUri) {
      return;
    }
    let active = true;
    Image.getSize(
      page.rawUri,
      (width, height) => {
        if (!active || width <= 0 || height <= 0) {
          return;
        }
        const newRawSize = { width, height };
        setRawImageSize(newRawSize);
        const nextBoard = computeContainedBoardSize(
          containerSizeRef.current,
          newRawSize,
        );
        boardSizeRef.current = nextBoard;
        if (!hasUserEditedRef.current && pageCornersRef.current && nextBoard.width > 0) {
          const scaled = scaleQuadBetweenDimensions(
            pageCornersRef.current,
            newRawSize,
            nextBoard,
          );
          setQuadRef.current(scaled);
        }
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [page?.rawUri]);

  const onBoardLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) {
      return;
    }
    const prevContainer = containerSizeRef.current;
    if (
      Math.abs(prevContainer.width - width) < 1 &&
      Math.abs(prevContainer.height - height) < 1
    ) {
      return;
    }
    const nextContainer = { width, height };
    containerSizeRef.current = nextContainer;
    setContainerSize(nextContainer);

    const prevBoard = boardSizeRef.current;
    const newBoard = computeContainedBoardSize(
      nextContainer,
      sourceSizeRef.current,
    );
    boardSizeRef.current = newBoard;

    if (!hasUserEditedRef.current) {
      if (pageCornersRef.current && sourceSizeRef.current.width > 0) {
        const scaled = scaleQuadBetweenDimensions(
          pageCornersRef.current,
          sourceSizeRef.current,
          newBoard,
        );
        setQuadRef.current(scaled);
      }
    } else if (prevBoard.width > 0 && prevBoard.height > 0) {
      const scaled = scaleQuadBetweenDimensions(
        currentQuadRef.current,
        prevBoard,
        newBoard,
      );
      setQuadRef.current(scaled);
    }
  }, []);

  const onAutoDetectCorners = useCallback(async () => {
    if (!page) {
      return;
    }
    setIsProcessing(true);
    hasUserEditedRef.current = true;
    try {
      const detection = await detectStaticEdges(page.rawUri);
      if (detection.detected) {
        const scaled = scaleQuadBetweenDimensions(
          detection.corners,
          { width: detection.frameWidth, height: detection.frameHeight },
          boardSizeRef.current,
        );
        setQuadRef.current(scaled);
      } else {
        setQuadRef.current(createDefaultScanQuad(boardSizeRef.current));
      }
    } finally {
      setIsProcessing(false);
    }
  }, [page]);

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
        boardSizeRef.current,
        sourceSizeRef.current,
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

      const rawWidth = sourceSizeRef.current.width;
      const rawHeight = sourceSizeRef.current.height;

      updatePageCropAndFilter({
        pageId: page.id,
        processedUri: warped.outputUri,
        corners: fullResQuad,
        filterPreset: page.filterPreset,
        width: rawWidth,
        height: rawHeight,
      });
      updatePageOcrResult(page.id, '', []);

      const activeTitle = useScanSessionStore.getState().activeDocumentTitle;
      await pageRepository.upsertPage(
        {
          ...page,
          processedUri: warped.outputUri,
          corners: fullResQuad,
          width: rawWidth,
          height: rawHeight,
          ocrText: '',
          ocrBlocks: [],
        },
        activeTitle,
      );
      await useDocumentStore.getState().refreshDocuments();

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
    gestures.quad,
    onApplyCompleted,
    page,
    updatePageCropAndFilter,
    updatePageOcrResult,
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

