import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Text, useTheme, Card, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from 'react-native-vector-icons';
import { studyService } from '../../services';
import { PastExam } from '../../types';
import { theme, spacing, borderRadius } from '../../utils/theme';

export const PastExamScreen: React.FC = () => {
  const { colors } = useTheme();
  const [pastExams, setPastExams] = useState<PastExam[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadPastExams();
  }, []);

  const loadPastExams = async () => {
    setIsLoading(true);
    try {
      const exams = await studyService.getPastExams();
      setPastExams(exams);
    } catch (error) {
      console.error('Failed to load past exams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupedExams = pastExams.reduce((acc, exam) => {
    const year = exam.year;
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(exam);
    return acc;
  }, {} as Record<number, PastExam[]>);

  const years = Object.keys(groupedExams)
    .map(Number)
    .sort((a, b) => b - a);

  const renderExamCard = (exam: PastExam) => (
    <Card key={exam.id} style={styles.examCard}>
      <View style={styles.examContent}>
        <View style={styles.examInfo}>
          <Text style={[styles.examSubject, { color: colors.text }]}>
            {exam.subject}
          </Text>
          <Text style={[styles.examDetails, { color: colors.textSecondary }]}>
            {exam.totalQuestions}题 · {exam.duration}分钟
          </Text>
        </View>
        {exam.completed ? (
          <View style={styles.scoreContainer}>
            <Text
              style={[
                styles.score,
                {
                  color:
                    (exam.score ?? 0) >= 90
                      ? theme.colors.success
                      : (exam.score ?? 0) >= 60
                      ? theme.colors.warning
                      : theme.colors.error,
                },
              ]}
            >
              {exam.score}
            </Text>
            <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>
              分
            </Text>
          </View>
        ) : (
          <Button mode="contained" compact onPress={() => {}}>
            开始
          </Button>
        )}
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>历年真题</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          选择真题进行模拟训练
        </Text>
      </View>

      <FlatList
        data={years}
        keyExtractor={(item) => item.toString()}
        renderItem={({ item: year }) => (
          <View style={styles.yearSection}>
            <View style={styles.yearHeader}>
              <Text style={[styles.yearText, { color: colors.text }]}>
                {year}年
              </Text>
              <View style={[styles.yearLine, { backgroundColor: colors.border }]} />
            </View>
            <View style={styles.examList}>
              {groupedExams[year].map(renderExamCard)}
            </View>
          </View>
        )}
        contentContainerStyle={styles.content}
        refreshing={isLoading}
        onRefresh={loadPastExams}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.md,
  },
  yearSection: {
    marginBottom: spacing.lg,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  yearText: {
    fontSize: 18,
    fontWeight: '600',
  },
  yearLine: {
    flex: 1,
    height: 1,
  },
  examList: {
    gap: spacing.sm,
  },
  examCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  examContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examInfo: {
    flex: 1,
  },
  examSubject: {
    fontSize: 16,
    fontWeight: '500',
  },
  examDetails: {
    fontSize: 12,
    marginTop: 4,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  score: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 14,
  },
});
