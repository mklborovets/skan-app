import {create} from 'zustand';
import {
  FilterPresetId,
  OcrTextBlock,
  QuadCornersDto,
} from '@shared/api/native-modules';
import {ScannedPage} from './types';

export interface ScanSessionState {
  sessionId: string;
  activeDocumentTitle: string;
  pages: ScannedPage[];
  activePageId: string | null;
  startNewSession: (title?: string) => void;
  loadExistingPages: (
    sessionId: string,
    title: string,
    pages: ScannedPage[],
  ) => void;
  setDocumentTitle: (title: string) => void;
  addCapturedPage: (page: ScannedPage) => void;
  setActivePageId: (pageId: string | null) => void;
  updatePageCropAndFilter: (params: {
    pageId: string;
    processedUri: string;
    corners: QuadCornersDto;
    filterPreset: FilterPresetId;
    width?: number;
    height?: number;
  }) => void;
  updatePageOcrResult: (
    pageId: string,
    ocrText: string,
    ocrBlocks: OcrTextBlock[],
  ) => void;
  reorderSessionPages: (fromIndex: number, toIndex: number) => void;
  removeSessionPage: (pageId: string) => ScannedPage | undefined;
  clearSession: () => void;
}

const createSessionId = (): string => `doc_${Date.now()}`;

const createDefaultDocumentTitle = (): string => {
  const iso = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return `Scan ${iso}`;
};

export const useScanSessionStore = create<ScanSessionState>((set, get) => ({
  sessionId: createSessionId(),
  activeDocumentTitle: createDefaultDocumentTitle(),
  pages: [],
  activePageId: null,

  startNewSession: (title?: string) => {
    set({
      sessionId: createSessionId(),
      activeDocumentTitle: title ?? createDefaultDocumentTitle(),
      pages: [],
      activePageId: null,
    });
  },

  loadExistingPages: (
    sessionId: string,
    title: string,
    pages: ScannedPage[],
  ) => {
    const firstPage = pages[0];
    set({
      sessionId,
      activeDocumentTitle: title,
      pages,
      activePageId: firstPage ? firstPage.id : null,
    });
  },

  setDocumentTitle: (title: string) => {
    set({activeDocumentTitle: title});
  },

  addCapturedPage: (page: ScannedPage) => {
    set(state => {
      const nextPages = [
        ...state.pages,
        {...page, pageIndex: state.pages.length},
      ];
      return {
        pages: nextPages,
        activePageId: page.id,
      };
    });
  },

  setActivePageId: (pageId: string | null) => {
    set({activePageId: pageId});
  },

  updatePageCropAndFilter: ({
    pageId,
    processedUri,
    corners,
    filterPreset,
    width,
    height,
  }) => {
    set(state => ({
      pages: state.pages.map(page =>
        page.id === pageId
          ? {
              ...page,
              processedUri,
              corners,
              filterPreset,
              width: width ?? page.width,
              height: height ?? page.height,
            }
          : page,
      ),
    }));
  },

  updatePageOcrResult: (pageId, ocrText, ocrBlocks) => {
    set(state => ({
      pages: state.pages.map(page =>
        page.id === pageId
          ? {
              ...page,
              ocrText,
              ocrBlocks,
            }
          : page,
      ),
    }));
  },

  reorderSessionPages: (fromIndex: number, toIndex: number) => {
    set(state => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.pages.length ||
        toIndex >= state.pages.length ||
        fromIndex === toIndex
      ) {
        return state;
      }
      const next = [...state.pages];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) {
        return state;
      }
      next.splice(toIndex, 0, moved);
      return {
        pages: next.map((page, index) => ({
          ...page,
          pageIndex: index,
        })),
      };
    });
  },

  removeSessionPage: (pageId: string) => {
    const existing = get().pages.find(p => p.id === pageId);
    set(state => {
      const filtered = state.pages
        .filter(p => p.id !== pageId)
        .map((page, idx) => ({...page, pageIndex: idx}));
      const nextActive =
        state.activePageId === pageId
          ? (filtered[0]?.id ?? null)
          : state.activePageId;
      return {
        pages: filtered,
        activePageId: nextActive,
      };
    });
    return existing;
  },

  clearSession: () => {
    set({
      sessionId: createSessionId(),
      activeDocumentTitle: createDefaultDocumentTitle(),
      pages: [],
      activePageId: null,
    });
  },
}));
