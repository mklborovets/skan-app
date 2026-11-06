import React from 'react';
import { pageRepository, useScanSessionStore } from '@entities/scanned-page';
import { ExportPdfButton } from '@features/export-searchable-pdf';
import { CameraScanPage } from '@pages/camera-scan-page';
import { CropEditPage } from '@pages/crop-edit-page';
import { DocumentReviewPage } from '@pages/document-review-page';
import { LibraryPage } from '@pages/library-page';
import { PdfPreviewPage } from '@pages/pdf-preview-page';
import { deleteFileIfExists } from '@shared/lib/file-system/tempFileCleaner';
import { PrimaryButton } from '@shared/ui/button/PrimaryButton';
import { useRootNavigationController } from './useRootNavigationController';

export const RootNavigator: React.FC = () => {
  const {
    route,
    setRoute,
    sessionPages,
    isExporting,
    progressText,
    handleExportSession,
    handleEditDocumentFromPreview,
    handleRunBenchmark,
  } = useRootNavigationController();

  if (route.screen === 'CameraScan') {
    return (
      <CameraScanPage
        onPhotoCaptured={pageId =>
          setRoute({
            screen: 'CropEdit',
            activePageId: pageId,
            fromScreen: 'CameraScan',
          })
        }
        onReviewSession={() => setRoute({ screen: 'DocumentReview' })}
        onCancel={() =>
          setRoute({
            screen: sessionPages.length > 0 ? 'DocumentReview' : 'Library',
          })
        }
      />
    );
  }

  if (route.screen === 'CropEdit' && route.activePageId) {
    const handleCropCancel = async () => {
      const activeId = route.activePageId!;
      if (route.fromScreen === 'CameraScan') {
        const removed = useScanSessionStore
          .getState()
          .removeSessionPage(activeId);
        if (removed) {
          await deleteFileIfExists(removed.rawUri);
          if (removed.processedUri && removed.processedUri !== removed.rawUri) {
            await deleteFileIfExists(removed.processedUri);
          }
          try {
            await pageRepository.deletePageById(activeId);
          } catch {
            return;
          }
        }
        setRoute({ screen: 'CameraScan' });
      } else {
        setRoute({ screen: 'DocumentReview' });
      }
    };

    return (
      <CropEditPage
        pageId={route.activePageId}
        onCropApplied={() => setRoute({ screen: 'DocumentReview' })}
        onCancel={() => {
          void handleCropCancel();
        }}
      />
    );
  }

  if (route.screen === 'DocumentReview') {
    return (
      <DocumentReviewPage
        onAddMorePages={() => setRoute({ screen: 'CameraScan' })}
        onEditPageCrop={pageId =>
          setRoute({
            screen: 'CropEdit',
            activePageId: pageId,
            fromScreen: 'DocumentReview',
          })
        }
        onExportSuccess={documentId =>
          setRoute({ screen: 'PdfPreview', activeDocumentId: documentId })
        }
        onBack={() => setRoute({ screen: 'Library' })}
        exportActionSlot={
          <ExportPdfButton
            pageCount={sessionPages.length}
            isExporting={isExporting}
            progressText={progressText}
            onPress={() => {
              void handleExportSession();
            }}
          />
        }
      />
    );
  }

  if (route.screen === 'PdfPreview' && route.activeDocumentId) {
    const docId = route.activeDocumentId;
    return (
      <PdfPreviewPage
        documentId={docId}
        onEditDocument={() => {
          void handleEditDocumentFromPreview(docId);
        }}
        onBackToLibrary={() => setRoute({ screen: 'Library' })}
        extraActionsSlot={
          <PrimaryButton
            label="ML Kit Benchmark"
            icon="scanLine"
            variant="secondary"
            onPress={() => {
              void handleRunBenchmark(docId);
            }}
          />
        }
      />
    );
  }

  return (
    <LibraryPage
      onStartNewScan={() => setRoute({ screen: 'CameraScan' })}
      onOpenDocumentPreview={documentId =>
        setRoute({ screen: 'PdfPreview', activeDocumentId: documentId })
      }
    />
  );
};
