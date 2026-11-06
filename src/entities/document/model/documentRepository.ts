import {sqliteClient} from '@shared/db';
import {normalizePersistentPath} from '@shared/lib/file-system/pathResolver';
import {deleteFileIfExists} from '@shared/lib/file-system/tempFileCleaner';
import {DocumentRowRecord, DocumentType, ScannedDocument} from './types';

const normalizeDocType = (rawType: string): DocumentType => {
  if (
    rawType === 'passport' ||
    rawType === 'receipt' ||
    rawType === 'business_card' ||
    rawType === 'id_card'
  ) {
    return rawType;
  }
  return 'standard';
};

const mapRowToDocument = (row: DocumentRowRecord): ScannedDocument => ({
  id: row.id,
  title: row.title,
  docType: normalizeDocType(row.doc_type),
  pdfPath: normalizePersistentPath(row.pdf_path),
  coverUri: normalizePersistentPath(row.cover_uri),
  pageCount: Number(row.page_count),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
  cloudSyncedAt:
    row.cloud_synced_at !== null && row.cloud_synced_at !== undefined
      ? Number(row.cloud_synced_at)
      : null,
  matchedSnippet: row.matched_snippet ?? undefined,
});

export const documentRepository = {
  async listDocuments(): Promise<ScannedDocument[]> {
    const rows = await sqliteClient.queryRows<DocumentRowRecord>(
      `SELECT
        d.*,
        (SELECT p.processed_uri FROM pages p WHERE p.document_id = d.id ORDER BY p.page_index ASC LIMIT 1) AS cover_uri
      FROM documents d
      ORDER BY d.updated_at DESC;`,
    );
    return rows.map(mapRowToDocument);
  },

  async getDocumentById(documentId: string): Promise<ScannedDocument | null> {
    const rows = await sqliteClient.queryRows<DocumentRowRecord>(
      `SELECT
        d.*,
        (SELECT p.processed_uri FROM pages p WHERE p.document_id = d.id ORDER BY p.page_index ASC LIMIT 1) AS cover_uri
      FROM documents d
      WHERE d.id = ?
      LIMIT 1;`,
      [documentId],
    );
    const first = rows[0];
    return first ? mapRowToDocument(first) : null;
  },

  async upsertDocument(doc: ScannedDocument): Promise<void> {
    await sqliteClient.executeAsync(
      `INSERT INTO documents (
        id, title, doc_type, pdf_path, page_count, created_at, updated_at, cloud_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        doc_type = excluded.doc_type,
        pdf_path = COALESCE(excluded.pdf_path, documents.pdf_path),
        page_count = excluded.page_count,
        updated_at = excluded.updated_at,
        cloud_synced_at = excluded.cloud_synced_at;`,
      [
        doc.id,
        doc.title,
        doc.docType,
        doc.pdfPath,
        doc.pageCount,
        doc.createdAt,
        doc.updatedAt,
        doc.cloudSyncedAt,
      ],
    );
  },

  async updateDocumentMetadata(
    documentId: string,
    params: {title?: string; docType?: DocumentType},
  ): Promise<void> {
    const now = Date.now();
    if (params.title !== undefined && params.docType !== undefined) {
      await sqliteClient.executeAsync(
        'UPDATE documents SET title = ?, doc_type = ?, updated_at = ? WHERE id = ?;',
        [params.title, params.docType, now, documentId],
      );
    } else if (params.title !== undefined) {
      await sqliteClient.executeAsync(
        'UPDATE documents SET title = ?, updated_at = ? WHERE id = ?;',
        [params.title, now, documentId],
      );
    } else if (params.docType !== undefined) {
      await sqliteClient.executeAsync(
        'UPDATE documents SET doc_type = ?, updated_at = ? WHERE id = ?;',
        [params.docType, now, documentId],
      );
    }
  },

  async markCloudSynced(documentId: string, syncedAt: number): Promise<void> {
    await sqliteClient.executeAsync(
      'UPDATE documents SET cloud_synced_at = ?, updated_at = ? WHERE id = ?;',
      [syncedAt, syncedAt, documentId],
    );
  },

  async deleteDocumentWithFiles(documentId: string): Promise<void> {
    const doc = await this.getDocumentById(documentId);
    const pageRows = await sqliteClient.queryRows<{
      raw_uri: string;
      processed_uri: string;
    }>('SELECT raw_uri, processed_uri FROM pages WHERE document_id = ?;', [
      documentId,
    ]);

    const db = sqliteClient.getDatabase();
    await db.transaction(async tx => {
      await tx.executeAsync('DELETE FROM pages_fts WHERE document_id = ?;', [
        documentId,
      ]);
      await tx.executeAsync('DELETE FROM pages WHERE document_id = ?;', [
        documentId,
      ]);
      await tx.executeAsync('DELETE FROM documents WHERE id = ?;', [
        documentId,
      ]);
    });

    if (doc?.pdfPath) {
      await deleteFileIfExists(doc.pdfPath);
    }

    for (const row of pageRows) {
      await deleteFileIfExists(row.raw_uri);
      await deleteFileIfExists(row.processed_uri);
    }
  },
};

