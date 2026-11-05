import React from 'react';
import {ExportPdfButton} from '@features/export-searchable-pdf';
import {CameraScanPage} from '@pages/camera-scan-page';
import {CropEditPage} from '@pages/crop-edit-page';
import {DocumentReviewPage} from '@pages/document-review-page';
import {LibraryPage} from '@pages/library-page';
import {PdfPreviewPage} from '@pages/pdf-preview-page';
import {PrimaryButton} from '@shared/ui/button/PrimaryButton';
import {Row} from '@shared/ui/layout/Row';
import {useRootNavigationController} from './useRootNavigationController';

export const RootNavigator: React.FC = () => {
  const {
    route,
    setRoute,
    sessionPages,
    isExporting,
    progressText,
    handleExportSession,
    handleDriveExport,
    handleRunBenchmark,
  } = useRootNavigationController();

  if (route.screen === 'CameraScan') {
    return (
      <CameraScanPage
        onPhotoCaptured={pageId =>
          setRoute({screen: 'CropEdit', activePageId: pageId})
        }
        onReviewSession={() => setRoute({screen: 'DocumentReview'})}
        onCancel={() =>
          setRoute({
            screen: sessionPages.length > 0 ? 'DocumentReview' : 'Library',
          })
        }
      />
    );
  }

  if (route.screen === 'CropEdit' && route.activePageId) {
    return (
      <CropEditPage
        pageId={route.activePageId}
        onCropApplied={() => setRoute({screen: 'DocumentReview'})}
        onCancel={() => setRoute({screen: 'DocumentReview'})}
      />
    );
  }

  if (route.screen === 'DocumentReview') {
    return (
      <DocumentReviewPage
        onAddMorePages={() => setRoute({screen: 'CameraScan'})}
        onEditPageCrop={pageId =>
          setRoute({screen: 'CropEdit', activePageId: pageId})
        }
        onExportSuccess={documentId =>
          setRoute({screen: 'PdfPreview', activeDocumentId: documentId})
        }
        onBack={() => setRoute({screen: 'Library'})}
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
        onEditDocument={() => setRoute({screen: 'DocumentReview'})}
        onBackToLibrary={() => setRoute({screen: 'Library'})}
        extraActionsSlot={
          <Row justify="space-between">
            <PrimaryButton
              label="Google Drive"
              icon="cloudUpload"
              variant="secondary"
              onPress={() => {
                void handleDriveExport(docId);
              }}
            />
            <PrimaryButton
              label="ML Kit Benchmark"
              icon="scanLine"
              variant="secondary"
              onPress={() => {
                void handleRunBenchmark(docId);
              }}
            />
          </Row>
        }
      />
    );
  }

  return (
    <LibraryPage
      onStartNewScan={() => setRoute({screen: 'CameraScan'})}
      onOpenDocumentPreview={documentId =>
        setRoute({screen: 'PdfPreview', activeDocumentId: documentId})
      }
    />
  );
};
