import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { theme, borderRadius } from '../../utils/theme';

interface ProgressBarProps {
  progress: number;
  height?: number;
  showLabel?: boolean;
  color?: string;
  backgroundColor?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 8,
  showLabel = false,
  color,
  backgroundColor,
}) => {
  const { colors } = useTheme();
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.track,
          {
            height,
            backgroundColor: backgroundColor || colors.surfaceVariant,
            borderRadius: height / 2,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${clampedProgress}%`,
              height,
              backgroundColor: color || theme.colors.primary,
              borderRadius: height / 2,
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={styles.label}>{`${Math.round(clampedProgress)}%`}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'right',
  },
});
