import {useCallback} from 'react';
import {Linking} from 'react-native';
import {useCameraPermission as useVisionCameraPermission} from 'react-native-vision-camera';

export interface CameraPermissionState {
  hasPermission: boolean;
  ensurePermission: () => Promise<boolean>;
  openSettings: () => Promise<void>;
}

export const useCameraPermission = (): CameraPermissionState => {
  const {hasPermission, requestPermission} = useVisionCameraPermission();

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (hasPermission) {
      return true;
    }
    return requestPermission();
  }, [hasPermission, requestPermission]);

  const openSettings = useCallback(async (): Promise<void> => {
    await Linking.openSettings();
  }, []);

  return {
    hasPermission,
    ensurePermission,
    openSettings,
  };
};
