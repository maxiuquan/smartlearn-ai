import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { theme, spacing } from '../../utils/theme';

interface CountdownProps {
  targetDate: Date | string;
  onExpire?: () => void;
  showDays?: boolean;
  showHours?: boolean;
  showMinutes?: boolean;
  showSeconds?: boolean;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export const Countdown: React.FC<CountdownProps> = ({
  targetDate,
  onExpire,
  showDays = true,
  showHours = true,
  showMinutes = true,
  showSeconds = true,
}) => {
  const { colors } = useTheme();
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    total: 0,
  });

  useEffect(() => {
    const target = typeof targetDate === 'string' 
      ? new Date(targetDate) 
      : targetDate;

    const calculateTime = (): TimeRemaining => {
      const now = new Date();
      const total = target.getTime() - now.getTime();

      if (total <= 0) {
        onExpire?.();
        return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
      }

      return {
        days: Math.floor(total / (1000 * 60 * 60 * 24)),
        hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((total % (1000 * 60)) / 1000),
        total,
      };
    };

    setTimeRemaining(calculateTime());

    const interval = setInterval(() => {
      setTimeRemaining(calculateTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate, onExpire]);

  const renderUnit = (value: number, label: string, show: boolean) => {
    if (!show) return null;
    return (
      <View style={styles.unit}>
        <View style={[styles.valueContainer, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.value}>{String(value).padStart(2, '0')}</Text>
        </View>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderUnit(timeRemaining.days, '天', showDays)}
      {renderUnit(timeRemaining.hours, '时', showHours)}
      {renderUnit(timeRemaining.minutes, '分', showMinutes)}
      {renderUnit(timeRemaining.seconds, '秒', showSeconds)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  unit: {
    alignItems: 'center',
    gap: 4,
  },
  valueContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  label: {
    fontSize: 12,
  },
});
