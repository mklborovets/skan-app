export type ClassifiedDocumentCategory =
  | 'standard'
  | 'passport'
  | 'receipt'
  | 'business_card'
  | 'id_card';

export interface ClassificationInput {
  width: number;
  height: number;
  ocrText: string;
  barcodes?: readonly string[];
}

export interface ClassificationResult {
  docType: ClassifiedDocumentCategory;
  confidence: number;
  aspectRatio: number;
  detectedBarcodes: string[];
}

const MRZ_REGEX = /P<[A-Z]{3}[A-Z0-9<]{10,}/i;
const PASSPORT_KEYWORDS = /\b(passport|паспорт|nationality|surname|given names)\b/i;
const RECEIPT_KEYWORDS =
  /\b(total|subtotal|vat|tax|cash|change|чек|сума|пдв|фіскальний|сплачено)\b/i;
const PRICE_LINE_REGEX = /\d+[.,]\d{2}\b/g;
const EMAIL_OR_WEB_REGEX = /\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|www\.[a-z0-9.-]+)\b/i;
const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/;
const ID_CARD_KEYWORDS = /\b(identity card|id card|driver|license|посвідчення)\b/i;

export const classifyDocumentByGeometryAndOcr = (
  input: ClassificationInput,
): ClassificationResult => {
  const safeWidth = Math.max(1, input.width);
  const safeHeight = Math.max(1, input.height);
  const aspectRatio = safeWidth / safeHeight;
  const normalizedAspect =
    aspectRatio > 1 ? aspectRatio : 1 / Math.max(0.01, aspectRatio);
  const text = input.ocrText.trim();
  const barcodes = [...(input.barcodes ?? [])];

  if (MRZ_REGEX.test(text) || PASSPORT_KEYWORDS.test(text)) {
    return {
      docType: 'passport',
      confidence: 0.94,
      aspectRatio,
      detectedBarcodes: barcodes,
    };
  }

  const priceMatches = text.match(PRICE_LINE_REGEX) ?? [];
  if (
    RECEIPT_KEYWORDS.test(text) ||
    (priceMatches.length >= 3 && aspectRatio < 0.62)
  ) {
    return {
      docType: 'receipt',
      confidence: 0.91,
      aspectRatio,
      detectedBarcodes: barcodes,
    };
  }

  if (
    normalizedAspect >= 1.48 &&
    normalizedAspect <= 1.88 &&
    text.length > 0 &&
    text.length < 360 &&
    (EMAIL_OR_WEB_REGEX.test(text) || PHONE_REGEX.test(text))
  ) {
    return {
      docType: 'business_card',
      confidence: 0.88,
      aspectRatio,
      detectedBarcodes: barcodes,
    };
  }

  if (
    ID_CARD_KEYWORDS.test(text) ||
    (normalizedAspect >= 1.52 && normalizedAspect <= 1.65 && text.length < 450)
  ) {
    return {
      docType: 'id_card',
      confidence: 0.83,
      aspectRatio,
      detectedBarcodes: barcodes,
    };
  }

  return {
    docType: 'standard',
    confidence: 0.85,
    aspectRatio,
    detectedBarcodes: barcodes,
  };
};

