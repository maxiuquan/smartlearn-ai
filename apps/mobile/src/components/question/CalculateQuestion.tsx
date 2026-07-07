import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { DrawingBoard } from '../common/DrawingBoard';
import { Question } from '../../types';
import { theme, spacing, borderRadius } from '../../utils/theme';

interface CalculateQuestionProps {
  question: Question;
  onAnswer: (answer: string) => void;
  showAnswer?: boolean;
  userAnswer?: string;
}

export const CalculateQuestion: React.FC<CalculateQuestionProps> = ({
  question,
  onAnswer,
  showAnswer = false,
  userAnswer,
}) => {
  const { colors } = useTheme();
  const [showDrawing, setShowDrawing] = useState(false);
  const [userInput, setUserInput] = useState(userAnswer ?? '');

  /**
   * Handle "查看答案" button press.
   * Submits the user's actual input for grading. If the user has not
   * entered anything, prompts them to input an answer first instead
   * of submitting an empty string (which would always be graded wrong).
   */
  const handleSubmitAnswer = () => {
    const trimmed = userInput.trim();
    if (!trimmed) {
      Alert.alert('提示', '请先输入答案', [{ text: '确定' }]);
      return;
    }
    onAnswer(trimmed);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.content, { color: colors.text }]}>{question.content}</Text>

      {showDrawing && !showAnswer && (
        <View style={styles.drawingSection}>
          <Text style={[styles.drawingLabel, { color: colors.textSecondary }]}>
            计算区域
          </Text>
          <DrawingBoard height={200} />
        </View>
      )}

      {/* Answer input field — only visible before the answer is revealed */}
      {!showAnswer && (
        <View style={styles.inputSection}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            你的答案
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={userInput}
            onChangeText={setUserInput}
            placeholder="请输入计算结果"
            placeholderTextColor={colors.textSecondary}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      {showAnswer && (
        <View style={styles.answerSection}>
          <View style={[styles.answerHeader, { backgroundColor: `${theme.colors.success}10` }]}>
            <Text style={[styles.answerLabel, { color: theme.colors.success }]}>
              参考答案
            </Text>
          </View>
          <View style={[styles.answerContent, { backgroundColor: colors.surfaceVariant }]}>
            <Text style={[styles.answerText, { color: colors.text }]}>
              {question.answer}
            </Text>
          </View>
          {userAnswer && (
            <Text style={[styles.userAnswerText, { color: colors.textSecondary }]}>
              你的答案: {userAnswer}
            </Text>
          )}
        </View>
      )}

      {showAnswer && (
        <View style={styles.analysisSection}>
          <Text style={[styles.analysisTitle, { color: colors.text }]}>
            解析
          </Text>
          <Text style={[styles.analysisText, { color: colors.textSecondary }]}>
            {question.analysis}
          </Text>
        </View>
      )}

      {!showAnswer && (
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={() => setShowDrawing(!showDrawing)}
            icon={showDrawing ? 'pencil-off' : 'pencil'}
          >
            {showDrawing ? '隐藏画板' : '显示画板'}
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmitAnswer}
          >
            查看答案
          </Button>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  content: {
    fontSize: 18,
    lineHeight: 28,
  },
  drawingSection: {
    gap: spacing.sm,
  },
  drawingLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  inputSection: {
    gap: spacing.sm,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    fontSize: 18,
    textAlign: 'center',
  },
  answerSection: {
    gap: spacing.sm,
  },
  answerHeader: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  answerContent: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  answerText: {
    fontSize: 16,
    lineHeight: 24,
  },
  userAnswerText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  analysisSection: {
    gap: spacing.sm,
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  analysisText: {
    fontSize: 14,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
