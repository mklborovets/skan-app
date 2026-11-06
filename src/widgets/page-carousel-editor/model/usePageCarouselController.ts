import { useCallback, useEffect, useMemo } from 'react';
import { documentRepository, useDocumentStore } from '@entities/document';
import { ScannedPage, useScanSessionStore } from '@entities/scanned-page';
import { useImageFilterProcessor } from '@features/apply-image-filter';
import { useDocumentClassifier } from '@features/classify-document-type';
import { usePageReorder } from '@features/reorder-document-pages';
import { FilterPresetId } from '@shared/api/native-modules';
import { ClassificationResult } from '@shared/lib/classification/documentClassifier';

export interface UsePageCarouselControllerParams {
  onAddMorePages: () => void;
  onEditPageCrop: (pageId: string) => void;
  onExportSuccess: (documentId: string, pdfUri: string) => void;
  onBack: () => void;
}

export interface PageCarouselControllerState {
  documentTitle: string;
  pages: ScannedPage[];
  activePage: ScannedPage | null;
  classification: ClassificationResult | null;
  isApplyingFilter: boolean;
  setDocumentTitle: (title: string) => void;
  onSelectPage: (pageId: string) => void;
  onMoveLeft: (index: number) => void;
  onMoveRight: (index: number) => void;
  onRemovePage: (pageId: string) => void;
  onSelectPreset: (preset: FilterPresetId) => void;
  onEditCropPress: () => void;
  onAddPagePress: () => void;
  onBack: () => void;
}

export const usePageCarouselController = ({
  onAddMorePages,
  onEditPageCrop,
  onBack,
}: UsePageCarouselControllerParams): PageCarouselControllerState => {
  const documentTitle = useScanSessionStore(state => state.activeDocumentTitle);
  const setDocumentTitle = useScanSessionStore(state => state.setDocumentTitle);

  const {
    pages,
    activePageId,
    selectPage,
    movePageLeft,
    movePageRight,
    deletePage,
  } = usePageReorder();

  const { isApplyingFilter, applyFilterToActivePage } = useImageFilterProcessor();
  const { classification, analyzePageAndClassify } = useDocumentClassifier();

  const activePage = useMemo(
    () => pages.find(p => p.id === activePageId) ?? pages[0] ?? null,
    [activePageId, pages],
  );

  useEffect(() => {
    if (activePage) {
      void analyzePageAndClassify(activePage);
    }
  }, [activePage?.id, activePage?.processedUri, analyzePageAndClassify]);

  const handleSetDocumentTitle = useCallback(
    (title: string) => {
      setDocumentTitle(title);
      const sessionId = useScanSessionStore.getState().sessionId;
      if (title.trim()) {
        void documentRepository.updateDocumentMetadata(sessionId, {
          title: title.trim(),
        });
      }
    },
    [setDocumentTitle],
  );

  const handleBack = useCallback(() => {
    const state = useScanSessionStore.getState();
    const cleanTitle = state.activeDocumentTitle.trim();
    if (cleanTitle) {
      void documentRepository
        .updateDocumentMetadata(state.sessionId, { title: cleanTitle })
        .then(() => useDocumentStore.getState().refreshDocuments());
    }
    onBack();
  }, [onBack]);

  const onEditCropPress = useCallback(() => {
    if (activePage) {
      onEditPageCrop(activePage.id);
    }
  }, [activePage, onEditPageCrop]);

  const onSelectPreset = useCallback(
    (preset: FilterPresetId) => {
      void applyFilterToActivePage(preset);
    },
    [applyFilterToActivePage],
  );

  const onMoveLeft = useCallback(
    (index: number) => {
      void movePageLeft(index);
    },
    [movePageLeft],
  );

  const onMoveRight = useCallback(
    (index: number) => {
      void movePageRight(index);
    },
    [movePageRight],
  );

  const onRemovePage = useCallback(
    (pageId: string) => {
      void deletePage(pageId);
    },
    [deletePage],
  );

  return {
    documentTitle,
    pages,
    activePage,
    classification,
    isApplyingFilter,
    setDocumentTitle: handleSetDocumentTitle,
    onSelectPage: selectPage,
    onMoveLeft,
    onMoveRight,
    onRemovePage,
    onSelectPreset,
    onEditCropPress,
    onAddPagePress: onAddMorePages,
    onBack: handleBack,
  };
};

