import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, useTheme, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from 'react-native-vector-icons';
import { QuestionRenderer } from '../../components';
import { useQuestionStore } from '../../stores';
import { questionService } from '../../services';
import { Question } from '../../types';
import { theme, spacing, borderRadius } from '../../utils/theme';

export const LearnScreen: React.FC = () => {
  const { colors } = useTheme();
  const {
    currentQuestion,
    currentIndex,
    questions,
    userAnswers,
    nextQuestion,
    previousQuestion,
    submitAnswer,
  } = useQuestionStore();

  const [showAnswer, setShowAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [questionType, setQuestionType] = useState<string>('all');
  const [startTime, setStartTime] = useState<number>(0);

  useEffect(() => {
    loadQuestions();
  }, [questionType]);

  const loadQuestions = async () => {
    setIsLoading(true);
    try {
      const params = questionType !== 'all' ? { type: questionType } : {};
      const response = await questionService.getRandomQuestions(10);
      useQuestionStore.getState().setQuestions(response);
    } catch (error) {
      console.error('Failed to load questions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!currentQuestion) return;

    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    submitAnswer(currentQuestion.id, answer, timeSpent);
    setShowAnswer(true);
  };

  const handleNext = () => {
    setShowAnswer(false);
    setStartTime(Date.now());
    nextQuestion();
  };

  const handlePrevious = () => {
    setShowAnswer(false);
    setStartTime(Date.now());
    previousQuestion();
  };

  const currentAnswer = currentQuestion
    ? userAnswers.get(currentQuestion.id)?.answer
    : undefined;

  const correctCount = Array.from(userAnswers.values()).filter((a) => a.isCorrect).length;
  const answeredCount = userAnswers.size;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          加载中...
        </Text>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="book-open-variant"
          size={64}
          color={colors.textSecondary}
        />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          暂无题目
        </Text>
        <Button mode="contained" onPress={loadQuestions}>
          加载题目
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <SegmentedButtons
          value={questionType}
          onValueChange={setQuestionType}
          buttons={[
            { value: 'all', label: '全部' },
            { value: 'choice', label: '选择' },
            { value: 'calculate', label: '计算' },
          ]}
          style={styles.segmentedButtons}
        />
        <View style={styles.progressInfo}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {currentIndex + 1} / {questions.length}
          </Text>
          <Text style={[styles.accuracyText, { color: theme.colors.success }]}>
            正确率: {answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0}%
          </Text>
        </View>
      </View>

      {/* Question */}
      <View style={styles.questionContainer}>
        <QuestionRenderer
          question={currentQuestion}
          onAnswer={handleAnswer}
          showAnswer={showAnswer}
          userAnswer={currentAnswer}
        />
      </View>

      {/* Navigation */}
      <View style={styles.navigation}>
        <Button
          mode="outlined"
          onPress={handlePrevious}
          disabled={currentIndex === 0}
          style={styles.navButton}
        >
          上一题
        </Button>
        {showAnswer ? (
          <Button
            mode="contained"
            onPress={handleNext}
            disabled={currentIndex >= questions.length - 1}
            style={styles.navButton}
          >
            下一题
          </Button>
        ) : (
          <Button
            mode="text"
            onPress={() => setShowAnswer(true)}
            style={styles.navButton}
          >
            查看答案
          </Button>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 16,
  },
  header: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  segmentedButtons: {
    backgroundColor: theme.colors.surface,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 14,
  },
  accuracyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  questionContainer: {
    flex: 1,
  },
  navigation: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  navButton: {
    flex: 1,
  },
});
