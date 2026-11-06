import {useCallback, useRef, useState} from 'react';
import {LayoutChangeEvent} from 'react-native';
import RNFS from 'react-native-fs';
import {
  Camera,
  CameraDevice,
  ReadonlyFrameProcessor,
  useCameraDevice,
} from 'react-native-vision-camera';
import {
  createDefaultScanQuad,
  FrameDimensions,
  QuadDetectionFrame,
  scaleQuadBetweenDimensions,
  ScanQuad,
} from '@entities/scan-quad';
import {
  pageRepository,
  ScannedPage,
  useScanSessionStore,
} from '@entities/scanned-page';
import {useStabilityTracker} from '@features/auto-capture-trigger';
import {
  useEdgeDetectionWorklet,
  useFrameSmoothing,
} from '@features/detect-document-edges';
import {
  detectStaticEdges,
  warpAndFilterImage,
} from '@shared/api/native-modules';
import {
  buildProcessedPageFilePath,
  buildRawScanFilePath,
  ensureAppStorageDirectories,
  ensureFileUriPrefix,
  stripFileUriPrefix,
} from '@shared/lib/file-system/pathResolver';
import {deleteFileIfExists} from '@shared/lib/file-system/tempFileCleaner';
import {useCameraPermission} from '@shared/lib/permissions/useCameraPermission';

export interface UseLiveScannerControllerParams {
  onPhotoCaptured: (pageId: string) => void;
  onReviewSession: () => void;
  onCancel: () => void;
}

export interface LiveScannerControllerState {
  cameraRef: React.RefObject<Camera>;
  device: CameraDevice | undefined;
  hasPermission: boolean;
  ensurePermission: () => Promise<boolean>;
  openSettings: () => Promise<void>;
  viewportSize: FrameDimensions;
  smoothedQuad: ScanQuad | null;
  isStable: boolean;
  stabilityProgress: number;
  autoCaptureEnabled: boolean;
  torchOn: boolean;
  isCapturing: boolean;
  pageCount: number;
  lastThumbnailUri: string | null;
  frameProcessor: ReadonlyFrameProcessor;
  onViewportLayout: (event: LayoutChangeEvent) => void;
  onCapturePress: () => Promise<void>;
  onToggleTorch: () => void;
  onToggleAutoCapture: () => void;
  onReviewPress: () => void;
  onClosePress: () => void;
}

export const useLiveScannerController = ({
  onPhotoCaptured,
  onReviewSession,
  onCancel,
}: UseLiveScannerControllerParams): LiveScannerControllerState => {
  const cameraRef = useRef<Camera>(null);
  const isCapturingRef = useRef<boolean>(false);
  const device = useCameraDevice('back');
  const {hasPermission, ensurePermission, openSettings} = useCameraPermission();

  const [viewportSize, setViewportSize] = useState<FrameDimensions>({
    width: 0,
    height: 0,
  });
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  const pages = useScanSessionStore(state => state.pages);
  const addCapturedPage = useScanSessionStore(state => state.addCapturedPage);

  const {smoothedQuad, onDetectionFrame, resetSmoothing} = useFrameSmoothing();

  const executePhotoCapture = useCallback(
    async (liveQuadOverride?: ScanQuad | null) => {
      if (isCapturingRef.current) {
        return;
      }
      isCapturingRef.current = true;
      setIsCapturing(true);

      try {
        await ensureAppStorageDirectories();
        const pageId = `page_${Date.now()}`;
        const rawCachePath = buildRawScanFilePath(pageId);
        const processedPath = buildProcessedPageFilePath(pageId, 'bw_document');

        let rawUri = ensureFileUriPrefix(rawCachePath);
        let photoWidth = 1080;
        let photoHeight = 1440;

        if (cameraRef.current) {
          const photo = await cameraRef.current.takePhoto({
            flash: torchOn ? 'on' : 'off',
            enableShutterSound: false,
          });
          const capturedCleanPath = stripFileUriPrefix(photo.path);
          if (
            capturedCleanPath !== rawCachePath &&
            (await RNFS.exists(capturedCleanPath))
          ) {
            await RNFS.copyFile(capturedCleanPath, rawCachePath);
            await deleteFileIfExists(capturedCleanPath);
            rawUri = ensureFileUriPrefix(rawCachePath);
          } else {
            rawUri = ensureFileUriPrefix(photo.path);
          }
          photoWidth = photo.width;
          photoHeight = photo.height;
        }

        const staticDetection = await detectStaticEdges(rawUri);
        const targetSize: FrameDimensions = {
          width:
            staticDetection.frameWidth > 0
              ? staticDetection.frameWidth
              : photoWidth,
          height:
            staticDetection.frameHeight > 0
              ? staticDetection.frameHeight
              : photoHeight,
        };

        const detectedCorners = staticDetection.detected
          ? staticDetection.corners
          : liveQuadOverride && viewportSize.width > 0
            ? scaleQuadBetweenDimensions(
                liveQuadOverride,
                viewportSize,
                targetSize,
              )
            : createDefaultScanQuad(targetSize);

        const warped = await warpAndFilterImage({
          inputUri: rawUri,
          outputUri: ensureFileUriPrefix(processedPath),
          corners: detectedCorners,
          preset: 'bw_document',
        });

        const newPage: ScannedPage = {
          id: pageId,
          documentId: useScanSessionStore.getState().sessionId,
          pageIndex: useScanSessionStore.getState().pages.length,
          rawUri,
          processedUri: warped.outputUri,
          filterPreset: 'bw_document',
          corners: detectedCorners,
          ocrText: '',
          ocrBlocks: [],
          width: targetSize.width,
          height: targetSize.height,
        };

        addCapturedPage(newPage);
        try {
          await pageRepository.upsertPage(newPage);
        } catch (dbErr) {
          console.warn('[LiveScanner] Failed to persist page to DB:', dbErr);
        }
        resetSmoothing();
        onPhotoCaptured(pageId);
      } catch (error) {
        console.warn('[LiveScanner] Capture failed:', error);
      } finally {
        isCapturingRef.current = false;
        setIsCapturing(false);
      }
    },
    [
      addCapturedPage,
      onPhotoCaptured,
      resetSmoothing,
      torchOn,
      viewportSize,
    ],
  );

  const {
    progress: stabilityProgress,
    isStable,
    autoCaptureEnabled,
    toggleAutoCapture,
    evaluateQuadStability,
  } = useStabilityTracker({
    autoCaptureEnabled: true,
    onStableTrigger: stableQuad => {
      void executePhotoCapture(stableQuad);
    },
  });

  const handleQuadDetected = useCallback(
    (detection: QuadDetectionFrame) => {
      if (isCapturingRef.current || viewportSize.width <= 0) {
        return;
      }
      const nextSmoothed = onDetectionFrame(detection, viewportSize);
      evaluateQuadStability(nextSmoothed, viewportSize.width);
    },
    [evaluateQuadStability, onDetectionFrame, viewportSize],
  );

  const frameProcessor = useEdgeDetectionWorklet({
    enabled: hasPermission && !isCapturing,
    onQuadDetected: handleQuadDetected,
  });

  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setViewportSize({width, height});
  }, []);

  const onCapturePress = useCallback(async () => {
    await executePhotoCapture(smoothedQuad);
  }, [executePhotoCapture, smoothedQuad]);

  const onToggleTorch = useCallback(() => {
    setTorchOn(prev => !prev);
  }, []);

  const lastPage = pages[pages.length - 1];

  return {
    cameraRef,
    device,
    hasPermission,
    ensurePermission,
    openSettings,
    viewportSize,
    smoothedQuad,
    isStable,
    stabilityProgress,
    autoCaptureEnabled,
    torchOn,
    isCapturing,
    pageCount: pages.length,
    lastThumbnailUri: lastPage ? lastPage.processedUri : null,
    frameProcessor,
    onViewportLayout,
    onCapturePress,
    onToggleTorch,
    onToggleAutoCapture: toggleAutoCapture,
    onReviewPress: onReviewSession,
    onClosePress: onCancel,
  };
};

