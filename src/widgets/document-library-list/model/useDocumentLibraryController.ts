import {useCallback, useEffect} from 'react';
import {ScannedDocument, useDocumentStore} from '@entities/document';
import {pageRepository, useScanSessionStore} from '@entities/scanned-page';
import {
  FullTextSearchState,
  useFullTextSearch,
} from '@features/search-by-ocr';
import {
  generateSearchablePdfOnDevice,
  sharePdfFileNative,
} from '@shared/api/native-modules';
import {SCAN_CONSTANTS} from '@shared/config/scanConstants';
import {
  buildExportedPdfFilePath,
  ensureAppStorageDirectories,
} from '@shared/lib/file-system/pathResolver';

export interface UseDocumentLibraryControllerParams {
  onStartNewScan: () => void;
  onOpenDocumentPreview: (documentId: string) => void;
}

export interface DocumentLibraryControllerState {
  documents: ScannedDocument[];
  isLoading: boolean;
  search: FullTextSearchState;
  formatTimestamp: (timestamp: number) => string;
  onStartScanPress: () => void;
  onSelectDocument: (doc: ScannedDocument) => Promise<void>;
  onShareDocument: (doc: ScannedDocument) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
}

export const useDocumentLibraryController = ({
  onStartNewScan,
  onOpenDocumentPreview,
}: UseDocumentLibraryControllerParams): DocumentLibraryControllerState => {
  const documents = useDocumentStore(state => state.documents);
  const searchResults = useDocumentStore(state => state.searchResults);
  const isLoading = useDocumentStore(state => state.isLoading);
  const refreshDocuments = useDocumentStore(state => state.refreshDocuments);
  const deleteDocumentRecord = useDocumentStore(
    state => state.deleteDocumentRecord,
  );

  const startNewSession = useScanSessionStore(state => state.startNewSession);
  const loadExistingPages = useScanSessionStore(
    state => state.loadExistingPages,
  );

  const search = useFullTextSearch();

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  const formatTimestamp = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 10);
  }, []);

  const onStartScanPress = useCallback(() => {
    startNewSession();
    onStartNewScan();
  }, [onStartNewScan, startNewSession]);

  const onSelectDocument = useCallback(
    async (doc: ScannedDocument) => {
      const pages = await pageRepository.getPagesByDocumentId(doc.id);
      loadExistingPages(doc.id, doc.title, pages);
      onOpenDocumentPreview(doc.id);
    },
    [loadExistingPages, onOpenDocumentPreview],
  );

  const onShareDocument = useCallback(async (doc: ScannedDocument) => {
    let pdfPath = doc.pdfPath;
    if (!pdfPath) {
      const docPages = await pageRepository.getPagesByDocumentId(doc.id);
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
        await useDocumentStore.getState().saveDocumentRecord({
          ...doc,
          pdfPath,
          updatedAt: Date.now(),
        });
      }
    }
    if (!pdfPath) {
      return;
    }
    await sharePdfFileNative(pdfPath, doc.title);
  }, []);

  const onDeleteDocument = useCallback(
    async (documentId: string) => {
      await deleteDocumentRecord(documentId);
    },
    [deleteDocumentRecord],
  );

  return {
    documents: searchResults ?? documents,
    isLoading,
    search,
    formatTimestamp,
    onStartScanPress,
    onSelectDocument,
    onShareDocument,
    onDeleteDocument,
  };
};

