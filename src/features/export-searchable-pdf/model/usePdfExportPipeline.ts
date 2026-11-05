import {useCallback, useState} from 'react';
import {
  documentRepository,
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
import {classifyDocumentByGeometryAndOcr} from '@shared/lib/classification/documentClassifier';
import {
  buildExportedPdfFilePath,
  ensureAppStorageDirectories,
} from '@shared/lib/file-system/pathResolver';
import {
  deleteFileIfExists,
  purgeRawScanCache,
} from '@shared/lib/file-system/tempFileCleaner';

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
        const existingDoc =
          await documentRepository.getDocumentById(sessionId);
        const previousPdfPath = existingDoc?.pdfPath ?? null;
        const now = Date.now();
        const pdfOutputPath = buildExportedPdfFilePath(sessionId);

        const initialDoc: ScannedDocument = {
          id: sessionId,
          title: activeDocumentTitle.trim() || `Scan ${sessionId}`,
          docType: docTypeOverride,
          pdfPath: previousPdfPath,
          coverUri: pages[0]?.processedUri ?? null,
          pageCount: pages.length,
          createdAt: existingDoc?.createdAt ?? now,
          updatedAt: now,
          cloudSyncedAt: existingDoc?.cloudSyncedAt ?? null,
        };
        await saveDocumentRecord(initialDoc);

        const pdfPagesInput: PdfPageInput[] = [];
        const collectedOcrTexts: string[] = [];
        const collectedBarcodes: string[] = [];

        for (let i = 0; i < pages.length; i += 1) {
          const page = pages[i];
          if (!page) {
            continue;
          }
          setProgressText(`OCR & Indexing Page ${i + 1} / ${pages.length}`);
          const ocrResult = await recognizeTextWithMlKit(page.processedUri);
          if (ocrResult.fullText) {
            collectedOcrTexts.push(ocrResult.fullText);
          }
          collectedBarcodes.push(...ocrResult.detectedBarcodes);
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

        const firstPage = pages[0];
        const autoClassified = firstPage
          ? classifyDocumentByGeometryAndOcr({
              width: firstPage.width,
              height: firstPage.height,
              ocrText: collectedOcrTexts.join('\n'),
              barcodes: collectedBarcodes,
            }).docType
          : docTypeOverride;

        setProgressText(`Assembling ${pages.length}-page A4 PDF...`);
        const pdfResponse = await generateSearchablePdfOnDevice({
          outputFilePath: pdfOutputPath,
          title: initialDoc.title,
          jpegQuality: SCAN_CONSTANTS.PDF_JPEG_QUALITY,
          pages: pdfPagesInput,
        });

        const completedDoc: ScannedDocument = {
          ...initialDoc,
          docType:
            docTypeOverride !== 'standard' ? docTypeOverride : autoClassified,
          pdfPath: pdfResponse.pdfUri,
          updatedAt: Date.now(),
        };
        await saveDocumentRecord(completedDoc);

        if (
          previousPdfPath &&
          previousPdfPath !== pdfResponse.pdfUri
        ) {
          await deleteFileIfExists(previousPdfPath);
        }

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
