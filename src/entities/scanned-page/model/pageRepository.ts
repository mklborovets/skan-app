import {
  FilterPresetId,
  OcrTextBlock,
  QuadCornersDto,
} from '@shared/api/native-modules';
import {sqliteClient} from '@shared/db';
import {PageRowRecord, ScannedPage} from './types';

const DEFAULT_CORNERS: QuadCornersDto = {
  topLeft: {x: 80, y: 110},
  topRight: {x: 1000, y: 110},
  bottomRight: {x: 1000, y: 1330},
  bottomLeft: {x: 80, y: 1330},
};

const parseCornersJson = (rawJson: string): QuadCornersDto => {
  try {
    const parsed = JSON.parse(rawJson) as Partial<QuadCornersDto>;
    if (
      parsed.topLeft &&
      parsed.topRight &&
      parsed.bottomRight &&
      parsed.bottomLeft
    ) {
      return {
        topLeft: parsed.topLeft,
        topRight: parsed.topRight,
        bottomRight: parsed.bottomRight,
        bottomLeft: parsed.bottomLeft,
      };
    }
  } catch {
    return DEFAULT_CORNERS;
  }
  return DEFAULT_CORNERS;
};

const parseOcrBlocksJson = (rawJson?: string): OcrTextBlock[] => {
  if (!rawJson) {
    return [];
  }
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    return Array.isArray(parsed) ? (parsed as OcrTextBlock[]) : [];
  } catch {
    return [];
  }
};

const mapRowToScannedPage = (row: PageRowRecord): ScannedPage => ({
  id: row.id,
  documentId: row.document_id,
  pageIndex: Number(row.page_index),
  rawUri: row.raw_uri,
  processedUri: row.processed_uri,
  filterPreset: (row.filter_preset as FilterPresetId) || 'original',
  corners: parseCornersJson(row.corners_json),
  ocrText: row.ocr_text ?? '',
  ocrBlocks: parseOcrBlocksJson(row.ocr_blocks_json),
  width: Number(row.width) > 0 ? Number(row.width) : 1080,
  height: Number(row.height) > 0 ? Number(row.height) : 1440,
});

export const pageRepository = {
  async getPagesByDocumentId(documentId: string): Promise<ScannedPage[]> {
    const rows = await sqliteClient.queryRows<PageRowRecord>(
      'SELECT * FROM pages WHERE document_id = ? ORDER BY page_index ASC;',
      [documentId],
    );
    return rows.map(mapRowToScannedPage);
  },

  async upsertPage(page: ScannedPage): Promise<void> {
    const db = sqliteClient.getDatabase();
    await db.transaction(async tx => {
      await tx.executeAsync(
        `INSERT OR REPLACE INTO pages (
          id, document_id, page_index, raw_uri, processed_uri, filter_preset, corners_json, ocr_text, ocr_blocks_json, width, height
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          page.id,
          page.documentId,
          page.pageIndex,
          page.rawUri,
          page.processedUri,
          page.filterPreset,
          JSON.stringify(page.corners),
          page.ocrText,
          JSON.stringify(page.ocrBlocks),
          page.width,
          page.height,
        ],
      );

      await tx.executeAsync('DELETE FROM pages_fts WHERE page_id = ?;', [
        page.id,
      ]);

      if (page.ocrText.trim().length > 0) {
        await tx.executeAsync(
          'INSERT INTO pages_fts (document_id, page_id, ocr_text) VALUES (?, ?, ?);',
          [page.documentId, page.id, page.ocrText],
        );
      }
    });
  },

  async updatePageOrders(
    documentId: string,
    orderedPageIds: readonly string[],
  ): Promise<void> {
    const db = sqliteClient.getDatabase();
    await db.transaction(async tx => {
      for (let idx = 0; idx < orderedPageIds.length; idx += 1) {
        const pageId = orderedPageIds[idx];
        if (!pageId) {
          continue;
        }
        await tx.executeAsync(
          'UPDATE pages SET page_index = ? WHERE id = ? AND document_id = ?;',
          [idx, pageId, documentId],
        );
      }
    });
  },

  async updatePageOcrText(
    documentId: string,
    pageId: string,
    ocrText: string,
    ocrBlocks: OcrTextBlock[] = [],
  ): Promise<void> {
    const db = sqliteClient.getDatabase();
    await db.transaction(async tx => {
      await tx.executeAsync(
        'UPDATE pages SET ocr_text = ?, ocr_blocks_json = ? WHERE id = ?;',
        [ocrText, JSON.stringify(ocrBlocks), pageId],
      );
      await tx.executeAsync('DELETE FROM pages_fts WHERE page_id = ?;', [
        pageId,
      ]);
      if (ocrText.trim().length > 0) {
        await tx.executeAsync(
          'INSERT INTO pages_fts (document_id, page_id, ocr_text) VALUES (?, ?, ?);',
          [documentId, pageId, ocrText],
        );
      }
    });
  },

  async deletePageById(pageId: string): Promise<void> {
    const db = sqliteClient.getDatabase();
    await db.transaction(async tx => {
      await tx.executeAsync('DELETE FROM pages WHERE id = ?;', [pageId]);
      await tx.executeAsync('DELETE FROM pages_fts WHERE page_id = ?;', [
        pageId,
      ]);
    });
  },
};

