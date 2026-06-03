import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, useTheme, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from 'react-native-vector-icons';
import { ProgressBar, QuickActionGrid, StatCard, Countdown } from '../../components';
import { useAuthStore, useStudyStore } from '../../stores';
import { theme, spacing, borderRadius } from '../../utils/theme';
import { formatDate, getDaysUntil } from '../../utils/dateUtils';

export const HomeScreen: React.FC = () => {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const { currentPlan, todayTasks, streak, getTodayProgress } = useStudyStore();
  const [refreshing, setRefreshing] = useState(false);

  const todayProgress = getTodayProgress();
  const examDate = currentPlan?.targetExamDate;
  const daysUntilExam = examDate ? getDaysUntil(examDate) : null;

  const onRefresh = async () => {
    setRefreshing(true);
    // Fetch latest data
    setTimeout(() => setRefreshing(false), 1000);
  };

  const quickActions = [
    {
      icon: 'book-open-variant',
      title: '开始答题',
      color: theme.colors.primary,
      onPress: () => {},
    },
    {
      icon: 'alphabetical-variant',
      title: '背单词',
      color: theme.colors.secondary,
      onPress: () => {},
    },
    {
      icon: 'file-document-outline',
      title: '真题训练',
      color: theme.colors.tertiary,
      onPress: () => {},
    },
    {
      icon: 'chart-line',
      title: '学习报告',
      color: theme.colors.info,
      onPress: () => {},
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.text }]}>
            你好, {user?.username || '同学'}
          </Text>
          <Text style={[styles.date, { color: colors.textSecondary }]}>
            {formatDate(new Date(), 'M月d日 EEEE')}
          </Text>
        </View>
        <View style={[styles.streakBadge, { backgroundColor: `${theme.colors.warning}15` }]}>
          <MaterialCommunityIcons
            name="fire"
            size={20}
            color={theme.colors.warning}
          />
          <Text style={[styles.streakText, { color: theme.colors.warning }]}>
            {streak}天
          </Text>
        </View>
      </View>

      {/* Exam Countdown */}
      {examDate && (
        <Card style={styles.countdownCard}>
          <View style={styles.countdownContent}>
            <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>
              距离考试还有
            </Text>
            <Countdown targetDate={examDate} showSeconds={false} />
          </View>
        </Card>
      )}

      {/* Today's Progress */}
      <Card style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressTitle, { color: colors.text }]}>
            今日进度
          </Text>
          <Text style={[styles.progressPercent, { color: theme.colors.primary }]}>
            {Math.round(todayProgress)}%
          </Text>
        </View>
        <ProgressBar progress={todayProgress} height={10} />
        <View style={styles.taskList}>
          {todayTasks.slice(0, 3).map((task) => (
            <View key={task.id} style={styles.taskItem}>
              <MaterialCommunityIcons
                name={task.completedCount >= task.targetCount ? 'check-circle' : 'circle-outline'}
                size={20}
                color={task.completedCount >= task.targetCount ? theme.colors.success : colors.textSecondary}
              />
              <Text
                style={[
                  styles.taskText,
                  { color: colors.text },
                  task.completedCount >= task.targetCount && styles.taskCompleted,
                ]}
              >
                {task.title}
              </Text>
              <Text style={[styles.taskCount, { color: colors.textSecondary }]}>
                {task.completedCount}/{task.targetCount}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          快速入口
        </Text>
        <QuickActionGrid actions={quickActions} columns={4} />
      </View>

      {/* Stats */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          学习统计
        </Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="今日答题"
            value="42"
            subtitle="道题目"
            color={theme.colors.primary}
          />
          <StatCard
            title="正确率"
            value="85%"
            subtitle="较昨日+5%"
            color={theme.colors.success}
            trend={{ value: 5, isPositive: true }}
          />
          <StatCard
            title="学习时长"
            value="1.5"
            subtitle="小时"
            color={theme.colors.tertiary}
          />
          <StatCard
            title="单词掌握"
            value="128"
            subtitle="个单词"
            color={theme.colors.secondary}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  date: {
    fontSize: 14,
    marginTop: 4,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '600',
  },
  countdownCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  countdownContent: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  countdownLabel: {
    fontSize: 14,
  },
  progressCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  taskList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  taskText: {
    flex: 1,
    fontSize: 14,
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  taskCount: {
    fontSize: 12,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
