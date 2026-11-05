import {useCallback, useState} from 'react';
import {
  pageRepository,
  ScannedPage,
  useScanSessionStore,
} from '@entities/scanned-page';
import {
  OcrRecognitionResult,
  recognizeTextWithMlKit,
} from '@shared/api/native-modules';

export interface OcrExecutionState {
  isRecognizing: boolean;
  recognizeSinglePage: (page: ScannedPage) => Promise<OcrRecognitionResult>;
  recognizeAllSessionPages: () => Promise<{
    combinedText: string;
    barcodes: string[];
  }>;
}

export const useOcrExecution = (): OcrExecutionState => {
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const updatePageOcrResult = useScanSessionStore(
    state => state.updatePageOcrResult,
  );

  const recognizeSinglePage = useCallback(
    async (page: ScannedPage): Promise<OcrRecognitionResult> => {
      const result = await recognizeTextWithMlKit(page.processedUri);
      updatePageOcrResult(page.id, result.fullText, result.blocks);
      await pageRepository.updatePageOcrText(
        page.documentId,
        page.id,
        result.fullText,
        result.blocks,
      );
      return result;
    },
    [updatePageOcrResult],
  );

  const recognizeAllSessionPages = useCallback(async (): Promise<{
    combinedText: string;
    barcodes: string[];
  }> => {
    setIsRecognizing(true);
    try {
      const sessionPages = useScanSessionStore.getState().pages;
      const textParts: string[] = [];
      const barcodeSet = new Set<string>();

      for (const page of sessionPages) {
        const res = await recognizeSinglePage(page);
        if (res.fullText.trim().length > 0) {
          textParts.push(res.fullText.trim());
        }
        for (const code of res.detectedBarcodes) {
          barcodeSet.add(code);
        }
      }

      return {
        combinedText: textParts.join('\n\n'),
        barcodes: Array.from(barcodeSet),
      };
    } finally {
      setIsRecognizing(false);
    }
  }, [recognizeSinglePage]);

  return {
    isRecognizing,
    recognizeSinglePage,
    recognizeAllSessionPages,
  };
};

