import {useCallback, useState} from 'react';
import {ScannedPage} from '@entities/scanned-page';
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
        const ocr = await recognizeTextWithMlKit(page.processedUri);
        const result = classifyDocumentByGeometryAndOcr({
          width: page.width,
          height: page.height,
          ocrText: ocr.fullText || page.ocrText,
          barcodes: ocr.detectedBarcodes,
        });
        setClassification(result);
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

