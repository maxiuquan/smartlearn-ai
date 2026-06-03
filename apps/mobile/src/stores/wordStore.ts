import { create } from 'zustand';
import { Word, WordProgress } from '../types';

interface WordStore {
  words: Word[];
  currentWord: Word | null;
  currentIndex: number;
  progress: Map<string, WordProgress>;
  dailyGoal: number;
  dailyLearned: number;
  isLoading: boolean;
  
  // Actions
  setWords: (words: Word[]) => void;
  setCurrentWord: (word: Word) => void;
  nextWord: () => void;
  markWord: (wordId: string, correct: boolean) => void;
  updateProgress: (wordId: string, progress: Partial<WordProgress>) => void;
  getWordsToReview: () => Word[];
  getMasteredWords: () => Word[];
  resetDaily: () => void;
}

export const useWordStore = create<WordStore>((set, get) => ({
  words: [],
  currentWord: null,
  currentIndex: 0,
  progress: new Map(),
  dailyGoal: 50,
  dailyLearned: 0,
  isLoading: false,

  setWords: (words: Word[]) => {
    set({
      words,
      currentWord: words[0] ?? null,
      currentIndex: 0,
    });
  },

  setCurrentWord: (word: Word) => {
    const index = get().words.findIndex(w => w.id === word.id);
    set({
      currentWord: word,
      currentIndex: index >= 0 ? index : get().currentIndex,
    });
  },

  nextWord: () => {
    const { words, currentIndex } = get();
    if (currentIndex < words.length - 1) {
      const nextIndex = currentIndex + 1;
      set({
        currentIndex: nextIndex,
        currentWord: words[nextIndex] ?? null,
      });
    }
  },

  markWord: (wordId: string, correct: boolean) => {
    const { progress, dailyLearned } = get();
    const currentProgress = progress.get(wordId) || {
      wordId,
      correctCount: 0,
      wrongCount: 0,
      lastReviewAt: new Date().toISOString(),
      masteryLevel: 0,
    };

    const newProgress: WordProgress = {
      ...currentProgress,
      correctCount: currentProgress.correctCount + (correct ? 1 : 0),
      wrongCount: currentProgress.wrongCount + (correct ? 0 : 1),
      lastReviewAt: new Date().toISOString(),
      masteryLevel: Math.min(100, currentProgress.masteryLevel + (correct ? 10 : -5)),
    };

    const newProgressMap = new Map(progress);
    newProgressMap.set(wordId, newProgress);

    set({
      progress: newProgressMap,
      dailyLearned: dailyLearned + 1,
    });
  },

  updateProgress: (wordId: string, progressUpdate: Partial<WordProgress>) => {
    const { progress } = get();
    const currentProgress = progress.get(wordId);
    
    if (currentProgress) {
      const newProgressMap = new Map(progress);
      newProgressMap.set(wordId, { ...currentProgress, ...progressUpdate });
      set({ progress: newProgressMap });
    }
  },

  getWordsToReview: () => {
    const { words, progress } = get();
    const now = new Date();
    
    return words.filter(word => {
      const wordProgress = progress.get(word.id);
      if (!wordProgress) return true;
      
      const lastReview = new Date(wordProgress.lastReviewAt);
      const hoursSinceReview = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60);
      
      return hoursSinceReview >= 24 || wordProgress.masteryLevel < 80;
    });
  },

  getMasteredWords: () => {
    const { words, progress } = get();
    
    return words.filter(word => {
      const wordProgress = progress.get(word.id);
      return wordProgress && wordProgress.masteryLevel >= 80;
    });
  },

  resetDaily: () => {
    set({ dailyLearned: 0 });
  },
}));
