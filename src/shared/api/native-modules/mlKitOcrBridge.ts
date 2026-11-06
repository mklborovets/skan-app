import {NativeModules} from 'react-native';
import {stripFileUriPrefix} from '@shared/lib/file-system/pathResolver';

export interface OcrBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrTextBlock {
  text: string;
  confidence: number;
  boundingBox: OcrBoundingBox;
  normalizedBox: OcrBoundingBox;
}

export interface OcrRecognitionResult {
  fullText: string;
  blocks: OcrTextBlock[];
  detectedBarcodes: string[];
}

interface NativeOcrProcessorSpec {
  recognizeFile(filePath: string): Promise<OcrRecognitionResult>;
}

export const recognizeTextWithMlKit = async (
  imageUriOrPath: string,
): Promise<OcrRecognitionResult> => {
  const nativeModule = NativeModules.OcrProcessorModule as
    | NativeOcrProcessorSpec
    | undefined;
  const cleanPath = stripFileUriPrefix(imageUriOrPath).trim();

  if (!cleanPath || cleanPath === 'file://') {
    return {
      fullText: '',
      blocks: [],
      detectedBarcodes: [],
    };
  }

  if (nativeModule?.recognizeFile) {
    try {
      const result = await nativeModule.recognizeFile(cleanPath);
      return {
        fullText: result?.fullText ?? '',
        blocks: result?.blocks ?? [],
        detectedBarcodes: result?.detectedBarcodes ?? [],
      };
    } catch (ocrError) {
      console.warn('[MlKitOcrBridge] OCR recognizeFile failed:', ocrError);
    }
  }

  return {
    fullText: '',
    blocks: [],
    detectedBarcodes: [],
  };
};

