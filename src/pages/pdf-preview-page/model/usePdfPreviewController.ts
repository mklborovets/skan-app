import {useCallback, useEffect, useState} from 'react';
import {Share} from 'react-native';
import {
  documentRepository,
  ScannedDocument,
} from '@entities/document';
import {
  pageRepository,
  ScannedPage,
} from '@entities/scanned-page';

export interface UsePdfPreviewControllerParams {
  documentId: string;
  onEditDocument: () => void;
  onBackToLibrary: () => void;
}

export interface PdfPreviewControllerState {
  document: ScannedDocument | null;
  pages: ScannedPage[];
  showOcrModal: boolean;
  combinedOcrText: string;
  setShowOcrModal: (visible: boolean) => void;
  onSharePdf: () => Promise<void>;
  onEditDocument: () => void;
  onBackToLibrary: () => void;
}

export const usePdfPreviewController = ({
  documentId,
  onEditDocument,
  onBackToLibrary,
}: UsePdfPreviewControllerParams): PdfPreviewControllerState => {
  const [document, setDocument] = useState<ScannedDocument | null>(null);
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [showOcrModal, setShowOcrModal] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [doc, docPages] = await Promise.all([
        documentRepository.getDocumentById(documentId),
        pageRepository.getPagesByDocumentId(documentId),
      ]);
      if (active) {
        setDocument(doc);
        setPages(docPages);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [documentId]);

  const onSharePdf = useCallback(async () => {
    if (!document?.pdfPath) {
      return;
    }
    await Share.share({
      title: document.title,
      url: document.pdfPath,
      message: `${document.title} (${document.pdfPath})`,
    });
  }, [document]);

  const combinedOcrText = pages
    .map((p, idx) => `--- Page ${idx + 1} ---\n${p.ocrText || '(No text)'}`)
    .join('\n\n');

  return {
    document,
    pages,
    showOcrModal,
    combinedOcrText,
    setShowOcrModal,
    onSharePdf,
    onEditDocument,
    onBackToLibrary,
  };
};
