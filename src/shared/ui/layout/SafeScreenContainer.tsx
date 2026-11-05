import React from 'react';
import {
  StatusBar,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {theme} from '@shared/config/theme';

export interface SafeScreenContainerProps {
  children: React.ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const SafeScreenContainer: React.FC<SafeScreenContainerProps> = ({
  children,
  padded = false,
  style,
}) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={theme.colors.background}
      />
      <View style={[styles.container, padded && styles.padded, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  padded: {
    paddingHorizontal: theme.spacing.md,
  },
});

