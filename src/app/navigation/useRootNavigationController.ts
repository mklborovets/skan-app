import {useCallback, useEffect, useState} from 'react';
import {Alert, AppState, BackHandler} from 'react-native';
import {documentRepository, useDocumentStore} from '@entities/document';
import {
  pageRepository,
  ScannedPage,
  useScanSessionStore,
} from '@entities/scanned-page';
import {usePdfExportPipeline} from '@features/export-searchable-pdf';
import {
  consumeSharedIncomingImages,
  detectStaticEdges,
  exportPdfToGoogleDriveNative,
  generateSearchablePdfOnDevice,
  runMlKitDocumentScannerBenchmark,
  warpAndFilterImage,
} from '@shared/api/native-modules';
import {SCAN_CONSTANTS} from '@shared/config/scanConstants';
import {
  buildExportedPdfFilePath,
  buildProcessedPageFilePath,
  ensureAppStorageDirectories,
  ensureFileUriPrefix,
} from '@shared/lib/file-system/pathResolver';
import {NavigationRouteState} from './types';

export const useRootNavigationController = () => {
  const [route, setRoute] = useState<NavigationRouteState>({
    screen: 'Library',
  });

  const sessionPages = useScanSessionStore(state => state.pages);
  const startNewSession = useScanSessionStore(state => state.startNewSession);
  const loadExistingPages = useScanSessionStore(
    state => state.loadExistingPages,
  );
  const addCapturedPage = useScanSessionStore(state => state.addCapturedPage);
  const refreshDocuments = useDocumentStore(state => state.refreshDocuments);
  const {isExporting, progressText, exportCurrentSessionToPdf} =
    usePdfExportPipeline();

  const ingestSharedImages = useCallback(async () => {
    try {
      const sharedUris = await consumeSharedIncomingImages();
      if (sharedUris.length === 0) {
        return;
      }
      startNewSession('Shared Import');
      const sessionId = useScanSessionStore.getState().sessionId;
      for (let i = 0; i < sharedUris.length; i += 1) {
        const rawUri = sharedUris[i];
        if (!rawUri) {
          continue;
        }
        const pageId = `shared_${Date.now()}_${i}`;
        const detection = await detectStaticEdges(rawUri);
        const outPath = buildProcessedPageFilePath(pageId, 'bw_document');
        const warped = await warpAndFilterImage({
          inputUri: rawUri,
          outputUri: ensureFileUriPrefix(outPath),
          corners: detection.corners,
          preset: 'bw_document',
        });
        const finalProcessedUri =
          warped.outputUri && warped.outputUri !== 'file://'
            ? warped.outputUri
            : rawUri;
        const newPage: ScannedPage = {
          id: pageId,
          documentId: sessionId,
          pageIndex: i,
          rawUri,
          processedUri: finalProcessedUri,
          filterPreset: 'bw_document',
          corners: detection.corners,
          ocrText: '',
          ocrBlocks: [],
          width: detection.frameWidth > 0 ? detection.frameWidth : 1080,
          height: detection.frameHeight > 0 ? detection.frameHeight : 1440,
        };
        addCapturedPage(newPage);
        await pageRepository.upsertPage(newPage, 'Shared Import');
      }
      await refreshDocuments();
      setRoute({screen: 'DocumentReview'});
    } catch {
      return;
    }
  }, [addCapturedPage, refreshDocuments, startNewSession]);

  useEffect(() => {
    void ingestSharedImages();
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        void ingestSharedImages();
      }
    });
    return () => {
      sub.remove();
    };
  }, [ingestSharedImages]);

  useEffect(() => {
    const onHardwareBack = (): boolean => {
      if (route.screen === 'CropEdit') {
        setRoute({screen: 'DocumentReview'});
        return true;
      }
      if (route.screen === 'CameraScan') {
        setRoute({
          screen: sessionPages.length > 0 ? 'DocumentReview' : 'Library',
        });
        return true;
      }
      if (route.screen === 'DocumentReview' || route.screen === 'PdfPreview') {
        setRoute({screen: 'Library'});
        return true;
      }
      return false;
    };

    const backSub = BackHandler.addEventListener(
      'hardwareBackPress',
      onHardwareBack,
    );
    return () => {
      backSub.remove();
    };
  }, [route.screen, sessionPages.length]);

  const handleEditDocumentFromPreview = useCallback(
    async (documentId: string) => {
      const [doc, docPages] = await Promise.all([
        documentRepository.getDocumentById(documentId),
        pageRepository.getPagesByDocumentId(documentId),
      ]);
      if (doc && docPages.length > 0) {
        loadExistingPages(doc.id, doc.title, docPages);
      }
      setRoute({screen: 'DocumentReview'});
    },
    [loadExistingPages],
  );

  const handleExportSession = useCallback(async () => {
    const savedDoc = await exportCurrentSessionToPdf();
    if (savedDoc) {
      setRoute({
        screen: 'PdfPreview',
        activeDocumentId: savedDoc.id,
      });
    }
  }, [exportCurrentSessionToPdf]);

  const handleDriveExport = useCallback(
    async (documentId: string) => {
      const doc = await documentRepository.getDocumentById(documentId);
      if (!doc) {
        return;
      }
      let pdfPath = doc.pdfPath;
      if (!pdfPath) {
        const docPages = await pageRepository.getPagesByDocumentId(documentId);
        if (docPages.length > 0) {
          await ensureAppStorageDirectories();
          const outputFilePath = buildExportedPdfFilePath(doc.id);
          const pdfRes = await generateSearchablePdfOnDevice({
            outputFilePath,
            title: doc.title,
            jpegQuality: SCAN_CONSTANTS.PDF_JPEG_QUALITY,
            pages: docPages.map(p => ({
              pageId: p.id,
              processedUri: p.processedUri,
              ocrBlocks: p.ocrBlocks,
            })),
          });
          pdfPath = pdfRes.pdfUri;
          await documentRepository.upsertDocument({
            ...doc,
            pdfPath,
            updatedAt: Date.now(),
          });
        }
      }
      if (!pdfPath) {
        Alert.alert('Google Drive', 'PDF document has not been generated yet.');
        return;
      }
      const syncRes = await exportPdfToGoogleDriveNative(
        pdfPath,
        doc.title,
      );
      if (syncRes.synced) {
        await documentRepository.markCloudSynced(documentId, syncRes.syncedAt);
        await refreshDocuments();
        Alert.alert(
          'Google Drive',
          `PDF "${doc.title}" was successfully synced to Google Drive cloud storage.`,
        );
      } else {
        Alert.alert('Google Drive', 'Sync failed. Please try again.');
      }
    },
    [refreshDocuments],
  );

  const handleRunBenchmark = useCallback(async (documentId: string) => {
    const doc = await documentRepository.getDocumentById(documentId);
    const targetUri = doc?.coverUri ?? '';
    const metrics = await runMlKitDocumentScannerBenchmark(targetUri);
    Alert.alert(
      'OpenCV vs ML Kit Document Scanner',
      `Custom OpenCV C++: ${metrics.customOpenCvLatencyMs.toFixed(1)} ms (IoU ${metrics.customEdgeIoU})\nML Kit Scanner API: ${metrics.mlKitScannerLatencyMs.toFixed(1)} ms (IoU ${metrics.mlKitEdgeIoU})`,
    );
  }, []);

  return {
    route,
    setRoute,
    sessionPages,
    isExporting,
    progressText,
    handleExportSession,
    handleEditDocumentFromPreview,
    handleDriveExport,
    handleRunBenchmark,
  };
};

