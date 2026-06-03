import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, useTheme, Button, SegmentedButtons, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from 'react-native-vector-icons';
import { WordCard, MatchGame, SpellGame, WordRainGame } from '../../components';
import { ProgressBar } from '../../components';
import { useWordStore } from '../../stores';
import { wordService } from '../../services';
import { Word } from '../../types';
import { theme, spacing, borderRadius } from '../../utils/theme';

type Mode = 'learn' | 'review' | 'games';
type GameType = 'none' | 'match' | 'spell' | 'rain';

export const WordScreen: React.FC = () => {
  const { colors } = useTheme();
  const {
    words,
    currentWord,
    currentIndex,
    dailyGoal,
    dailyLearned,
    nextWord,
    markWord,
  } = useWordStore();

  const [mode, setMode] = useState<Mode>('learn');
  const [gameType, setGameType] = useState<GameType>('none');
  const [showMeaning, setShowMeaning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadWords();
  }, [mode]);

  const loadWords = async () => {
    setIsLoading(true);
    try {
      let loadedWords: Word[];
      if (mode === 'review') {
        loadedWords = await wordService.getWordsToReview();
      } else {
        loadedWords = await wordService.getDailyWords(dailyGoal);
      }
      useWordStore.getState().setWords(loadedWords);
    } catch (error) {
      console.error('Failed to load words:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMark = (correct: boolean) => {
    if (currentWord) {
      markWord(currentWord.id, correct);
      setShowMeaning(false);
      nextWord();
    }
  };

  const handleGameComplete = (score: number) => {
    console.log('Game completed with score:', score);
    setGameType('none');
  };

  const games = [
    { type: 'match' as GameType, name: '配对游戏', icon: 'cards', color: theme.colors.primary },
    { type: 'spell' as GameType, name: '拼写游戏', icon: 'keyboard', color: theme.colors.secondary },
    { type: 'rain' as GameType, name: '单词雨', icon: 'weather-rainy', color: theme.colors.tertiary },
  ];

  if (gameType !== 'none') {
    return (
      <View style={styles.container}>
        <View style={styles.gameHeader}>
          <Button
            mode="text"
            onPress={() => setGameType('none')}
            icon="arrow-left"
          >
            返回
          </Button>
        </View>
        <View style={styles.gameContent}>
          {gameType === 'match' && (
            <MatchGame words={words.slice(0, 6)} onComplete={handleGameComplete} />
          )}
          {gameType === 'spell' && (
            <SpellGame words={words.slice(0, 10)} onComplete={handleGameComplete} />
          )}
          {gameType === 'rain' && (
            <WordRainGame words={words.slice(0, 15)} onComplete={handleGameComplete} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>单词</Text>
        <SegmentedButtons
          value={mode}
          onValueChange={(value) => setMode(value as Mode)}
          buttons={[
            { value: 'learn', label: '学习' },
            { value: 'review', label: '复习' },
            { value: 'games', label: '游戏' },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {mode === 'games' ? (
        <View style={styles.gamesContainer}>
          <Text style={[styles.gamesTitle, { color: colors.text }]}>
            趣味游戏
          </Text>
          <Text style={[styles.gamesSubtitle, { color: colors.textSecondary }]}>
            通过游戏巩固单词记忆
          </Text>
          <View style={styles.gamesList}>
            {games.map((game) => (
              <TouchableOpacity
                key={game.type}
                style={[styles.gameCard, { backgroundColor: colors.surface }]}
                onPress={() => setGameType(game.type)}
              >
                <View style={[styles.gameIcon, { backgroundColor: `${game.color}15` }]}>
                  <MaterialCommunityIcons
                    name={game.icon}
                    size={32}
                    color={game.color}
                  />
                </View>
                <Text style={[styles.gameName, { color: colors.text }]}>
                  {game.name}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                今日进度: {dailyLearned}/{dailyGoal}
              </Text>
              <Text style={[styles.progressPercent, { color: theme.colors.primary }]}>
                {Math.round((dailyLearned / dailyGoal) * 100)}%
              </Text>
            </View>
            <ProgressBar progress={(dailyLearned / dailyGoal) * 100} height={8} />
          </View>

          <View style={styles.wordSection}>
            {currentWord ? (
              <>
                <View style={styles.wordCounter}>
                  <Text style={[styles.counterText, { color: colors.textSecondary }]}>
                    {currentIndex + 1} / {words.length}
                  </Text>
                </View>
                <WordCard
                  word={currentWord}
                  showMeaning={showMeaning}
                  onFlip={() => setShowMeaning(!showMeaning)}
                  onMark={handleMark}
                />
              </>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={64}
                  color={theme.colors.success}
                />
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  {mode === 'learn' ? '今日学习完成!' : '暂无需要复习的单词'}
                </Text>
                <Button mode="contained" onPress={loadWords}>
                  {mode === 'learn' ? '继续学习' : '开始新学习'}
                </Button>
              </View>
            )}
          </View>
        </>
      )}
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
    gap: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  segmentedButtons: {
    backgroundColor: theme.colors.surface,
  },
  progressSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressText: {
    fontSize: 14,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
  },
  wordSection: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  wordCounter: {
    marginBottom: spacing.md,
  },
  counterText: {
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
  },
  gamesContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  gamesTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  gamesSubtitle: {
    fontSize: 14,
  },
  gamesList: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  gameIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  gameHeader: {
    padding: spacing.md,
  },
  gameContent: {
    flex: 1,
    padding: spacing.md,
  },
});
