import React, {useCallback, useState} from 'react';
import {useScanSessionStore} from '@entities/scanned-page';
import {
  ExportPdfButton,
  usePdfExportPipeline,
} from '@features/export-searchable-pdf';
import {CameraScanPage} from '@pages/camera-scan-page';
import {CropEditPage} from '@pages/crop-edit-page';
import {DocumentReviewPage} from '@pages/document-review-page';
import {LibraryPage} from '@pages/library-page';
import {PdfPreviewPage} from '@pages/pdf-preview-page';
import {NavigationRouteState} from './types';

export const RootNavigator: React.FC = () => {
  const [route, setRoute] = useState<NavigationRouteState>({
    screen: 'Library',
  });

  const sessionPages = useScanSessionStore(state => state.pages);
  const {isExporting, progressText, exportCurrentSessionToPdf} =
    usePdfExportPipeline();

  const handleExportSession = useCallback(async () => {
    const savedDoc = await exportCurrentSessionToPdf();
    if (savedDoc) {
      setRoute({
        screen: 'PdfPreview',
        activeDocumentId: savedDoc.id,
      });
    }
  }, [exportCurrentSessionToPdf]);

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
    return (
      <PdfPreviewPage
        documentId={route.activeDocumentId}
        onEditDocument={() => setRoute({screen: 'DocumentReview'})}
        onBackToLibrary={() => setRoute({screen: 'Library'})}
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
