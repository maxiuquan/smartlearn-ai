import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Question } from '../../types';
import { ChoiceQuestion } from './ChoiceQuestion';
import { FillQuestion } from './FillQuestion';
import { CalculateQuestion } from './CalculateQuestion';
import { theme, spacing, borderRadius } from '../../utils/theme';

interface QuestionRendererProps {
  question: Question;
  onAnswer: (answer: string) => void;
  showAnswer?: boolean;
  userAnswer?: string;
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  onAnswer,
  showAnswer = false,
  userAnswer,
}) => {
  const { colors } = useTheme();

  const renderQuestion = () => {
    switch (question.type) {
      case 'choice':
        return (
          <ChoiceQuestion
            question={question}
            onAnswer={onAnswer}
            showAnswer={showAnswer}
            userAnswer={userAnswer}
          />
        );
      case 'fill':
        return (
          <FillQuestion
            question={question}
            onAnswer={onAnswer}
            showAnswer={showAnswer}
            userAnswer={userAnswer}
          />
        );
      case 'calculate':
        return (
          <CalculateQuestion
            question={question}
            onAnswer={onAnswer}
            showAnswer={showAnswer}
            userAnswer={userAnswer}
          />
        );
      case 'proof':
        return (
          <CalculateQuestion
            question={question}
            onAnswer={onAnswer}
            showAnswer={showAnswer}
            userAnswer={userAnswer}
          />
        );
      default:
        return (
          <Text style={{ color: colors.textSecondary }}>
            不支持的题目类型
          </Text>
        );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.tags}>
          <View
            style={[
              styles.typeTag,
              { backgroundColor: `${theme.colors.primary}15` },
            ]}
          >
            <Text style={[styles.typeText, { color: theme.colors.primary }]}>
              {getTypeLabel(question.type)}
            </Text>
          </View>
          <View
            style={[
              styles.difficultyTag,
              {
                backgroundColor: `${getDifficultyColor(question.difficulty)}15`,
              },
            ]}
          >
            <Text
              style={[
                styles.difficultyText,
                { color: getDifficultyColor(question.difficulty) },
              ]}
            >
              {getDifficultyLabel(question.difficulty)}
            </Text>
          </View>
        </View>
      </View>
      {renderQuestion()}
    </ScrollView>
  );
};

const getTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    choice: '选择题',
    fill: '填空题',
    calculate: '计算题',
    proof: '证明题',
  };
  return labels[type] || type;
};

const getDifficultyLabel = (difficulty: string): string => {
  const labels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  };
  return labels[difficulty] || difficulty;
};

const getDifficultyColor = (difficulty: string): string => {
  const colors: Record<string, string> = {
    easy: theme.colors.success,
    medium: theme.colors.warning,
    hard: theme.colors.error,
  };
  return colors[difficulty] || theme.colors.primary;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  tags: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  difficultyTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
