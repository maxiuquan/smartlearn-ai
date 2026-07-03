import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { theme, spacing, borderRadius } from '../../utils/theme';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
}) => {
  const { colors } = useTheme();
  const accentColor = color || theme.colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
        {icon && <View style={styles.iconWrapper}>{icon}</View>}
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
        {trend && (
          <View
            style={[
              styles.trendBadge,
              {
                backgroundColor: trend.isPositive
                  ? `${theme.colors.success}15`
                  : `${theme.colors.error}15`,
              },
            ]}
          >
            <Text
              style={[
                styles.trendText,
                {
                  color: trend.isPositive
                    ? theme.colors.success
                    : theme.colors.error,
                },
              ]}
            >
              {trend.isPositive ? '+' : ''}{trend.value}%
            </Text>
          </View>
        )}
      </View>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      )}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
    </View>
  );
};

interface StatGridProps {
  stats: StatCardProps[];
  columns?: number;
}

export const StatGrid: React.FC<StatGridProps> = ({ stats, columns = 2 }) => {
  return (
    <View style={styles.grid}>
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  trendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: spacing.xs,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    right: 0,
    height: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
