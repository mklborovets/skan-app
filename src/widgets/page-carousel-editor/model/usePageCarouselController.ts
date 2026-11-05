import {useCallback, useMemo} from 'react';
import {ScannedPage, useScanSessionStore} from '@entities/scanned-page';
import {useImageFilterProcessor} from '@features/apply-image-filter';
import {usePageReorder} from '@features/reorder-document-pages';
import {FilterPresetId} from '@shared/api/native-modules';

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

  const {isApplyingFilter, applyFilterToActivePage} = useImageFilterProcessor();

  const activePage = useMemo(
    () => pages.find(p => p.id === activePageId) ?? pages[0] ?? null,
    [activePageId, pages],
  );

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
    isApplyingFilter,
    setDocumentTitle,
    onSelectPage: selectPage,
    onMoveLeft,
    onMoveRight,
    onRemovePage,
    onSelectPreset,
    onEditCropPress,
    onAddPagePress: onAddMorePages,
    onBack,
  };
};
