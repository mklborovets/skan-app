import React from 'react';
import {GestureResponderHandlers, StyleSheet, View} from 'react-native';
import {theme} from '@shared/config/theme';
import {Point2D} from '@shared/lib/geometry/pointInterpolation';

export interface DraggableCornerPinProps {
  point: Point2D;
  active: boolean;
  panHandlers: GestureResponderHandlers;
}

const PIN_RADIUS = 18;

export const DraggableCornerPin: React.FC<DraggableCornerPinProps> = ({
  point,
  active,
  panHandlers,
}) => {
  return (
    <View
      {...panHandlers}
      hitSlop={{top: 25, bottom: 25, left: 25, right: 25}}
      style={[
        styles.pinOuter,
        {
          left: point.x - PIN_RADIUS,
          top: point.y - PIN_RADIUS,
        },
        active && styles.pinActive,
      ]}>
      <View style={[styles.pinInner, active && styles.pinInnerActive]} />
    </View>
  );
};

const styles = StyleSheet.create({
  pinOuter: {
    position: 'absolute',
    width: PIN_RADIUS * 2,
    height: PIN_RADIUS * 2,
    borderRadius: PIN_RADIUS,
    backgroundColor: 'rgba(59, 130, 246, 0.28)',
    borderWidth: 2,
    borderColor: theme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinActive: {
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(16, 185, 129, 0.35)',
    transform: [{scale: 1.18}],
  },
  pinInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  pinInnerActive: {
    backgroundColor: theme.colors.accent,
  },
});

