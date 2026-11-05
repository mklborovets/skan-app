import {useCallback, useState} from 'react';
import {pageRepository, useScanSessionStore} from '@entities/scanned-page';
import {
  FilterPresetId,
  warpAndFilterImage,
} from '@shared/api/native-modules';
import {
  buildProcessedPageFilePath,
  ensureFileUriPrefix,
} from '@shared/lib/file-system/pathResolver';
import {deleteFileIfExists} from '@shared/lib/file-system/tempFileCleaner';
import {IconName} from '@shared/ui/icon/iconRegistry';

export interface FilterPresetOption {
  id: FilterPresetId;
  label: string;
  icon: IconName;
}

export const FILTER_PRESET_OPTIONS: readonly FilterPresetOption[] = [
  {id: 'bw_document', label: 'B&W Doc', icon: 'fileText'},
  {id: 'enhanced_color', label: 'Enhanced', icon: 'sparkles'},
  {id: 'grayscale', label: 'Grayscale', icon: 'contrast'},
  {id: 'original', label: 'Original', icon: 'image'},
] as const;

export interface ImageFilterProcessorState {
  isApplyingFilter: boolean;
  applyFilterToActivePage: (preset: FilterPresetId) => Promise<void>;
}

export const useImageFilterProcessor = (): ImageFilterProcessorState => {
  const [isApplyingFilter, setIsApplyingFilter] = useState<boolean>(false);
  const activePageId = useScanSessionStore(state => state.activePageId);
  const pages = useScanSessionStore(state => state.pages);
  const updatePageCropAndFilter = useScanSessionStore(
    state => state.updatePageCropAndFilter,
  );

  const applyFilterToActivePage = useCallback(
    async (preset: FilterPresetId) => {
      const targetPage =
        pages.find(p => p.id === activePageId) ?? pages[0] ?? null;
      if (!targetPage || targetPage.filterPreset === preset) {
        return;
      }

      setIsApplyingFilter(true);
      try {
        const previousProcessedUri = targetPage.processedUri;
        const nextOutputPath = buildProcessedPageFilePath(
          targetPage.id,
          preset,
        );

        const result = await warpAndFilterImage({
          inputUri: targetPage.rawUri,
          outputUri: ensureFileUriPrefix(nextOutputPath),
          corners: targetPage.corners,
          preset,
        });

        const nextWidth = result.width > 0 ? result.width : targetPage.width;
        const nextHeight = result.height > 0 ? result.height : targetPage.height;

        updatePageCropAndFilter({
          pageId: targetPage.id,
          processedUri: result.outputUri,
          corners: targetPage.corners,
          filterPreset: preset,
          width: nextWidth,
          height: nextHeight,
        });

        await pageRepository.upsertPage({
          ...targetPage,
          processedUri: result.outputUri,
          filterPreset: preset,
          width: nextWidth,
          height: nextHeight,
        });

        if (
          previousProcessedUri !== targetPage.rawUri &&
          previousProcessedUri !== result.outputUri
        ) {
          await deleteFileIfExists(previousProcessedUri);
        }
      } catch {
        return;
      } finally {
        setIsApplyingFilter(false);
      }
    },
    [activePageId, pages, updatePageCropAndFilter],
  );

  return {
    isApplyingFilter,
    applyFilterToActivePage,
  };
};

