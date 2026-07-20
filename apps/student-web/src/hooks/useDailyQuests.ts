import { useState, useEffect, useCallback } from 'react';

/**
 * P3-B 对标 Duolingo: 每日任务系统
 * - 每日 0 点生成 3 个小任务
 * - 完成可领取金币奖励
 * - 数据存 localStorage(轻量,不动后端)
 */

const QUESTS_KEY = 'smartlearn_daily_quests_v1';

export interface Quest {
  id: string;
  title: string;
  emoji: string;
  target: number;
  progress: number;
  reward: number;
  completed: boolean;
  claimed: boolean;
}

const QUEST_TEMPLATES = [
  { id: 'play_games', title: '完成 3 局游戏', emoji: '🎮', target: 3, reward: 30 },
  { id: 'correct_answers', title: '答对 20 道题', emoji: '✅', target: 20, reward: 50 },
  { id: 'combo_streak', title: '达成 5 连击', emoji: '🔥', target: 5, reward: 40 },
];

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface QuestStore {
  date: string;
  quests: Quest[];
}

function loadQuests(): Quest[] {
  try {
    const raw = localStorage.getItem(QUESTS_KEY);
    if (raw) {
      const store: QuestStore = JSON.parse(raw);
      if (store.date === getTodayStr()) {
        return store.quests;
      }
    }
  } catch {
    // 忽略解析错误
  }
  // 新一天或首次加载:生成今日任务
  return QUEST_TEMPLATES.map((t) => ({
    ...t,
    progress: 0,
    completed: false,
    claimed: false,
  }));
}

function saveQuests(quests: Quest[]) {
  try {
    const store: QuestStore = { date: getTodayStr(), quests };
    localStorage.setItem(QUESTS_KEY, JSON.stringify(store));
  } catch {
    // 忽略写入失败
  }
}

// 跨组件同步事件名
const QUESTS_UPDATE_EVENT = 'smartlearn:quests-update';

export function useDailyQuests() {
  const [quests, setQuests] = useState<Quest[]>(() => loadQuests());

  useEffect(() => {
    const fresh = loadQuests();
    setQuests(fresh);
  }, []);

  // 监听跨组件更新事件
  useEffect(() => {
    const handler = () => setQuests(loadQuests());
    window.addEventListener(QUESTS_UPDATE_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(QUESTS_UPDATE_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  /** 玩了一局游戏 - 增加 play_games 进度 */
  const recordGamePlayed = useCallback(() => {
    setQuests((prev) => {
      const next = prev.map((q) => {
        if (q.id === 'play_games' && !q.completed) {
          const progress = q.progress + 1;
          return { ...q, progress, completed: progress >= q.target };
        }
        return q;
      });
      saveQuests(next);
      window.dispatchEvent(new Event(QUESTS_UPDATE_EVENT));
      return next;
    });
  }, []);

  /** 答对一题 - 增加 correct_answers 进度 */
  const recordCorrectAnswer = useCallback(() => {
    setQuests((prev) => {
      const next = prev.map((q) => {
        if (q.id === 'correct_answers' && !q.completed) {
          const progress = q.progress + 1;
          return { ...q, progress, completed: progress >= q.target };
        }
        return q;
      });
      saveQuests(next);
      window.dispatchEvent(new Event(QUESTS_UPDATE_EVENT));
      return next;
    });
  }, []);

  /** 达成连击 - 更新 combo_streak 最高记录 */
  const recordCombo = useCallback((combo: number) => {
    setQuests((prev) => {
      let changed = false;
      const next = prev.map((q) => {
        if (q.id === 'combo_streak' && !q.completed && combo > q.progress) {
          changed = true;
          const progress = combo;
          return { ...q, progress, completed: progress >= q.target };
        }
        return q;
      });
      if (changed) {
        saveQuests(next);
        window.dispatchEvent(new Event(QUESTS_UPDATE_EVENT));
      }
      return changed ? next : prev;
    });
  }, []);

  /** 领取任务奖励 - 返回获得的金币数 */
  const claimReward = useCallback((questId: string): number => {
    let reward = 0;
    setQuests((prev) => {
      const next = prev.map((q) => {
        if (q.id === questId && q.completed && !q.claimed) {
          reward = q.reward;
          return { ...q, claimed: true };
        }
        return q;
      });
      saveQuests(next);
      window.dispatchEvent(new Event(QUESTS_UPDATE_EVENT));
      return next;
    });
    return reward;
  }, []);

  return {
    quests,
    recordGamePlayed,
    recordCorrectAnswer,
    recordCombo,
    claimReward,
  };
}
