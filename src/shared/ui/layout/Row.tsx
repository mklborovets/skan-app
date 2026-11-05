import React from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {theme} from '@shared/config/theme';

export interface RowProps {
  children: React.ReactNode;
  justify?: ViewStyle['justifyContent'];
  align?: ViewStyle['alignItems'];
  gap?: keyof typeof theme.spacing;
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Row: React.FC<RowProps> = ({
  children,
  justify = 'flex-start',
  align = 'center',
  gap = 'sm',
  wrap = false,
  style,
}) => {
  return (
    <View
      style={[
        styles.row,
        {
          justifyContent: justify,
          alignItems: align,
          gap: theme.spacing[gap],
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
});
