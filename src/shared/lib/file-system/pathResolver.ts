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

export const buildExportedPdfFilePath = (documentId: string): string =>
  `${getExportedPdfsDirPath()}/doc_${documentId}_${Date.now()}.pdf`;

