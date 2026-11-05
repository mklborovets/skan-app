import React from 'react';
import {
  DocumentLibraryList,
  useDocumentLibraryController,
} from '@widgets/document-library-list';
import {SafeScreenContainer} from '@shared/ui/layout/SafeScreenContainer';

export interface LibraryPageProps {
  onStartNewScan: () => void;
  onOpenDocumentPreview: (documentId: string) => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  onStartNewScan,
  onOpenDocumentPreview,
}) => {
  const controller = useDocumentLibraryController({
    onStartNewScan,
    onOpenDocumentPreview,
  });

  return (
    <SafeScreenContainer>
      <DocumentLibraryList controller={controller} />
    </SafeScreenContainer>
  );
};
