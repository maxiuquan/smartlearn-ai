import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Word } from '../../types';
import { theme, spacing, borderRadius } from '../../utils/theme';

interface WordRainGameProps {
  words: Word[];
  onComplete: (score: number) => void;
}

interface FallingWord {
  word: Word;
  x: number;
  y: number;
  speed: number;
}

const GAME_DURATION = 60; // seconds
const WORD_SPAWN_INTERVAL = 2000; // ms

export const WordRainGame: React.FC<WordRainGameProps> = ({ words, onComplete }) => {
  const { colors } = useTheme();
  const [fallingWords, setFallingWords] = useState<FallingWord[]>([]);
  const [currentMeaning, setCurrentMeaning] = useState<Word | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [gameActive, setGameActive] = useState(true);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());

  const screenWidth = Dimensions.get('window').width - spacing.md * 2;

  useEffect(() => {
    if (!gameActive) return;

    // Game timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameActive(false);
          onComplete(score);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameActive, score, onComplete]);

  useEffect(() => {
    if (!gameActive) return;

    // Spawn words
    const spawner = setInterval(() => {
      const availableWords = words.filter((w) => !usedWords.has(w.id));
      if (availableWords.length === 0) return;

      const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
      const newWord: FallingWord = {
        word: randomWord,
        x: Math.random() * (screenWidth - 100),
        y: 0,
        speed: 1 + Math.random() * 2,
      };

      setFallingWords((prev) => [...prev, newWord]);
    }, WORD_SPAWN_INTERVAL);

    return () => clearInterval(spawner);
  }, [gameActive, words, usedWords, screenWidth]);

  useEffect(() => {
    if (!gameActive) return;

    // Move words down
    const mover = setInterval(() => {
      setFallingWords((prev) => {
        const updated = prev
          .map((w) => ({ ...w, y: w.y + w.speed * 5 }))
          .filter((w) => w.y < 500);
        return updated;
      });
    }, 50);

    return () => clearInterval(mover);
  }, [gameActive]);

  useEffect(() => {
    // Set random meaning to match
    const availableWords = words.filter((w) => !usedWords.has(w.id));
    if (availableWords.length > 0 && !currentMeaning) {
      setCurrentMeaning(availableWords[Math.floor(Math.random() * availableWords.length)]);
    }
  }, [words, usedWords, currentMeaning]);

  const handleWordTap = (fallingWord: FallingWord) => {
    if (!currentMeaning) return;

    if (fallingWord.word.id === currentMeaning.id) {
      // Correct match
      setScore((prev) => prev + 10);
      setUsedWords((prev) => new Set([...prev, fallingWord.word.id]));
      setFallingWords((prev) => prev.filter((w) => w.word.id !== fallingWord.word.id));
      setCurrentMeaning(null);
    } else {
      // Wrong match
      setScore((prev) => Math.max(0, prev - 5));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.score, { color: theme.colors.primary }]}>
          得分: {score}
        </Text>
        <Text style={[styles.time, { color: colors.textSecondary }]}>
          时间: {timeLeft}s
        </Text>
      </View>

      {currentMeaning && (
        <View style={[styles.targetCard, { backgroundColor: colors.surfaceVariant }]}>
          <Text style={[styles.targetLabel, { color: colors.textSecondary }]}>
            找到这个单词:
          </Text>
          <Text style={[styles.targetMeaning, { color: colors.text }]}>
            {currentMeaning.meaning}
          </Text>
        </View>
      )}

      <View style={[styles.gameArea, { backgroundColor: colors.surface }]}>
        {fallingWords.map((fw, index) => (
          <TouchableOpacity
            key={`${fw.word.id}-${index}`}
            style={[
              styles.wordCard,
              {
                left: fw.x,
                top: fw.y,
                backgroundColor: theme.colors.primary,
              },
            ]}
            onPress={() => handleWordTap(fw)}
          >
            <Text style={styles.wordText}>{fw.word.word}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!gameActive && (
        <View style={styles.gameOver}>
          <Text style={[styles.gameOverText, { color: colors.text }]}>
            游戏结束! 得分: {score}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  score: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  time: {
    fontSize: 18,
  },
  targetCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  targetLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  targetMeaning: {
    fontSize: 16,
    fontWeight: '500',
  },
  gameArea: {
    height: 400,
    borderRadius: borderRadius.md,
    position: 'relative',
    overflow: 'hidden',
  },
  wordCard: {
    position: 'absolute',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  wordText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  gameOver: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  gameOverText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
