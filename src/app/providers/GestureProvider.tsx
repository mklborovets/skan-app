import React from 'react';
import {StyleSheet, View} from 'react-native';

export interface GestureProviderProps {
  children: React.ReactNode;
}

export const GestureProvider: React.FC<GestureProviderProps> = ({children}) => {
  return <View style={styles.root}>{children}</View>;
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

