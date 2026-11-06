import {TurboModule, TurboModuleRegistry} from 'react-native';

interface NativeClipboardSpec extends TurboModule {
  getString(): Promise<string>;
  setString(content: string): void;
}

const NativeClipboard =
  TurboModuleRegistry.get<NativeClipboardSpec>('Clipboard');

export const copyTextToClipboard = (text: string): void => {
  if (!text) {
    return;
  }
  if (NativeClipboard?.setString) {
    NativeClipboard.setString(text);
  }
};

