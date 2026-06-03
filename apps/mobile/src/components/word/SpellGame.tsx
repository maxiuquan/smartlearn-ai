import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Keyboard } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { Word } from '../../types';
import { theme, spacing, borderRadius } from '../../utils/theme';

interface SpellGameProps {
  words: Word[];
  onComplete: (score: number) => void;
}

export const SpellGame: React.FC<SpellGameProps> = ({ words, onComplete }) => {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [hints, setHints] = useState(0);

  const currentWord = words[currentIndex];

  useEffect(() => {
    if (currentIndex >= words.length) {
      const score = Math.round((correctCount / words.length) * 100);
      onComplete(score);
    }
  }, [currentIndex, words.length, correctCount, onComplete]);

  const checkAnswer = () => {
    Keyboard.dismiss();
    const correct = input.toLowerCase().trim() === currentWord.word.toLowerCase();
    setIsCorrect(correct);
    setShowResult(true);

    if (correct) {
      setCorrectCount((prev) => prev + 1);
    }
  };

  const nextWord = () => {
    setShowResult(false);
    setInput('');
    setCurrentIndex((prev) => prev + 1);
  };

  const getHint = () => {
    const word = currentWord.word;
    const visibleChars = Math.min(hints + 1, Math.floor(word.length / 2));
    setHints(visibleChars);
  };

  const getDisplayWord = () => {
    const word = currentWord.word;
    if (hints === 0) return '_'.repeat(word.length);
    
    let display = '';
    for (let i = 0; i < word.length; i++) {
      if (i < hints) {
        display += word[i];
      } else {
        display += '_';
      }
    }
    return display;
  };

  if (!currentWord) {
    return (
      <View style={styles.container}>
        <Text style={[styles.complete, { color: colors.text }]}>
          完成!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.progress}>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {currentIndex + 1} / {words.length}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${((currentIndex + 1) / words.length) * 100}%`,
                backgroundColor: theme.colors.primary,
              },
            ]}
          />
        </View>
      </View>

      <View style={[styles.meaningCard, { backgroundColor: colors.surfaceVariant }]}>
        <Text style={[styles.meaningLabel, { color: colors.textSecondary }]}>
          释义
        </Text>
        <Text style={[styles.meaning, { color: colors.text }]}>
          {currentWord.meaning}
        </Text>
      </View>

      {hints > 0 && (
        <Text style={[styles.hint, { color: theme.colors.primary }]}>
          提示: {getDisplayWord()}
        </Text>
      )}

      {!showResult ? (
        <View style={styles.inputArea}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={input}
            onChangeText={setInput}
            placeholder="输入单词"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.actions}>
            <Button mode="outlined" onPress={getHint} disabled={hints >= Math.floor(currentWord.word.length / 2)}>
              提示
            </Button>
            <Button mode="contained" onPress={checkAnswer} disabled={!input.trim()}>
              检查
            </Button>
          </View>
        </View>
      ) : (
        <View style={styles.result}>
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: isCorrect
                  ? `${theme.colors.success}15`
                  : `${theme.colors.error}15`,
              },
            ]}
          >
            <Text
              style={[
                styles.resultText,
                { color: isCorrect ? theme.colors.success : theme.colors.error },
              ]}
            >
              {isCorrect ? '正确!' : '错误'}
            </Text>
            {!isCorrect && (
              <Text style={[styles.correctAnswer, { color: colors.text }]}>
                正确答案: {currentWord.word}
              </Text>
            )}
          </View>
          <Button mode="contained" onPress={nextWord}>
            下一个
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
  progress: {
    gap: spacing.sm,
  },
  progressText: {
    fontSize: 14,
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  meaningCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  meaningLabel: {
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  meaning: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  hint: {
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  inputArea: {
    gap: spacing.md,
  },
  input: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    fontSize: 18,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  result: {
    gap: spacing.md,
  },
  resultCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  resultText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  correctAnswer: {
    fontSize: 16,
    marginTop: spacing.sm,
  },
  complete: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
