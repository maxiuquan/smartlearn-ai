import React, { useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { Question } from '../../types';
import { theme, spacing, borderRadius } from '../../utils/theme';

interface FillQuestionProps {
  question: Question;
  onAnswer: (answer: string) => void;
  showAnswer?: boolean;
  userAnswer?: string;
}

export const FillQuestion: React.FC<FillQuestionProps> = ({
  question,
  onAnswer,
  showAnswer = false,
  userAnswer,
}) => {
  const { colors } = useTheme();
  const [answer, setAnswer] = useState(userAnswer || '');

  const handleSubmit = () => {
    if (answer.trim()) {
      onAnswer(answer.trim());
    }
  };

  // Parse question content to find blanks
  const parts = question.content.split(/_{2,}/g);

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        {parts.map((part, index) => (
          <View key={index} style={styles.partRow}>
            <Text style={[styles.contentText, { color: colors.text }]}>
              {part}
            </Text>
            {index < parts.length - 1 && (
              showAnswer ? (
                <View
                  style={[
                    styles.answerBox,
                    {
                      backgroundColor: `${theme.colors.success}10`,
                      borderColor: theme.colors.success,
                    },
                  ]}
                >
                  <Text style={[styles.answerText, { color: theme.colors.success }]}>
                    {question.answer}
                  </Text>
                </View>
              ) : (
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder="填写答案"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                />
              )
            )}
          </View>
        ))}
      </View>

      {showAnswer && userAnswer && userAnswer !== question.answer && (
        <View style={[styles.wrongAnswer, { backgroundColor: `${theme.colors.error}10` }]}>
          <Text style={[styles.wrongLabel, { color: theme.colors.error }]}>
            你的答案:
          </Text>
          <Text style={[styles.wrongText, { color: theme.colors.error }]}>
            {userAnswer}
          </Text>
        </View>
      )}

      {!showAnswer && (
        <Button
          mode="contained"
          onPress={handleSubmit}
          disabled={!answer.trim()}
          style={styles.submitButton}
        >
          提交答案
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  contentContainer: {
    gap: spacing.sm,
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  contentText: {
    fontSize: 18,
    lineHeight: 28,
  },
  input: {
    minWidth: 120,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    fontSize: 16,
    textAlign: 'center',
  },
  answerBox: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  answerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  wrongAnswer: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  wrongLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  wrongText: {
    fontSize: 16,
    fontWeight: '500',
  },
  submitButton: {
    marginTop: spacing.md,
  },
});
