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
        const docTitle = activeDocumentTitle.trim() || `Scan ${sessionId}`;

        const pdfPagesInput: PdfPageInput[] = [];
        const collectedOcrTexts: string[] = [];
        const collectedBarcodes: string[] = [];

        for (let i = 0; i < pages.length; i += 1) {
          const page = pages[i];
          if (!page) {
            continue;
          }
          let ocrResult = {
            fullText: page.ocrText || '',
            blocks: page.ocrBlocks || [],
            detectedBarcodes: [] as string[],
          };

          if (!ocrResult.fullText && ocrResult.blocks.length === 0) {
            setProgressText(`OCR & Indexing Page ${i + 1} / ${pages.length}`);
            try {
              ocrResult = await recognizeTextWithMlKit(page.processedUri);
              if (
                !ocrResult.fullText.trim() &&
                page.rawUri &&
                page.rawUri !== page.processedUri
              ) {
                const rawOcr = await recognizeTextWithMlKit(page.rawUri);
                if (rawOcr.fullText.trim()) {
                  ocrResult = rawOcr;
                }
              }
            } catch (ocrErr) {
              console.warn('[PdfExport] OCR failed on page:', ocrErr);
            }
          }
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

          await pageRepository.upsertPage(updatedPage, docTitle);
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
          title: docTitle,
          jpegQuality: SCAN_CONSTANTS.PDF_JPEG_QUALITY,
          pages: pdfPagesInput,
        });

        const completedDoc: ScannedDocument = {
          id: sessionId,
          title: docTitle,
          docType:
            docTypeOverride !== 'standard' ? docTypeOverride : autoClassified,
          pdfPath: pdfResponse.pdfUri,
          coverUri: firstPage?.processedUri ?? null,
          pageCount: pages.length,
          createdAt: existingDoc?.createdAt ?? now,
          updatedAt: Date.now(),
          cloudSyncedAt: existingDoc?.cloudSyncedAt ?? null,
        };
        await saveDocumentRecord(completedDoc);

        if (
          previousPdfPath &&
          previousPdfPath !== pdfResponse.pdfUri
        ) {
          await deleteFileIfExists(previousPdfPath);
        }

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
