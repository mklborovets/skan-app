import {useCallback, useState} from 'react';
import {
  DocumentType,
  ScannedDocument,
  useDocumentStore,
} from '@entities/document';
import {
  pageRepository,
  ScannedPage,
  useScanSessionStore,
} from '@entities/scanned-page';
import {
  generateSearchablePdfOnDevice,
  PdfPageInput,
  recognizeTextWithMlKit,
} from '@shared/api/native-modules';
import {SCAN_CONSTANTS} from '@shared/config/scanConstants';
import {
  buildExportedPdfFilePath,
  ensureAppStorageDirectories,
} from '@shared/lib/file-system/pathResolver';
import {purgeRawScanCache} from '@shared/lib/file-system/tempFileCleaner';

export interface PdfExportPipelineState {
  isExporting: boolean;
  progressText: string;
  exportCurrentSessionToPdf: (
    docTypeOverride?: DocumentType,
  ) => Promise<ScannedDocument | null>;
}

export const usePdfExportPipeline = (): PdfExportPipelineState => {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const saveDocumentRecord = useDocumentStore(state => state.saveDocumentRecord);

  const exportCurrentSessionToPdf = useCallback(
    async (
      docTypeOverride: DocumentType = 'standard',
    ): Promise<ScannedDocument | null> => {
      const sessionState = useScanSessionStore.getState();
      const {sessionId, activeDocumentTitle, pages} = sessionState;
      if (pages.length === 0) {
        return null;
      }

      setIsExporting(true);
      try {
        await ensureAppStorageDirectories();
        const now = Date.now();
        const pdfOutputPath = buildExportedPdfFilePath(sessionId);

        const initialDoc: ScannedDocument = {
          id: sessionId,
          title: activeDocumentTitle.trim() || `Scan ${sessionId}`,
          docType: docTypeOverride,
          pdfPath: null,
          coverUri: pages[0]?.processedUri ?? null,
          pageCount: pages.length,
          createdAt: now,
          updatedAt: now,
          cloudSyncedAt: null,
        };
        await saveDocumentRecord(initialDoc);

        const pdfPagesInput: PdfPageInput[] = [];

        for (let i = 0; i < pages.length; i += 1) {
          const page = pages[i];
          if (!page) {
            continue;
          }
          setProgressText(`OCR & Indexing Page ${i + 1} / ${pages.length}`);
          const ocrResult = await recognizeTextWithMlKit(page.processedUri);
          const updatedPage: ScannedPage = {
            ...page,
            pageIndex: i,
            ocrText: ocrResult.fullText,
            ocrBlocks: ocrResult.blocks,
          };

          await pageRepository.upsertPage(updatedPage);
          sessionState.updatePageOcrResult(
            page.id,
            ocrResult.fullText,
            ocrResult.blocks,
          );

          pdfPagesInput.push({
            pageId: page.id,
            processedUri: page.processedUri,
            ocrBlocks: ocrResult.blocks,
          });
        }

        setProgressText(`Assembling ${pages.length}-page A4 PDF...`);
        const pdfResponse = await generateSearchablePdfOnDevice({
          outputFilePath: pdfOutputPath,
          title: initialDoc.title,
          jpegQuality: SCAN_CONSTANTS.PDF_JPEG_QUALITY,
          pages: pdfPagesInput,
        });

        const completedDoc: ScannedDocument = {
          ...initialDoc,
          pdfPath: pdfResponse.pdfUri,
          updatedAt: Date.now(),
        };
        await saveDocumentRecord(completedDoc);

        const activeRawUris = pages.map(p => p.rawUri);
        await purgeRawScanCache(activeRawUris);

        return completedDoc;
      } finally {
        setIsExporting(false);
        setProgressText('');
      }
    },
    [saveDocumentRecord],
  );

  return {
    isExporting,
    progressText,
    exportCurrentSessionToPdf,
  };
};
