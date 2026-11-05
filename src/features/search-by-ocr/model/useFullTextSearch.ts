import {useCallback, useRef, useState} from 'react';
import {
  DocumentRowRecord,
  DocumentType,
  ScannedDocument,
  useDocumentStore,
} from '@entities/document';
import {SCAN_CONSTANTS} from '@shared/config/scanConstants';
import {sqliteClient} from '@shared/db';

export interface FullTextSearchState {
  query: string;
  isSearching: boolean;
  onChangeQuery: (text: string) => void;
  onClearQuery: () => void;
}

const sanitizeFtsQuery = (raw: string): string => {
  const tokens = raw
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);

  if (tokens.length === 0) {
    return '';
  }
  return tokens.map(token => `"${token}"*`).join(' AND ');
};

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

export const useFullTextSearch = (): FullTextSearchState => {
  const [query, setQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSearchResults = useDocumentStore(state => state.setSearchResults);

  const runSearchQuery = useCallback(
    async (rawText: string) => {
      const ftsExpression = sanitizeFtsQuery(rawText);
      if (!ftsExpression) {
        setSearchResults(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const rows = await sqliteClient.queryRows<DocumentRowRecord>(
          `SELECT
            d.*,
            (SELECT p.processed_uri FROM pages p WHERE p.document_id = d.id ORDER BY p.page_index ASC LIMIT 1) AS cover_uri,
            snippet(pages_fts, 2, '[', ']', ' … ', 12) AS matched_snippet
          FROM pages_fts
          INNER JOIN documents d ON d.id = pages_fts.document_id
          WHERE pages_fts MATCH ?
          GROUP BY d.id
          ORDER BY bm25(pages_fts) ASC
          LIMIT 50;`,
          [ftsExpression],
        );

        const titleFallbackRows = await sqliteClient.queryRows<DocumentRowRecord>(
          `SELECT
            d.*,
            (SELECT p.processed_uri FROM pages p WHERE p.document_id = d.id ORDER BY p.page_index ASC LIMIT 1) AS cover_uri
          FROM documents d
          WHERE d.title LIKE ?
          ORDER BY d.updated_at DESC
          LIMIT 25;`,
          [`%${rawText.trim()}%`],
        );

        const mergedMap = new Map<string, ScannedDocument>();
        for (const row of [...rows, ...titleFallbackRows]) {
          if (mergedMap.has(row.id)) {
            continue;
          }
          mergedMap.set(row.id, {
            id: row.id,
            title: row.title,
            docType: normalizeDocType(row.doc_type),
            pdfPath: row.pdf_path ?? null,
            coverUri: row.cover_uri ?? null,
            pageCount: Number(row.page_count),
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at),
            cloudSyncedAt:
              row.cloud_synced_at !== null && row.cloud_synced_at !== undefined
                ? Number(row.cloud_synced_at)
                : null,
            matchedSnippet: row.matched_snippet ?? undefined,
          });
        }

        setSearchResults(Array.from(mergedMap.values()));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [setSearchResults],
  );

  const onChangeQuery = useCallback(
    (text: string) => {
      setQuery(text);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (!text.trim()) {
        setSearchResults(null);
        setIsSearching(false);
        return;
      }
      timerRef.current = setTimeout(() => {
        void runSearchQuery(text);
      }, SCAN_CONSTANTS.SEARCH_DEBOUNCE_MS);
    },
    [runSearchQuery, setSearchResults],
  );

  const onClearQuery = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setQuery('');
    setSearchResults(null);
    setIsSearching(false);
  }, [setSearchResults]);

  return {
    query,
    isSearching,
    onChangeQuery,
    onClearQuery,
  };
};
