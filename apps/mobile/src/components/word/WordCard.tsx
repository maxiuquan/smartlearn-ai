import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from 'react-native-vector-icons';
import { Word } from '../../types';
import { theme, spacing, borderRadius } from '../../utils/theme';

interface WordCardProps {
  word: Word;
  showMeaning?: boolean;
  onFlip?: () => void;
  onMark?: (correct: boolean) => void;
}

export const WordCard: React.FC<WordCardProps> = ({
  word,
  showMeaning = false,
  onFlip,
  onMark,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface }]}
        onPress={onFlip}
      >
        <View style={styles.content}>
          <Text style={[styles.word, { color: colors.text }]}>
            {showMeaning ? word.meaning : word.word}
          </Text>
          {!showMeaning && (
            <Text style={[styles.phonetic, { color: colors.textSecondary }]}>
              {word.phonetic}
            </Text>
          )}
          {showMeaning && word.example && (
            <View style={styles.exampleSection}>
              <Text style={[styles.example, { color: colors.textSecondary }]}>
                {word.example}
              </Text>
              <Text style={[styles.exampleTranslation, { color: colors.textTertiary }]}>
                {word.exampleTranslation}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          点击{showMeaning ? '查看单词' : '查看释义'}
        </Text>
      </TouchableOpacity>

      {onMark && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: `${theme.colors.error}15` }]}
            onPress={() => onMark(false)}
          >
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={theme.colors.error}
            />
            <Text style={[styles.actionText, { color: theme.colors.error }]}>
              不认识
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: `${theme.colors.success}15` }]}
            onPress={() => onMark(true)}
          >
            <MaterialCommunityIcons
              name="check"
              size={24}
              color={theme.colors.success}
            />
            <Text style={[styles.actionText, { color: theme.colors.success }]}>
              认识
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  card: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  word: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  phonetic: {
    fontSize: 16,
  },
  exampleSection: {
    marginTop: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  example: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  exampleTranslation: {
    fontSize: 12,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
