import {
  FilterPresetId,
  OcrTextBlock,
  QuadCornersDto,
} from '@shared/api/native-modules';

export interface ScannedPage {
  id: string;
  documentId: string;
  pageIndex: number;
  rawUri: string;
  processedUri: string;
  filterPreset: FilterPresetId;
  corners: QuadCornersDto;
  ocrText: string;
  ocrBlocks: OcrTextBlock[];
  width: number;
  height: number;
}

export interface PageRowRecord {
  id: string;
  document_id: string;
  page_index: number;
  raw_uri: string;
  processed_uri: string;
  filter_preset: string;
  corners_json: string;
  ocr_text: string;
}

