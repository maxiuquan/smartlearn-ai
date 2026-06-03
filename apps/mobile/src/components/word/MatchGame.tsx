import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Word } from '../../types';
import { theme, spacing, borderRadius } from '../../utils/theme';
import { shuffleArray } from '../../utils/helpers';

interface MatchGameProps {
  words: Word[];
  onComplete: (score: number) => void;
}

interface MatchPair {
  word: Word;
  matched: boolean;
  selected: boolean;
}

export const MatchGame: React.FC<MatchGameProps> = ({ words, onComplete }) => {
  const { colors } = useTheme();
  const [wordCards, setWordCards] = useState<MatchPair[]>([]);
  const [meaningCards, setMeaningCards] = useState<MatchPair[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedMeaning, setSelectedMeaning] = useState<string | null>(null);
  const [matches, setMatches] = useState(0);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    initializeGame();
  }, [words]);

  useEffect(() => {
    if (selectedWord && selectedMeaning) {
      checkMatch();
    }
  }, [selectedWord, selectedMeaning]);

  const initializeGame = () => {
    const wordPairs: MatchPair[] = words.map((word) => ({
      word,
      matched: false,
      selected: false,
    }));
    setWordCards(wordPairs);
    setMeaningCards(shuffleArray([...wordPairs]));
    setMatches(0);
    setAttempts(0);
    setSelectedWord(null);
    setSelectedMeaning(null);
  };

  const checkMatch = () => {
    setAttempts((prev) => prev + 1);

    const wordCard = wordCards.find((c) => c.word.id === selectedWord);
    const meaningCard = meaningCards.find((c) => c.word.id === selectedMeaning);

    if (wordCard && meaningCard && selectedWord === selectedMeaning) {
      // Correct match
      setWordCards((prev) =>
        prev.map((c) =>
          c.word.id === selectedWord ? { ...c, matched: true, selected: false } : c
        )
      );
      setMeaningCards((prev) =>
        prev.map((c) =>
          c.word.id === selectedMeaning ? { ...c, matched: true, selected: false } : c
        )
      );
      setMatches((prev) => prev + 1);

      // Check if game complete
      if (matches + 1 === words.length) {
        const score = Math.round(((matches + 1) / attempts) * 100);
        onComplete(score);
      }
    } else {
      // Wrong match - briefly show then reset
      setTimeout(() => {
        setWordCards((prev) =>
          prev.map((c) => ({ ...c, selected: false }))
        );
        setMeaningCards((prev) =>
          prev.map((c) => ({ ...c, selected: false }))
        );
        setSelectedWord(null);
        setSelectedMeaning(null);
      }, 500);
    }
  };

  const handleWordSelect = (wordId: string) => {
    if (wordCards.find((c) => c.word.id === wordId && c.matched)) return;
    
    setSelectedWord(wordId);
    setWordCards((prev) =>
      prev.map((c) =>
        c.word.id === wordId ? { ...c, selected: true } : { ...c, selected: false }
      )
    );
  };

  const handleMeaningSelect = (wordId: string) => {
    if (meaningCards.find((c) => c.word.id === wordId && c.matched)) return;
    
    setSelectedMeaning(wordId);
    setMeaningCards((prev) =>
      prev.map((c) =>
        c.word.id === wordId ? { ...c, selected: true } : { ...c, selected: false }
      )
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.progress, { color: colors.textSecondary }]}>
          已匹配: {matches}/{words.length}
        </Text>
        <Text style={[styles.attempts, { color: colors.textSecondary }]}>
          尝试: {attempts}
        </Text>
      </View>

      <View style={styles.gameArea}>
        <View style={styles.column}>
          {wordCards.map((card) => (
            <TouchableOpacity
              key={`word-${card.word.id}`}
              style={[
                styles.card,
                {
                  backgroundColor: card.matched
                    ? `${theme.colors.success}15`
                    : card.selected
                    ? `${theme.colors.primary}15`
                    : colors.surface,
                  borderColor: card.matched
                    ? theme.colors.success
                    : card.selected
                    ? theme.colors.primary
                    : colors.border,
                },
              ]}
              onPress={() => handleWordSelect(card.word.id)}
              disabled={card.matched}
            >
              <Text
                style={[
                  styles.cardText,
                  {
                    color: card.matched
                      ? theme.colors.success
                      : colors.text,
                  },
                ]}
              >
                {card.word.word}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.column}>
          {meaningCards.map((card) => (
            <TouchableOpacity
              key={`meaning-${card.word.id}`}
              style={[
                styles.card,
                {
                  backgroundColor: card.matched
                    ? `${theme.colors.success}15`
                    : card.selected
                    ? `${theme.colors.primary}15`
                    : colors.surface,
                  borderColor: card.matched
                    ? theme.colors.success
                    : card.selected
                    ? theme.colors.primary
                    : colors.border,
                },
              ]}
              onPress={() => handleMeaningSelect(card.word.id)}
              disabled={card.matched}
            >
              <Text
                style={[
                  styles.cardText,
                  {
                    color: card.matched
                      ? theme.colors.success
                      : colors.text,
                  },
                ]}
                numberOfLines={2}
              >
                {card.word.meaning}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
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
  progress: {
    fontSize: 14,
  },
  attempts: {
    fontSize: 14,
  },
  gameArea: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  column: {
    flex: 1,
    gap: spacing.sm,
  },
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  cardText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
