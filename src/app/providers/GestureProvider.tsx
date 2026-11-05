import React from 'react';
import {StyleSheet} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

export interface GestureProviderProps {
  children: React.ReactNode;
}

export const GestureProvider: React.FC<GestureProviderProps> = ({children}) => {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>{children}</SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

