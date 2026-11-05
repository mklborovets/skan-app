import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Polygon} from 'react-native-svg';
import {buildSvgPolygonPoints, ScanQuad} from '@entities/scan-quad';
import {theme} from '@shared/config/theme';

export interface QuadOverlaySvgProps {
  quad: ScanQuad | null;
  width: number;
  height: number;
  isStable?: boolean;
}

export const QuadOverlaySvg: React.FC<QuadOverlaySvgProps> = ({
  quad,
  width,
  height,
  isStable = false,
}) => {
  if (!quad || width <= 0 || height <= 0) {
    return null;
  }

  const pointsAttr = buildSvgPolygonPoints(quad);
  const strokeColor = isStable
    ? theme.colors.quadStroke
    : theme.colors.quadUnstableStroke;
  const fillColor = isStable
    ? theme.colors.quadFill
    : theme.colors.quadUnstableFill;
  const corners = [
    quad.topLeft,
    quad.topRight,
    quad.bottomRight,
    quad.bottomLeft,
  ];

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Svg width={width} height={height}>
        <Polygon
          points={pointsAttr}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        {corners.map((pt, index) => (
          <Circle
            key={`corner_${index}`}
            cx={pt.x}
            cy={pt.y}
            r={6}
            fill={strokeColor}
            stroke={theme.colors.textPrimary}
            strokeWidth={2}
          />
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
