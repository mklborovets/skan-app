import {create} from 'zustand';
import {documentRepository} from './documentRepository';
import {ScannedDocument} from './types';

export interface DocumentStoreState {
  documents: ScannedDocument[];
  searchResults: ScannedDocument[] | null;
  isLoading: boolean;
  refreshDocuments: () => Promise<void>;
  saveDocumentRecord: (doc: ScannedDocument) => Promise<void>;
  deleteDocumentRecord: (documentId: string) => Promise<void>;
  setSearchResults: (results: ScannedDocument[] | null) => void;
}

export const useDocumentStore = create<DocumentStoreState>(set => ({
  documents: [],
  searchResults: null,
  isLoading: false,

  refreshDocuments: async () => {
    set({isLoading: true});
    try {
      const list = await documentRepository.listDocuments();
      set({documents: list, isLoading: false});
    } catch {
      set({isLoading: false});
    }
  },

  saveDocumentRecord: async (doc: ScannedDocument) => {
    await documentRepository.upsertDocument(doc);
    const list = await documentRepository.listDocuments();
    set({documents: list});
  },

  deleteDocumentRecord: async (documentId: string) => {
    await documentRepository.deleteDocumentWithFiles(documentId);
    const list = await documentRepository.listDocuments();
    set(state => ({
      documents: list,
      searchResults: state.searchResults
        ? state.searchResults.filter(item => item.id !== documentId)
        : null,
    }));
  },

  setSearchResults: (results: ScannedDocument[] | null) => {
    set({searchResults: results});
  },
}));

