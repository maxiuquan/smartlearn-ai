import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Button, useTheme, RadioButton } from 'react-native-paper';
import { Question, QuestionOption } from '../../types';
import { theme, spacing, borderRadius } from '../../utils/theme';

interface ChoiceQuestionProps {
  question: Question;
  onAnswer: (answer: string) => void;
  showAnswer?: boolean;
  userAnswer?: string;
}

export const ChoiceQuestion: React.FC<ChoiceQuestionProps> = ({
  question,
  onAnswer,
  showAnswer = false,
  userAnswer,
}) => {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string>(userAnswer || '');

  useEffect(() => {
    if (userAnswer) {
      setSelected(userAnswer);
    }
  }, [userAnswer]);

  const handleSelect = (optionId: string) => {
    if (!showAnswer) {
      setSelected(optionId);
    }
  };

  const handleSubmit = () => {
    if (selected) {
      onAnswer(selected);
    }
  };

  const getOptionStyle = (option: QuestionOption) => {
    if (!showAnswer) {
      return selected === option.id
        ? { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}10` }
        : { borderColor: colors.border, backgroundColor: colors.surface };
    }

    const isCorrect = option.id === question.answer;
    const isUserChoice = option.id === selected;

    if (isCorrect) {
      return { borderColor: theme.colors.success, backgroundColor: `${theme.colors.success}10` };
    }
    if (isUserChoice && !isCorrect) {
      return { borderColor: theme.colors.error, backgroundColor: `${theme.colors.error}10` };
    }
    return { borderColor: colors.border, backgroundColor: colors.surface };
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.content, { color: colors.text }]}>{question.content}</Text>
      
      <View style={styles.options}>
        {question.options?.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.option, getOptionStyle(option)]}
            onPress={() => handleSelect(option.id)}
            disabled={showAnswer}
          >
            <View style={styles.optionHeader}>
              <View
                style={[
                  styles.optionLabel,
                  {
                    backgroundColor: selected === option.id
                      ? theme.colors.primary
                      : colors.surfaceVariant,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionLabelText,
                    {
                      color: selected === option.id ? '#FFFFFF' : colors.text,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </View>
              {showAnswer && option.id === question.answer && (
                <Text style={[styles.correctBadge, { color: theme.colors.success }]}>
                  正确答案
                </Text>
              )}
            </View>
            <Text style={[styles.optionContent, { color: colors.text }]}>
              {option.content}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!showAnswer && (
        <Button
          mode="contained"
          onPress={handleSubmit}
          disabled={!selected}
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
  content: {
    fontSize: 18,
    lineHeight: 28,
  },
  options: {
    gap: spacing.md,
  },
  option: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  optionLabel: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  correctBadge: {
    fontSize: 12,
    fontWeight: '500',
  },
  optionContent: {
    fontSize: 16,
    lineHeight: 24,
  },
  submitButton: {
    marginTop: spacing.md,
  },
});
