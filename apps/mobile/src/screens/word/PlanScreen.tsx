import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, useTheme, Card, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from 'react-native-vector-icons';
import { Countdown, ProgressBar } from '../../components';
import { useStudyStore, useAuthStore } from '../../stores';
import { studyService } from '../../services';
import { StudyPlan, StudyTask } from '../../types';
import { theme, spacing, borderRadius } from '../../utils/theme';
import { formatDate, getDaysUntil, formatDuration } from '../../utils/dateUtils';

export const PlanScreen: React.FC = () => {
  const { colors } = useTheme();
  const { currentPlan, todayTasks, totalStudyTime, getTodayProgress } = useStudyStore();
  const user = useAuthStore((state) => state.user);

  const [isLoading, setIsLoading] = useState(false);

  const todayProgress = getTodayProgress();
  const examDate = currentPlan?.targetExamDate;
  const daysUntilExam = examDate ? getDaysUntil(examDate) : null;

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const today = new Date();
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - today.getDay() + i);
    return date;
  });

  const weeklyStats = [
    { day: '周一', value: 45, color: theme.colors.primary },
    { day: '周二', value: 60, color: theme.colors.primary },
    { day: '周三', value: 30, color: theme.colors.primary },
    { day: '周四', value: 75, color: theme.colors.primary },
    { day: '周五', value: 50, color: theme.colors.primary },
    { day: '周六', value: 90, color: theme.colors.secondary },
    { day: '周日', value: 20, color: theme.colors.secondary },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>学习规划</Text>
      </View>

      {/* Exam Countdown */}
      {examDate && (
        <Card style={styles.countdownCard}>
          <View style={styles.countdownHeader}>
            <MaterialCommunityIcons
              name="calendar-clock"
              size={24}
              color={theme.colors.primary}
            />
            <Text style={[styles.countdownTitle, { color: colors.text }]}>
              考试倒计时
            </Text>
          </View>
          <View style={styles.countdownContent}>
            <Text style={[styles.examDate, { color: colors.textSecondary }]}>
              {formatDate(examDate, 'yyyy年M月d日')}
            </Text>
            <Countdown targetDate={examDate} showSeconds={false} />
          </View>
        </Card>
      )}

      {/* Today's Plan */}
      <Card style={styles.planCard}>
        <View style={styles.planHeader}>
          <Text style={[styles.planTitle, { color: colors.text }]}>
            今日计划
          </Text>
          <Text style={[styles.planDate, { color: colors.textSecondary }]}>
            {formatDate(today, 'M月d日 EEEE')}
          </Text>
        </View>

        <View style={styles.progressSection}>
          <ProgressBar progress={todayProgress} height={10} showLabel />
        </View>

        <View style={styles.taskList}>
          {todayTasks.map((task, index) => (
            <View key={task.id}>
              <View style={styles.taskItem}>
                <View style={styles.taskIcon}>
                  <MaterialCommunityIcons
                    name={
                      task.type === 'question'
                        ? 'help-circle'
                        : task.type === 'word'
                        ? 'alphabetical-variant'
                        : task.type === 'review'
                        ? 'refresh'
                        : 'video'
                    }
                    size={20}
                    color={
                      task.completedCount >= task.targetCount
                        ? theme.colors.success
                        : theme.colors.primary
                    }
                  />
                </View>
                <View style={styles.taskInfo}>
                  <Text
                    style={[
                      styles.taskTitle,
                      { color: colors.text },
                      task.completedCount >= task.targetCount && styles.taskCompleted,
                    ]}
                  >
                    {task.title}
                  </Text>
                  <Text style={[styles.taskEstimate, { color: colors.textSecondary }]}>
                    预计 {formatDuration(task.estimatedTime)}
                  </Text>
                </View>
                <View style={styles.taskProgress}>
                  <Text
                    style={[
                      styles.taskProgressText,
                      {
                        color:
                          task.completedCount >= task.targetCount
                            ? theme.colors.success
                            : theme.colors.primary,
                      },
                    ]}
                  >
                    {task.completedCount}/{task.targetCount}
                  </Text>
                </View>
              </View>
              {index < todayTasks.length - 1 && (
                <Divider style={styles.taskDivider} />
              )}
            </View>
          ))}
        </View>
      </Card>

      {/* Weekly Overview */}
      <Card style={styles.weeklyCard}>
        <View style={styles.weeklyHeader}>
          <Text style={[styles.weeklyTitle, { color: colors.text }]}>
            本周概览
          </Text>
        </View>

        <View style={styles.weekCalendar}>
          {weekDates.map((date, index) => {
            const isToday = date.toDateString() === today.toDateString();
            const stat = weeklyStats[index];
            return (
              <View key={index} style={styles.dayColumn}>
                <Text
                  style={[
                    styles.dayName,
                    {
                      color: isToday ? theme.colors.primary : colors.textSecondary,
                    },
                  ]}
                >
                  {weekDays[index]}
                </Text>
                <View
                  style={[
                    styles.dayCircle,
                    {
                      backgroundColor: isToday
                        ? theme.colors.primary
                        : colors.surfaceVariant,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      {
                        color: isToday ? '#FFFFFF' : colors.text,
                      },
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.dayBar,
                    {
                      backgroundColor: colors.surfaceVariant,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.dayBarFill,
                      {
                        height: `${stat.value}%`,
                        backgroundColor: stat.color,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.weeklyStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatDuration(totalStudyTime)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              总学习时长
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>7</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              连续学习天数
            </Text>
          </View>
        </View>
      </Card>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={() => {}}
          style={styles.actionButton}
          icon="calendar-edit"
        >
          编辑计划
        </Button>
        <Button
          mode="contained"
          onPress={() => {}}
          style={styles.actionButton}
          icon="play"
        >
          开始今日学习
        </Button>
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
  header: {},
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  countdownCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  countdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  countdownTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  countdownContent: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  examDate: {
    fontSize: 14,
  },
  planCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  planDate: {
    fontSize: 14,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  taskList: {},
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  taskIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  taskEstimate: {
    fontSize: 12,
    marginTop: 2,
  },
  taskProgress: {},
  taskProgressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  taskDivider: {
    marginVertical: spacing.xs,
  },
  weeklyCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  weeklyHeader: {
    marginBottom: spacing.md,
  },
  weeklyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  weekCalendar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dayColumn: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  dayName: {
    fontSize: 12,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  dayBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    overflow: 'hidden',
  },
  dayBarFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 2,
  },
  weeklyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.border,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});
