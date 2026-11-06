import {useCallback, useState} from 'react';
import {documentRepository, useDocumentStore} from '@entities/document';
import {
  pageRepository,
  ScannedPage,
  useScanSessionStore,
} from '@entities/scanned-page';
import {recognizeTextWithMlKit} from '@shared/api/native-modules';
import {
  ClassificationResult,
  classifyDocumentByGeometryAndOcr,
} from '@shared/lib/classification/documentClassifier';

export interface DocumentClassifierState {
  classification: ClassificationResult | null;
  isClassifying: boolean;
  analyzePageAndClassify: (page: ScannedPage) => Promise<ClassificationResult>;
}

export const useDocumentClassifier = (): DocumentClassifierState => {
  const [classification, setClassification] =
    useState<ClassificationResult | null>(null);
  const [isClassifying, setIsClassifying] = useState<boolean>(false);

  const analyzePageAndClassify = useCallback(
    async (page: ScannedPage): Promise<ClassificationResult> => {
      setIsClassifying(true);
      try {
        let ocr = await recognizeTextWithMlKit(page.processedUri);
        if (
          !ocr.fullText.trim() &&
          page.rawUri &&
          page.rawUri !== page.processedUri
        ) {
          const rawOcr = await recognizeTextWithMlKit(page.rawUri);
          if (rawOcr.fullText.trim()) {
            ocr = rawOcr;
          }
        }

        const effectiveText = ocr.fullText.trim() || page.ocrText || '';
        const effectiveBlocks =
          ocr.blocks.length > 0 ? ocr.blocks : page.ocrBlocks;

        if (ocr.fullText.trim() && ocr.fullText !== page.ocrText) {
          useScanSessionStore
            .getState()
            .updatePageOcrResult(page.id, effectiveText, effectiveBlocks);
          try {
            await pageRepository.updatePageOcrText(
              page.documentId,
              page.id,
              effectiveText,
              effectiveBlocks,
            );
          } catch {
            void 0;
          }
        }

        const result = classifyDocumentByGeometryAndOcr({
          width: page.width,
          height: page.height,
          ocrText: effectiveText,
          barcodes: ocr.detectedBarcodes,
        });
        setClassification(result);

        try {
          await documentRepository.updateDocumentMetadata(page.documentId, {
            docType: result.docType,
          });
          await useDocumentStore.getState().refreshDocuments();
        } catch {
          void 0;
        }

        return result;
      } finally {
        setIsClassifying(false);
      }
    },
    [],
  );

  return {
    classification,
    isClassifying,
    analyzePageAndClassify,
  };
};

