import RNFS from 'react-native-fs';

const RAW_SCANS_FOLDER = 'skan_raw_cache';
const PROCESSED_PAGES_FOLDER = 'skan_processed_pages';
const EXPORTED_PDFS_FOLDER = 'skan_exported_pdfs';

export const ensureFileUriPrefix = (pathOrUri: string): string => {
  if (pathOrUri.startsWith('file://')) {
    return pathOrUri;
  }
  return `file://${pathOrUri}`;
};

export const stripFileUriPrefix = (pathOrUri: string): string => {
  if (pathOrUri.startsWith('file://')) {
    return pathOrUri.slice('file://'.length);
  }
  return pathOrUri;
};

export const normalizePersistentPath = (
  pathOrUri: string | null | undefined,
): string | null => {
  if (!pathOrUri) {
    return null;
  }
  const clean = stripFileUriPrefix(pathOrUri).trim();
  if (!clean || clean === 'file://') {
    return null;
  }

  const processedMarker = `/${PROCESSED_PAGES_FOLDER}/`;
  const procIdx = clean.indexOf(processedMarker);
  if (procIdx !== -1) {
    const filename = clean.slice(procIdx + processedMarker.length);
    return ensureFileUriPrefix(`${getProcessedPagesDirPath()}/${filename}`);
  }

  const rawMarker = `/${RAW_SCANS_FOLDER}/`;
  const rawIdx = clean.indexOf(rawMarker);
  if (rawIdx !== -1) {
    const filename = clean.slice(rawIdx + rawMarker.length);
    return ensureFileUriPrefix(`${getRawScansDirPath()}/${filename}`);
  }

  const pdfMarker = `/${EXPORTED_PDFS_FOLDER}/`;
  const pdfIdx = clean.indexOf(pdfMarker);
  if (pdfIdx !== -1) {
    const filename = clean.slice(pdfIdx + pdfMarker.length);
    return ensureFileUriPrefix(`${getExportedPdfsDirPath()}/${filename}`);
  }

  const docMarker = '/Documents/';
  const docIdx = clean.indexOf(docMarker);
  if (docIdx !== -1) {
    const relativeSubpath = clean.slice(docIdx + docMarker.length);
    return ensureFileUriPrefix(`${RNFS.DocumentDirectoryPath}/${relativeSubpath}`);
  }

  const cacheMarker = '/Library/Caches/';
  const cacheIdx = clean.indexOf(cacheMarker);
  if (cacheIdx !== -1) {
    const relativeSubpath = clean.slice(cacheIdx + cacheMarker.length);
    return ensureFileUriPrefix(`${RNFS.CachesDirectoryPath}/${relativeSubpath}`);
  }

  return ensureFileUriPrefix(clean);
};

export const getRawScansDirPath = (): string =>
  `${RNFS.CachesDirectoryPath}/${RAW_SCANS_FOLDER}`;

export const getProcessedPagesDirPath = (): string =>
  `${RNFS.DocumentDirectoryPath}/${PROCESSED_PAGES_FOLDER}`;

export const getExportedPdfsDirPath = (): string =>
  `${RNFS.DocumentDirectoryPath}/${EXPORTED_PDFS_FOLDER}`;

export const ensureAppStorageDirectories = async (): Promise<void> => {
  const dirs = [
    getRawScansDirPath(),
    getProcessedPagesDirPath(),
    getExportedPdfsDirPath(),
  ];

  for (const dir of dirs) {
    const exists = await RNFS.exists(dir);
    if (!exists) {
      await RNFS.mkdir(dir);
    }
  }
};

export const buildRawScanFilePath = (pageId: string): string =>
  `${getRawScansDirPath()}/raw_${pageId}_${Date.now()}.jpg`;

export const buildProcessedPageFilePath = (
  pageId: string,
  preset: string,
): string =>
  `${getProcessedPagesDirPath()}/page_${pageId}_${preset}_${Date.now()}.jpg`;

export const buildExportedPdfFilePath = (documentId: string): string => {
  const sanitizedId = documentId.replace(/^doc_/, '');
  return `${getExportedPdfsDirPath()}/doc_${sanitizedId}_${Date.now()}.pdf`;
};

