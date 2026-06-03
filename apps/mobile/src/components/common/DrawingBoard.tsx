import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Dimensions, TouchableWithoutFeedback } from 'react-native';
import { Canvas, Skia, Path, Group, useFont, Text as SkiaText } from '@shopify/react-native-skia';
import { theme, spacing } from '../../utils/theme';

interface DrawingBoardProps {
  onSave?: (path: string) => void;
  onClear?: () => void;
  strokeColor?: string;
  strokeWidth?: number;
  height?: number;
}

interface StrokePoint {
  x: number;
  y: number;
}

export const DrawingBoard: React.FC<DrawingBoardProps> = ({
  onSave,
  strokeColor = '#000000',
  strokeWidth = 2,
  height = 300,
}) => {
  const [strokes, setStrokes] = useState<StrokePoint[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);
  const canvasWidth = Dimensions.get('window').width - spacing.md * 2;

  const addPoint = useCallback((x: number, y: number) => {
    setCurrentStroke((prev) => [...prev, { x, y }]);
  }, []);

  const finishStroke = useCallback(() => {
    if (currentStroke.length > 0) {
      setStrokes((prev) => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
  }, [currentStroke]);

  const clearCanvas = useCallback(() => {
    setStrokes([]);
    setCurrentStroke([]);
    onClear?.();
  }, [onClear]);

  const convertToPath = (points: StrokePoint[]): Skia.Path | null => {
    if (points.length < 2) return null;
    
    const path = Skia.Path.Make();
    path.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      path.quadTo(prev.x, prev.y, midX, midY);
    }
    
    return path;
  };

  const handleTouchStart = (x: number, y: number) => {
    setCurrentStroke([{ x, y }]);
  };

  const handleTouchMove = (x: number, y: number) => {
    if (currentStroke.length > 0) {
      addPoint(x, y);
    }
  };

  const handleTouchEnd = () => {
    finishStroke();
  };

  return (
    <View style={[styles.container, { height }]}>
      <TouchableWithoutFeedback
        onPressIn={(e) => {
          const touch = e.nativeEvent.touches[0] || e.nativeEvent;
          handleTouchStart(touch.locationX, touch.locationY);
        }}
        onPressOut={handleTouchEnd}
      >
        <Canvas style={{ width: canvasWidth, height }}>
          <Group>
            {/* Draw completed strokes */}
            {strokes.map((stroke, i) => {
              const path = convertToPath(stroke);
              if (!path) return null;
              return (
                <Path
                  key={`stroke-${i}`}
                  path={path}
                  color={strokeColor}
                  style="stroke"
                  strokeWidth={strokeWidth}
                  strokeCap="round"
                  strokeJoin="round"
                />
              );
            })}
            {/* Draw current stroke */}
            {currentStroke.length > 0 && (() => {
              const path = convertToPath(currentStroke);
              if (!path) return null;
              return (
                <Path
                  path={path}
                  color={strokeColor}
                  style="stroke"
                  strokeWidth={strokeWidth}
                  strokeCap="round"
                  strokeJoin="round"
                />
              );
            })()}
          </Group>
        </Canvas>
      </TouchableWithoutFeedback>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
