import { useState, useEffect, useCallback } from 'react';

/**
 * P3-A 对标 Duolingo: 全局 Streak 连胜系统
 * - 每日完成任意 1 局游戏即记 1 天连胜
 * - 跨日未活动则连胜清零(可用冻结保护)
 * - 数据存 localStorage(轻量,不动后端)
 */

const STREAK_KEY = 'smartlearn_streak_v1';

export interface StreakData {
  current: number;
  longest: number;
  lastActiveDate: string; // YYYY-MM-DD
  freezes: number; // 可用冻结数
}

function getTodayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        current: data.current || 0,
        longest: data.longest || 0,
        lastActiveDate: data.lastActiveDate || '',
        freezes: typeof data.freezes === 'number' ? data.freezes : 1,
      };
    }
  } catch {
    // 忽略解析错误
  }
  // 首次使用:赠送 1 个冻结
  return { current: 0, longest: 0, lastActiveDate: '', freezes: 1 };
}

function saveStreak(data: StreakData) {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(data));
  } catch {
    // 隐私模式可能写入失败,忽略
  }
}

// 跨组件同步事件名:写入后派发,其他 useStreak 实例监听并重新加载
const STREAK_UPDATE_EVENT = 'smartlearn:streak-update';

export function useStreak() {
  const [streak, setStreak] = useState<StreakData>(() => loadStreak());

  // 启动时检查断签:如果上次活动既不是今天也不是昨天,尝试用冻结补昨天
  useEffect(() => {
    const today = getTodayStr();
    const yesterday = getTodayStr(-1);
    if (!streak.lastActiveDate) return;
    if (streak.lastActiveDate === today) return;
    if (streak.lastActiveDate === yesterday) return;

    // 距离上次活动 > 1 天,说明昨天断了
    const last = new Date(streak.lastActiveDate);
    const todayDate = new Date(today);
    const diffDays = Math.floor(
      (todayDate.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays > 1) {
      if (streak.freezes > 0) {
        const updated: StreakData = {
          ...streak,
          freezes: streak.freezes - 1,
          lastActiveDate: yesterday,
        };
        saveStreak(updated);
        setStreak(updated);
      } else {
        const updated: StreakData = { ...streak, current: 0 };
        saveStreak(updated);
        setStreak(updated);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听跨组件更新事件:其他组件写入后,本组件重新加载
  useEffect(() => {
    const handler = () => setStreak(loadStreak());
    window.addEventListener(STREAK_UPDATE_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(STREAK_UPDATE_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  /** 记录今日完成游戏 - 调用此方法会更新连胜 */
  const recordDailyActivity = useCallback(() => {
    const today = getTodayStr();
    const yesterday = getTodayStr(-1);
    setStreak((prev) => {
      if (prev.lastActiveDate === today) return prev;
      let newCurrent: number;
      if (prev.lastActiveDate === yesterday) {
        newCurrent = prev.current + 1;
      } else if (!prev.lastActiveDate) {
        newCurrent = 1;
      } else {
        newCurrent = 1;
      }
      const updated: StreakData = {
        current: newCurrent,
        longest: Math.max(prev.longest, newCurrent),
        lastActiveDate: today,
        freezes: prev.freezes,
      };
      saveStreak(updated);
      // 通知其他组件重新读取
      window.dispatchEvent(new Event(STREAK_UPDATE_EVENT));
      return updated;
    });
  }, []);

  /** 购买冻结(实际扣金币由调用方处理) */
  const buyFreeze = useCallback(() => {
    setStreak((prev) => {
      const updated = { ...prev, freezes: prev.freezes + 1 };
      saveStreak(updated);
      window.dispatchEvent(new Event(STREAK_UPDATE_EVENT));
      return updated;
    });
  }, []);

  return { streak, recordDailyActivity, buyFreeze };
}
