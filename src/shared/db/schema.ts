export const DB_NAME = 'skan_documents.db';

export const CREATE_DOCUMENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'standard',
  pdf_path TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  cloud_synced_at INTEGER
);
`;

export const CREATE_PAGES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL,
  page_index INTEGER NOT NULL,
  raw_uri TEXT NOT NULL,
  processed_uri TEXT NOT NULL,
  filter_preset TEXT NOT NULL,
  corners_json TEXT NOT NULL,
  ocr_text TEXT DEFAULT '',
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
`;

export const CREATE_PAGES_DOCUMENT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_pages_document_order
ON pages (document_id, page_index);
`;

export const CREATE_PAGES_FTS_TABLE_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
  document_id UNINDEXED,
  page_id UNINDEXED,
  ocr_text,
  tokenize = 'unicode61'
);
`;

export const CREATE_MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  applied_at INTEGER NOT NULL
);
`;

export const ALTER_PAGES_ADD_OCR_BLOCKS_SQL = `
ALTER TABLE pages ADD COLUMN ocr_blocks_json TEXT NOT NULL DEFAULT '[]';
`;

export const ALTER_PAGES_ADD_WIDTH_SQL = `
ALTER TABLE pages ADD COLUMN width INTEGER NOT NULL DEFAULT 1080;
`;

export const ALTER_PAGES_ADD_HEIGHT_SQL = `
ALTER TABLE pages ADD COLUMN height INTEGER NOT NULL DEFAULT 1440;
`;


