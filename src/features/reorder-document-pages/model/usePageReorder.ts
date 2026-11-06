import {useCallback} from 'react';
import {documentRepository, useDocumentStore} from '@entities/document';
import {
  pageRepository,
  ScannedPage,
  useScanSessionStore,
} from '@entities/scanned-page';
import {deleteFileIfExists} from '@shared/lib/file-system/tempFileCleaner';

export interface PageReorderController {
  pages: ScannedPage[];
  activePageId: string | null;
  selectPage: (pageId: string) => void;
  movePageLeft: (index: number) => Promise<void>;
  movePageRight: (index: number) => Promise<void>;
  deletePage: (pageId: string) => Promise<void>;
}

export const usePageReorder = (): PageReorderController => {
  const pages = useScanSessionStore(state => state.pages);
  const activePageId = useScanSessionStore(state => state.activePageId);
  const setActivePageId = useScanSessionStore(state => state.setActivePageId);
  const reorderSessionPages = useScanSessionStore(
    state => state.reorderSessionPages,
  );
  const removeSessionPage = useScanSessionStore(
    state => state.removeSessionPage,
  );

  const selectPage = useCallback(
    (pageId: string) => {
      setActivePageId(pageId);
    },
    [setActivePageId],
  );

  const persistPageOrder = useCallback(async () => {
    const state = useScanSessionStore.getState();
    const ids = state.pages.map(p => p.id);
    await pageRepository.updatePageOrders(state.sessionId, ids);
  }, []);

  const movePageLeft = useCallback(
    async (index: number) => {
      if (index <= 0) {
        return;
      }
      reorderSessionPages(index, index - 1);
      await persistPageOrder();
    },
    [persistPageOrder, reorderSessionPages],
  );

  const movePageRight = useCallback(
    async (index: number) => {
      if (index >= pages.length - 1) {
        return;
      }
      reorderSessionPages(index, index + 1);
      await persistPageOrder();
    },
    [pages.length, persistPageOrder, reorderSessionPages],
  );

  const deletePage = useCallback(
    async (pageId: string) => {
      const removed = removeSessionPage(pageId);
      await pageRepository.deletePageById(pageId);
      await persistPageOrder();
      const sessionState = useScanSessionStore.getState();
      const existingDoc = await documentRepository.getDocumentById(
        sessionState.sessionId,
      );
      if (existingDoc) {
        if (sessionState.pages.length === 0 && !existingDoc.pdfPath) {
          await useDocumentStore
            .getState()
            .deleteDocumentRecord(sessionState.sessionId);
        } else {
          await documentRepository.upsertDocument({
            ...existingDoc,
            pageCount: sessionState.pages.length,
            updatedAt: Date.now(),
          });
          await useDocumentStore.getState().refreshDocuments();
        }
      }
      if (removed) {
        await deleteFileIfExists(removed.rawUri);
        if (removed.processedUri !== removed.rawUri) {
          await deleteFileIfExists(removed.processedUri);
        }
      }
    },
    [persistPageOrder, removeSessionPage],
  );

  return {
    pages,
    activePageId,
    selectPage,
    movePageLeft,
    movePageRight,
    deletePage,
  };
};

