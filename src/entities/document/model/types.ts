export type DocumentType =
  | 'standard'
  | 'passport'
  | 'receipt'
  | 'business_card'
  | 'id_card';

export interface ScannedDocument {
  id: string;
  title: string;
  docType: DocumentType;
  pdfPath: string | null;
  coverUri: string | null;
  pageCount: number;
  createdAt: number;
  updatedAt: number;
  cloudSyncedAt: number | null;
  matchedSnippet?: string;
}

export interface DocumentRowRecord {
  id: string;
  title: string;
  doc_type: string;
  pdf_path: string | null;
  page_count: number;
  created_at: number;
  updated_at: number;
  cloud_synced_at: number | null;
  cover_uri?: string | null;
  matched_snippet?: string | null;
}

