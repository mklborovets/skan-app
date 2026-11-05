import React from 'react';
import {
  LiveScannerViewport,
  useLiveScannerController,
} from '@widgets/live-scanner-viewport';
import {SafeScreenContainer} from '@shared/ui/layout/SafeScreenContainer';

export interface CameraScanPageProps {
  onPhotoCaptured: (pageId: string) => void;
  onReviewSession: () => void;
  onCancel: () => void;
}

export const CameraScanPage: React.FC<CameraScanPageProps> = ({
  onPhotoCaptured,
  onReviewSession,
  onCancel,
}) => {
  const controller = useLiveScannerController({
    onPhotoCaptured,
    onReviewSession,
    onCancel,
  });

  return (
    <SafeScreenContainer>
      <LiveScannerViewport controller={controller} />
    </SafeScreenContainer>
  );
};
