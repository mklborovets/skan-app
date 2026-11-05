import React from 'react';
import {
  InteractiveCropBoard,
  useInteractiveCropController,
} from '@widgets/interactive-crop-board';
import {SafeScreenContainer} from '@shared/ui/layout/SafeScreenContainer';

export interface CropEditPageProps {
  pageId: string;
  onCropApplied: () => void;
  onCancel: () => void;
}

export const CropEditPage: React.FC<CropEditPageProps> = ({
  pageId,
  onCropApplied,
  onCancel,
}) => {
  const controller = useInteractiveCropController({
    pageId,
    onApplyCompleted: onCropApplied,
    onCancel,
  });

  return (
    <SafeScreenContainer>
      <InteractiveCropBoard controller={controller} />
    </SafeScreenContainer>
  );
};
