import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Canvas, Skia, Path, Group } from '@shopify/react-native-skia';
import { theme } from '../../utils/theme';

interface RadarChartProps {
  data: {
    label: string;
    value: number;
  }[];
  size?: number;
  maxValue?: number;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  size = 200,
  maxValue = 100,
}) => {
  const { colors } = useTheme();
  const center = size / 2;
  const radius = (size / 2) - 30;
  const angleStep = (2 * Math.PI) / data.length;

  const getPoint = (index: number, value: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / maxValue) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Generate grid lines
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const gridPaths = gridLevels.map((level) => {
    const points = data.map((_, i) => getPoint(i, maxValue * level));
    const path = Skia.Path.Make();
    points.forEach((point, i) => {
      if (i === 0) {
        path.moveTo(point.x, point.y);
      } else {
        path.lineTo(point.x, point.y);
      }
    });
    path.close();
    return path;
  });

  // Generate data polygon
  const dataPoints = data.map((item, i) => getPoint(i, item.value));
  const dataPath = Skia.Path.Make();
  dataPoints.forEach((point, i) => {
    if (i === 0) {
      dataPath.moveTo(point.x, point.y);
    } else {
      dataPath.lineTo(point.x, point.y);
    }
  });
  dataPath.close();

  // Generate axis lines
  const axisLines = data.map((_, i) => {
    const point = getPoint(i, radius);
    const path = Skia.Path.Make();
    path.moveTo(center, center);
    path.lineTo(point.x, point.y);
    return path;
  });

  // Label positions
  const labels = data.map((item, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const labelRadius = radius + 20;
    return {
      label: item.label,
      x: center + labelRadius * Math.cos(angle),
      y: center + labelRadius * Math.sin(angle),
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }}>
        <Group>
          {/* Grid lines */}
          {gridPaths.map((path, i) => (
            <Path
              key={`grid-${i}`}
              path={path}
              color={colors.border}
              style="stroke"
              strokeWidth={1}
            />
          ))}
          {/* Axis lines */}
          {axisLines.map((path, i) => (
            <Path
              key={`axis-${i}`}
              path={path}
              color={colors.border}
              style="stroke"
              strokeWidth={1}
            />
          ))}
          {/* Data polygon */}
          <Path
            path={dataPath}
            color={theme.colors.primary}
            style="fill"
            opacity={0.3}
          />
          <Path
            path={dataPath}
            color={theme.colors.primary}
            style="stroke"
            strokeWidth={2}
          />
          {/* Data points */}
          {dataPoints.map((point, i) => (
            <Path
              key={`point-${i}`}
              path={Skia.Path.Make().addCircle(point.x, point.y, 4)}
              color={theme.colors.primary}
              style="fill"
            />
          ))}
        </Group>
      </Canvas>
      {/* Labels */}
      {labels.map((item, i) => (
        <Text
          key={`label-${i}`}
          style={[
            styles.label,
            {
              left: item.x,
              top: item.y,
              color: colors.textSecondary,
            },
          ]}
        >
          {item.label}
        </Text>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  label: {
    position: 'absolute',
    fontSize: 10,
    textAlign: 'center',
    transform: [{ translateX: -20 }, { translateY: -6 }],
    width: 40,
  },
});
