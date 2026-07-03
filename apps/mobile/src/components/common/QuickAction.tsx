import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from 'react-native-vector-icons';
import { theme, spacing, borderRadius } from '../../utils/theme';

interface QuickActionProps {
  icon: string;
  title: string;
  subtitle?: string;
  color?: string;
  onPress: () => void;
}

export const QuickAction: React.FC<QuickActionProps> = ({
  icon,
  title,
  subtitle,
  color,
  onPress,
}) => {
  const { colors } = useTheme();
  const iconColor = color || theme.colors.primary;

  return (
    <TouchableRipple
      onPress={onPress}
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
          <MaterialCommunityIcons name={icon} size={24} color={iconColor} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          )}
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={colors.textSecondary}
        />
      </View>
    </TouchableRipple>
  );
};

interface QuickActionGridProps {
  actions: QuickActionProps[];
  columns?: number;
}

export const QuickActionGrid: React.FC<QuickActionGridProps> = ({
  actions,
  columns = 2,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.grid}>
      {actions.map((action, index) => (
        <TouchableRipple
          key={index}
          onPress={action.onPress}
          style={[
            styles.gridItem,
            { backgroundColor: colors.surface },
            { width: `${100 / columns - 2}%` },
          ]}
        >
          <View style={styles.gridContent}>
            <View
              style={[
                styles.gridIconContainer,
                { backgroundColor: `${action.color || theme.colors.primary}15` },
              ]}
            >
              <MaterialCommunityIcons
                name={action.icon}
                size={28}
                color={action.color || theme.colors.primary}
              />
            </View>
            <Text
              style={[styles.gridTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {action.title}
            </Text>
          </View>
        </TouchableRipple>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  gridContent: {
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  gridIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
