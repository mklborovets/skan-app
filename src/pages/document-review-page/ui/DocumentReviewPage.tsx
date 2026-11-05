import React from 'react';
import {
  PageCarouselEditor,
  usePageCarouselController,
} from '@widgets/page-carousel-editor';
import {SafeScreenContainer} from '@shared/ui/layout/SafeScreenContainer';

export interface DocumentReviewPageProps {
  onAddMorePages: () => void;
  onEditPageCrop: (pageId: string) => void;
  onExportSuccess: (documentId: string, pdfUri: string) => void;
  onBack: () => void;
  exportActionSlot?: React.ReactNode;
}

export const DocumentReviewPage: React.FC<DocumentReviewPageProps> = ({
  onAddMorePages,
  onEditPageCrop,
  onExportSuccess,
  onBack,
  exportActionSlot,
}) => {
  const controller = usePageCarouselController({
    onAddMorePages,
    onEditPageCrop,
    onExportSuccess,
    onBack,
  });

  return (
    <SafeScreenContainer>
      <PageCarouselEditor
        controller={controller}
        footerActionSlot={exportActionSlot}
      />
    </SafeScreenContainer>
  );
};

