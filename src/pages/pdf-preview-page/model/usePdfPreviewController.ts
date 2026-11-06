import {useCallback, useEffect, useState} from 'react';
import {copyTextToClipboard} from '@shared/lib/clipboard/clipboardHelper';
import {
  documentRepository,
  ScannedDocument,
  useDocumentStore,
} from '@entities/document';
import {
  pageRepository,
  ScannedPage,
  useScanSessionStore,
} from '@entities/scanned-page';
import {
  generateSearchablePdfOnDevice,
  recognizeTextWithMlKit,
  sharePdfFileNative,
} from '@shared/api/native-modules';
import {SCAN_CONSTANTS} from '@shared/config/scanConstants';
import {
  buildExportedPdfFilePath,
  ensureAppStorageDirectories,
} from '@shared/lib/file-system/pathResolver';

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
  isCopied: boolean;
  setShowOcrModal: (visible: boolean) => void;
  onCopyAllOcrText: () => void;
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
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      let [doc, docPages] = await Promise.all([
        documentRepository.getDocumentById(documentId),
        pageRepository.getPagesByDocumentId(documentId),
      ]);

      if (docPages.length === 0) {
        const sessionState = useScanSessionStore.getState();
        if (
          sessionState.sessionId === documentId &&
          sessionState.pages.length > 0
        ) {
          docPages = sessionState.pages;
          for (const page of docPages) {
            await pageRepository.upsertPage(
              page,
              doc?.title ?? sessionState.activeDocumentTitle,
            );
          }
          doc = await documentRepository.getDocumentById(documentId);
        }
      }

      if (!active) {
        return;
      }
      setDocument(doc);
      setPages(docPages);

      const missingOcrPages = docPages.filter(p => !p.ocrText.trim());
      if (missingOcrPages.length > 0) {
        const updatedPages = [...docPages];
        let anyUpdated = false;
        for (let i = 0; i < updatedPages.length; i += 1) {
          const p = updatedPages[i];
          if (!p || p.ocrText.trim()) {
            continue;
          }
          try {
            let ocr = await recognizeTextWithMlKit(p.processedUri);
            if (
              !ocr.fullText.trim() &&
              p.rawUri &&
              p.rawUri !== p.processedUri
            ) {
              ocr = await recognizeTextWithMlKit(p.rawUri);
            }
            if (ocr.fullText.trim()) {
              anyUpdated = true;
              updatedPages[i] = {
                ...p,
                ocrText: ocr.fullText,
                ocrBlocks: ocr.blocks,
              };
              await pageRepository.updatePageOcrText(
                p.documentId,
                p.id,
                ocr.fullText,
                ocr.blocks,
              );
            }
          } catch {
            continue;
          }
        }
        if (active && anyUpdated) {
          setPages(updatedPages);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [documentId]);

  const onSharePdf = useCallback(async () => {
    if (!document) {
      return;
    }
    let pdfPath = document.pdfPath;
    if (!pdfPath && pages.length > 0) {
      await ensureAppStorageDirectories();
      const outputFilePath = buildExportedPdfFilePath(document.id);
      const pdfRes = await generateSearchablePdfOnDevice({
        outputFilePath,
        title: document.title,
        jpegQuality: SCAN_CONSTANTS.PDF_JPEG_QUALITY,
        pages: pages.map(p => ({
          pageId: p.id,
          processedUri: p.processedUri,
          ocrBlocks: p.ocrBlocks,
        })),
      });
      pdfPath = pdfRes.pdfUri;
      const updatedDoc: ScannedDocument = {
        ...document,
        pdfPath,
        updatedAt: Date.now(),
      };
      await useDocumentStore.getState().saveDocumentRecord(updatedDoc);
      setDocument(updatedDoc);
    }
    if (!pdfPath) {
      return;
    }
    await sharePdfFileNative(pdfPath, document.title);
  }, [document, pages]);

  const combinedOcrText = pages
    .map((p, idx) => `--- Page ${idx + 1} ---\n${p.ocrText || '(No text)'}`)
    .join('\n\n');

  const onCopyAllOcrText = useCallback(() => {
    if (!combinedOcrText.trim()) {
      return;
    }
    copyTextToClipboard(combinedOcrText);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  }, [combinedOcrText]);

  return {
    document,
    pages,
    showOcrModal,
    combinedOcrText,
    isCopied,
    setShowOcrModal,
    onCopyAllOcrText,
    onSharePdf,
    onEditDocument,
    onBackToLibrary,
  };
};

