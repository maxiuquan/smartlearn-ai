import { create } from 'zustand';

const LEVEL_NAMES = ['', '英语新手', '单词学徒', '记词达人', '词汇大师', '英语学霸', '单词王者', '词汇传奇', '英语专家', '词汇之神', '至尊词圣'];

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  story?: string;
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_game', icon: '🎮', name: '初次体验', description: '完成第一次游戏' },
  { id: 'ten_games', icon: '🎯', name: '游戏达人', description: '完成10次游戏' },
  { id: 'fifty_games', icon: '🏅', name: '游戏狂人', description: '完成50次游戏' },
  { id: 'score_100', icon: '💯', name: '百分玩家', description: '单次游戏获得100分' },
  { id: 'score_500', icon: '🏆', name: '高分选手', description: '单次游戏获得500分' },
  { id: 'score_1000', icon: '👑', name: '游戏王者', description: '单次游戏获得1000分' },
  { id: 'perfect', icon: '✨', name: '完美通关', description: '一局游戏零失误完成' },
  { id: 'speed_master', icon: '⚡', name: '速度达人', description: '在30秒内完成游戏' },
  { id: 'level_5', icon: '⭐', name: '词汇大师', description: '达到Lv.5' },
  { id: 'level_10', icon: '🌟', name: '至尊词圣', description: '达到Lv.10' },
  { id: 'streak_3', icon: '🔥', name: '三日坚持', description: '连续3天学习' },
  { id: 'streak_7', icon: '💪', name: '七日学霸', description: '连续7天学习' },
  { id: 'streak_30', icon: '🎓', name: '月度传奇', description: '连续30天学习' },
  { id: 'all_games', icon: '🎲', name: '全能玩家', description: '玩过所有游戏类型' },
  { id: 'combo_king', icon: '🔄', name: '连击之王', description: '在消消乐中连续匹配10次' },
];

const GAME_NAMES: Record<string, string> = {
  word_match: '单词消消乐',
  speed_challenge: '速拼挑战',
  word_puzzle: '单词拼图',
  memory_flip: '翻牌记忆',
  word_search: '单词搜索',
  hangman: '猜词大挑战',
  entropy_merge: '词根合成',
  speed_hunt: '信息狩猎',
  word_tower: '塔防护词',
};

interface GameRecord {
  gameType: string;
  score: number;
  date: string;
}

interface ProgressState {
  xp: number;
  totalGames: number;
  totalScore: number;
  todayScore: number;
  highestScore: number;
  streakDays: number;
  lastPlayDate: string;
  lastActiveDate: string;
  achievements: string[];
  unlockedAchievements: string[];
  playedGameTypes: string[];
  gameRecords: GameRecord[];
  dailyChallenge: { date: string; gameType: string };
  todayGames: number;
  newAchievement: Achievement | null;
  dailyTarget: { questionCount: number; target: number; completed: boolean };
}

function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem('global_progress');
    const rawTarget = localStorage.getItem('daily_target');
    let dailyTarget = { questionCount: 0, target: 50, completed: false };
    if (rawTarget) {
      try {
        const parsed = JSON.parse(rawTarget);
        const today = new Date().toISOString().split('T')[0];
        if (parsed.date === today) {
          dailyTarget = { questionCount: parsed.questionCount || 0, target: parsed.target || 50, completed: parsed.completed || false };
        }
      } catch { /* ignore */ }
    }

    if (raw) {
      const data = JSON.parse(raw);
      const today = new Date().toISOString().split('T')[0];
      if (data.lastPlayDate !== today) {
        return {
          ...data,
          todayScore: 0,
          todayGames: 0,
          lastPlayDate: today,
          lastActiveDate: data.lastActiveDate || data.lastPlayDate,
          newAchievement: null,
          dailyTarget,
        };
      }
      return {
        ...data,
        lastActiveDate: data.lastActiveDate || data.lastPlayDate,
        newAchievement: null,
        dailyTarget,
      };
    }
  } catch { /* ignore */ }

  return {
    xp: 0,
    totalGames: 0,
    totalScore: 0,
    todayScore: 0,
    highestScore: 0,
    streakDays: 0,
    lastPlayDate: '',
    lastActiveDate: '',
    achievements: [],
    unlockedAchievements: [],
    playedGameTypes: [],
    gameRecords: [],
    dailyChallenge: { date: '', gameType: 'word_match' },
    todayGames: 0,
    newAchievement: null,
    dailyTarget: { questionCount: 0, target: 50, completed: false },
  };
}

function saveProgress(state: ProgressState) {
  try {
    localStorage.setItem('global_progress', JSON.stringify(state));
  } catch { /* ignore */ }
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getDailyChallenge(): { date: string; gameType: string } {
  const today = getToday();
  const gameTypes = ['word_match', 'speed_challenge', 'word_puzzle', 'memory_flip', 'word_search', 'hangman', 'entropy_merge', 'speed_hunt', 'word_tower'];
  const saved = loadProgress().dailyChallenge;
  if (saved.date === today) return saved;
  const randomGame = gameTypes[Math.floor(Math.random() * gameTypes.length)];
  return { date: today, gameType: randomGame };
}

interface ProgressActions {
  getLevel: () => number;
  getLevelName: () => string;
  getXPForNextLevel: () => number;
  getXPProgress: () => number;
  addXP: (amount: number) => void;
  recordGame: (gameType: string, score: number) => void;
  getGameName: (type: string) => string;
  checkAchievements: () => string[];
  checkAndUnlockAchievements: () => Achievement[];
  clearNewAchievement: () => void;
  isDailyChallenge: (gameType: string) => boolean;
  getDailyChallengeGame: () => string;
  getStreakDays: () => number;
  resetProgress: () => void;
  allowRestDay: () => void;
  getStreakInfo: () => { currentStreak: number; restDaysThisWeek: number; canRestToday: boolean };
  setDailyTarget: (target: number) => void;
  incrementDailyProgress: () => void;
  getDailyTargetProgress: () => number;
}

export const useProgressStore = create<ProgressState & ProgressActions>((set, get) => {
  const initial = loadProgress();

  return {
    ...initial,

    getLevel: () => {
      const { xp } = get();
      return Math.min(Math.floor(xp / 100), 10);
    },

    getLevelName: () => {
      const level = get().getLevel();
      return LEVEL_NAMES[level] || LEVEL_NAMES[10];
    },

    getXPForNextLevel: () => {
      const level = get().getLevel();
      if (level >= 10) return 999;
      return (level + 1) * 100;
    },

    getXPProgress: () => {
      const { xp } = get();
      const level = get().getLevel();
      if (level >= 10) return 100;
      return ((xp % 100) / 100) * 100;
    },

    addXP: (amount: number) => {
      set((state) => {
        const newXP = state.xp + amount;
        const newState = { ...state, xp: newXP };
        saveProgress(newState);
        return { xp: newXP };
      });
    },

    recordGame: (gameType: string, score: number) => {
      set((state) => {
        const today = getToday();
        const yesterday = getYesterday();
        const restDays = JSON.parse(localStorage.getItem('rest_days') || '[]') as string[];

        let newStreak = state.streakDays;
        if (state.lastPlayDate === yesterday) {
          newStreak = state.streakDays + 1;
        } else if (state.lastPlayDate === today) {
          newStreak = state.streakDays;
        } else if (state.lastPlayDate) {
          const lastPlay = new Date(state.lastPlayDate);
          const yesterdayDate = new Date(yesterday);
          let allGapsAreRest = true;
          let hasGaps = false;
          const check = new Date(lastPlay);
          check.setDate(check.getDate() + 1);
          while (check <= yesterdayDate) {
            hasGaps = true;
            const dateStr = check.toISOString().split('T')[0];
            if (!restDays.includes(dateStr)) {
              allGapsAreRest = false;
              break;
            }
            check.setDate(check.getDate() + 1);
          }
          if (hasGaps && allGapsAreRest) {
            newStreak = state.streakDays + 1;
          } else {
            newStreak = 1;
          }
        } else {
          newStreak = 1;
        }

        const playedTypes = state.playedGameTypes.includes(gameType)
          ? state.playedGameTypes
          : [...state.playedGameTypes, gameType];

        const newRecord: GameRecord = { gameType, score, date: today };

        const newState: ProgressState = {
          ...state,
          xp: state.xp + Math.floor(score / 10),
          totalGames: state.totalGames + 1,
          totalScore: state.totalScore + score,
          todayScore: today === state.lastPlayDate ? state.todayScore + score : score,
          highestScore: Math.max(state.highestScore, score),
          streakDays: newStreak,
          lastPlayDate: today,
          lastActiveDate: today,
          playedGameTypes: playedTypes,
          gameRecords: [...state.gameRecords, newRecord],
          dailyChallenge: getDailyChallenge(),
          todayGames: today === state.lastPlayDate ? state.todayGames + 1 : 1,
        };

        saveProgress(newState);
        return newState;
      });
    },

    getGameName: (type: string) => GAME_NAMES[type] || type,

    checkAchievements: () => {
      const state = get();
      const newUnlocks: string[] = [];

      const check = (id: string, condition: boolean) => {
        if (condition && !state.achievements.includes(id) && !newUnlocks.includes(id)) {
          newUnlocks.push(id);
        }
      };

      check('first_game', state.totalGames >= 1);
      check('ten_games', state.totalGames >= 10);
      check('fifty_games', state.totalGames >= 50);
      check('score_100', state.highestScore >= 100);
      check('score_500', state.highestScore >= 500);
      check('score_1000', state.highestScore >= 1000);
      check('level_5', state.getLevel() >= 5);
      check('level_10', state.getLevel() >= 10);
      check('streak_3', state.streakDays >= 3);
      check('streak_7', state.streakDays >= 7);
      check('streak_30', state.streakDays >= 30);
      check('all_games', state.playedGameTypes.length >= 9);

      if (newUnlocks.length > 0) {
        const updatedAchievements = [...state.achievements, ...newUnlocks];
        set({ achievements: updatedAchievements });
        saveProgress({ ...state, achievements: updatedAchievements });
      }

      return newUnlocks;
    },

    checkAndUnlockAchievements: () => {
      const state = get();
      const newIds = state.checkAchievements();
      if (newIds.length > 0) {
        const latestId = newIds[newIds.length - 1];
        const achievement = ALL_ACHIEVEMENTS.find((a) => a.id === latestId);
        if (achievement) {
          set({ newAchievement: achievement });
        }
      }
      return newIds.map((id) => ALL_ACHIEVEMENTS.find((a) => a.id === id)!).filter(Boolean);
    },

    clearNewAchievement: () => {
      set({ newAchievement: null });
    },

    allowRestDay: () => {
      const today = getToday();
      const restDays = JSON.parse(localStorage.getItem('rest_days') || '[]') as string[];
      if (!restDays.includes(today)) {
        restDays.push(today);
        localStorage.setItem('rest_days', JSON.stringify(restDays));
      }
      set({ lastActiveDate: today });
    },

    getStreakInfo: () => {
      const state = get();
      const today = getToday();
      const restDays = JSON.parse(localStorage.getItem('rest_days') || '[]') as string[];
      const todayDayOfWeek = new Date().getDay();
      const sunday = new Date();
      sunday.setDate(sunday.getDate() - todayDayOfWeek);
      const monday = new Date(sunday);
      monday.setDate(sunday.getDate() - 6);
      const restDaysThisWeek = restDays.filter((d: string) => {
        const date = new Date(d);
        return date >= monday && date <= sunday;
      }).length;
      const canRestToday = state.lastPlayDate !== today && !restDays.includes(today);
      return {
        currentStreak: state.streakDays,
        restDaysThisWeek,
        canRestToday,
      };
    },

    setDailyTarget: (target: number) => {
      const today = getToday();
      const data = { date: today, questionCount: 0, target, completed: false };
      localStorage.setItem('daily_target', JSON.stringify(data));
      set({ dailyTarget: { questionCount: 0, target, completed: false } });
    },

    incrementDailyProgress: () => {
      const state = get();
      const newCount = state.dailyTarget.questionCount + 1;
      const completed = newCount >= state.dailyTarget.target;
      const newTarget = { questionCount: newCount, target: state.dailyTarget.target, completed };
      const today = getToday();
      localStorage.setItem('daily_target', JSON.stringify({ date: today, ...newTarget }));
      set({ dailyTarget: newTarget });
    },

    getDailyTargetProgress: () => {
      const state = get();
      if (state.dailyTarget.target <= 0) return 0;
      return Math.min((state.dailyTarget.questionCount / state.dailyTarget.target) * 100, 100);
    },

    isDailyChallenge: (gameType: string) => {
      const daily = getDailyChallenge();
      return daily.gameType === gameType && daily.date === getToday();
    },

    getDailyChallengeGame: () => {
      const daily = getDailyChallenge();
      return daily.gameType;
    },

    getStreakDays: () => get().streakDays,

    resetProgress: () => {
      const empty: ProgressState = {
        xp: 0, totalGames: 0, totalScore: 0, todayScore: 0,
        highestScore: 0, streakDays: 0, lastPlayDate: '',
        lastActiveDate: '',
        achievements: [], unlockedAchievements: [], playedGameTypes: [],
        gameRecords: [], dailyChallenge: { date: '', gameType: 'word_match' },
        todayGames: 0,
        newAchievement: null,
        dailyTarget: { questionCount: 0, target: 50, completed: false },
      };
      set(empty);
      saveProgress(empty);
    },
  };
});