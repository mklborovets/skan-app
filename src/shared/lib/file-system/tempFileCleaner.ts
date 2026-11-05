import RNFS from 'react-native-fs';
import {
  getProcessedPagesDirPath,
  getRawScansDirPath,
  stripFileUriPrefix,
} from './pathResolver';

export const deleteFileIfExists = async (
  pathOrUri: string | null | undefined,
): Promise<void> => {
  if (!pathOrUri) {
    return;
  }
  const cleanPath = stripFileUriPrefix(pathOrUri);
  const exists = await RNFS.exists(cleanPath);
  if (exists) {
    await RNFS.unlink(cleanPath);
  }
};

export const deleteMultipleFiles = async (
  pathsOrUris: readonly string[],
): Promise<void> => {
  for (const uri of pathsOrUris) {
    await deleteFileIfExists(uri);
  }
};

export const purgeRawScanCache = async (
  activeUrisToPreserve: readonly string[] = [],
): Promise<number> => {
  const rawDir = getRawScansDirPath();
  const exists = await RNFS.exists(rawDir);
  if (!exists) {
    return 0;
  }

  const preserveSet = new Set(
    activeUrisToPreserve.map(uri => stripFileUriPrefix(uri)),
  );
  const entries = await RNFS.readDir(rawDir);
  let removedCount = 0;

  for (const item of entries) {
    if (item.isFile() && !preserveSet.has(item.path)) {
      await RNFS.unlink(item.path);
      removedCount += 1;
    }
  }

  return removedCount;
};

export const getDirectoryStorageSizeBytes = async (
  dirPath: string,
): Promise<number> => {
  const exists = await RNFS.exists(dirPath);
  if (!exists) {
    return 0;
  }
  const items = await RNFS.readDir(dirPath);
  return items.reduce((sum, item) => sum + (item.isFile() ? item.size : 0), 0);
};

export const getTotalScanStorageBytes = async (): Promise<number> => {
  const [rawBytes, processedBytes] = await Promise.all([
    getDirectoryStorageSizeBytes(getRawScansDirPath()),
    getDirectoryStorageSizeBytes(getProcessedPagesDirPath()),
  ]);
  return rawBytes + processedBytes;
};
