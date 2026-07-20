import { useState, useEffect, useCallback, useRef } from 'react';
import { startGame, submitAnswer, finishGame } from '../api/client';
// P2-A: 引入音效工具
import { sounds, isSoundEnabled } from '../utils/sounds';

export interface GameQuestion {
  question_id: string;
  prompt: string;
  meaning?: string;
  phonetic?: string;
  example?: string;
  type: string;
  sequence: number;
  options?: string[];
  pairs?: Array<{ left: string; right: string }>;
  left_items?: string[];
  right_options?: string[];
  sort_items?: string[];
  word_bank?: string[];
  blanks?: Array<{ id: string; answer: string }>;
  prompt_with_blanks?: string;
}

export interface SubmitResult {
  is_correct: boolean;
  answered_count: number;
  total_questions: number;
}

export interface FinishResult {
  session_id: number;
  score: number;
  xp_gained: number;
  coins_gained: number;
  accuracy: number;
  correct_count: number;
  total_questions: number;
  // P1-4: 服务端返回的本局最高连击数
  max_combo?: number;
}

// P1-1: 道具系统类型
export type PowerUpType =
  | 'hint'
  | 'skip'
  | 'freeze_time'
  | 'bomb'
  | 'shuffle'
  | 'replay'
  | 'reveal'
  | 'revive';

export interface PowerUpEffect {
  type: PowerUpType;
  // 道具效果数据(如 bomb 消除的选项、reveal 揭示的字母)
  payload?: Record<string, unknown>;
  // 触发时间戳,用于组件区分多次触发
  triggeredAt: number;
}

export interface PowerUpsState {
  hint: number; // 剩余次数
  skip: number;
  freeze_time: number;
  bomb: number;
  shuffle: number;
  replay: number;
  reveal: number;
  revive: number;
}

// P1-1: 默认道具次数配置(对标 Quizizz Power-ups)
const DEFAULT_POWER_UP_COUNTS: PowerUpsState = {
  hint: 3,
  skip: 1,
  freeze_time: 1,
  bomb: 1,
  shuffle: 1,
  replay: 2,
  reveal: 1,
  revive: 1,
};

// P1-1: 道具图标映射
export const POWER_UP_ICONS: Record<PowerUpType, string> = {
  hint: '💡',
  skip: '⏭️',
  freeze_time: '❄️',
  bomb: '💣',
  shuffle: '🔀',
  replay: '🔁',
  reveal: '👁️',
  revive: '❤️',
};

// P1-1: 道具中文名映射
export const POWER_UP_LABELS: Record<PowerUpType, string> = {
  hint: '提示',
  skip: '跳过',
  freeze_time: '冻结时间',
  bomb: '消除干扰',
  shuffle: '重排',
  replay: '重听',
  reveal: '揭示字母',
  revive: '复活',
};

export function useGameSession() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [interactionType, setInteractionType] = useState('multiple_choice');
  const [gameName, setGameName] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [lastResult, setLastResult] = useState<SubmitResult | null>(null);
  // P1-A 改进: score / combo / maxCombo 本地累计
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [baseXp, setBaseXp] = useState(10);
  const [comboMultiplier, setComboMultiplier] = useState(1.0);
  // P3-E: Hearts 生命值(从 session.lives 读取)
  const [lives, setLives] = useState(0);
  const [maxLives, setMaxLives] = useState(0);

  // P1-1: 道具系统
  const [powerUps, setPowerUps] = useState<PowerUpsState>({ ...DEFAULT_POWER_UP_COUNTS });
  const [powerUpEffect, setPowerUpEffect] = useState<PowerUpEffect | null>(null);
  // P1-1: freeze_time 冻结时间(秒),倒计时暂停
  const [freezeTimeSec, setFreezeTimeSec] = useState(0);
  // P1-1: 可用道具列表(从游戏配置读取)
  const [availableProps, setAvailableProps] = useState<string[]>([]);

  const gameIdRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);
  // P0-3 修复: 已答题的幂等键集合(防止重试导致重复提交)
  const submittedKeysRef = useRef<Set<string>>(new Set());

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startSession = useCallback(
    async (gameId: string, difficulty?: string, gameProps?: string[]) => {
      setLoading(true);
      setError(null);
      gameIdRef.current = gameId;
      finishedRef.current = false;
      submittedKeysRef.current.clear();
      setCorrectCount(0);
      setWrongCount(0);
      setLastResult(null);
      setScore(0);
      setCombo(0);
      setMaxCombo(0);
      setPowerUpEffect(null);
      setFreezeTimeSec(0);
      // P1-1: 重置道具次数
      setPowerUps({ ...DEFAULT_POWER_UP_COUNTS });
      // P1-1: 设置可用道具(默认 hint+skip,可被 gameProps 覆盖)
      const propsList = gameProps && gameProps.length > 0 ? gameProps : ['hint', 'skip'];
      setAvailableProps(propsList);
      try {
        const data = await startGame({ gameId, difficulty });
        setSessionId(data.session_id);
        setQuestions(data.questions || []);
        setCurrentIndex(0);
        setIsGameOver(false);
        setInteractionType(data.interaction_type || 'multiple_choice');
        setGameName(data.game_name || '');
        setTimeLeft(data.time_limit_sec || 0);
        // P3-E: 从 session 响应读取 lives(后端 P1 改进已返回)
        const sessionLives = (data as any).lives || 0;
        setLives(sessionLives);
        setMaxLives(sessionLives);
        // P1-A: 从游戏配置读取 base_xp 和 combo_multiplier
        const rewards = (data as any).rewards;
        if (rewards) {
          setBaseXp(rewards.base_xp || 10);
          setComboMultiplier(rewards.combo_multiplier || 1.0);
        }
        clearTimer();
        if (data.time_limit_sec > 0) {
          timerRef.current = setInterval(() => {
            // P1-1: freeze_time 期间倒计时暂停
            setFreezeTimeSec((prevFreeze) => {
              if (prevFreeze > 0) {
                return prevFreeze - 1;
              }
              setTimeLeft((prev) => {
                if (prev <= 1) {
                  clearTimer();
                  setIsGameOver(true);
                  return 0;
                }
                return prev - 1;
              });
              return 0;
            });
          }, 1000);
        }
        return data;
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || '游戏启动失败');
      } finally {
        setLoading(false);
      }
    },
    [clearTimer]
  );

  const finishSession = useCallback(async () => {
    if (!sessionId || !gameIdRef.current) return null;
    if (finishedRef.current) return null;
    finishedRef.current = true;
    clearTimer();
    if (isSoundEnabled()) sounds.finish();
    try {
      const result = await finishGame({ gameId: gameIdRef.current, sessionId });
      setIsGameOver(true);
      // P1-4: 同步服务端 max_combo
      if (result.max_combo !== undefined) {
        setMaxCombo((prev) => Math.max(prev, result.max_combo));
      }
      return result;
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || '结算失败');
      return null;
    }
  }, [sessionId, clearTimer]);

  const submitCurrentAnswer = useCallback(
    async (answer?: string, structuredAnswer?: Record<string, unknown>) => {
      if (!sessionId || !gameIdRef.current) return;
      const q = questions[currentIndex];
      if (!q) return;
      // P0-3 修复: idempotencyKey 去除 Date.now(),改为稳定键
      // 同一 session+sequence 只能有 1 次有效提交(后端 Redis SETNX 拒绝重复)
      const idempotencyKey = `${gameIdRef.current}-${sessionId}-${q.sequence}`;
      // 客户端额外防护:已提交过的题不再提交
      if (submittedKeysRef.current.has(idempotencyKey)) {
        return;
      }
      submittedKeysRef.current.add(idempotencyKey);
      try {
        const result = await submitAnswer({
          gameId: gameIdRef.current,
          sessionId,
          questionId: q.question_id,
          answer,
          structuredAnswer,
          sequence: q.sequence,
          idempotencyKey,
        });
        setLastResult(result);
        if (result.is_correct) {
          setCorrectCount((c) => c + 1);
          setCombo((prevCombo) => {
            const newCombo = prevCombo + 1;
            setMaxCombo((prev) => Math.max(prev, newCombo));
            const multiplier = Math.pow(comboMultiplier, Math.max(0, newCombo - 1));
            const gain = Math.round(baseXp * multiplier);
            setScore((s) => s + gain);
            if (isSoundEnabled()) {
              if (newCombo >= 2) sounds.combo(newCombo);
              else sounds.correct();
            }
            return newCombo;
          });
        } else {
          setWrongCount((c) => c + 1);
          setCombo(0);
          // P3-E: 答错扣血(仅当 maxLives > 0 时)
          setLives((prevLives) => {
            if (prevLives <= 0) return prevLives; // 无生命限制
            const newLives = prevLives - 1;
            if (newLives <= 0) {
              // 生命归零,触发结算
              setTimeout(() => {
                finishSession();
              }, 600);
            }
            return newLives;
          });
          if (isSoundEnabled()) sounds.wrong();
        }
        if (result.answered_count >= result.total_questions) {
          await finishSession();
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
        return result;
      } catch (e: any) {
        // 提交失败,移除幂等键让客户端可重试
        submittedKeysRef.current.delete(idempotencyKey);
        setError(e?.response?.data?.detail || e?.message || '提交失败');
      }
    },
    [sessionId, questions, currentIndex, finishSession, baseXp, comboMultiplier]
  );

  // P1-1: 道具系统 - 跳过当前题(标记为答错但不影响 combo)
  const skipCurrentQuestion = useCallback(() => {
    if (!sessionId || !gameIdRef.current) return;
    const q = questions[currentIndex];
    if (!q) return;
    const idempotencyKey = `${gameIdRef.current}-${sessionId}-${q.sequence}`;
    if (submittedKeysRef.current.has(idempotencyKey)) return;
    submittedKeysRef.current.add(idempotencyKey);
    // 跳过 = 提交占位答案(必错)
    submitAnswer({
      gameId: gameIdRef.current,
      sessionId,
      questionId: q.question_id,
      answer: '__SKIP__',
      sequence: q.sequence,
      idempotencyKey,
    }).then((result) => {
      if (result) {
        setLastResult(result);
        setWrongCount((c) => c + 1);
        setCombo(0);
        if (result.answered_count >= result.total_questions) {
          finishSession();
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
      }
    }).catch(() => {
      submittedKeysRef.current.delete(idempotencyKey);
    });
  }, [sessionId, questions, currentIndex, finishSession]);

  // P1-1: 道具系统 - 使用道具
  const applyPowerUp = useCallback(
    (type: PowerUpType, payload?: Record<string, unknown>) => {
      setPowerUps((prev) => {
        if (prev[type] <= 0) return prev;
        // 消耗一次道具
        const next = { ...prev, [type]: prev[type] - 1 };
        return next;
      });
      // 触发道具效果,通知 QuestionCard 应用
      const effect: PowerUpEffect = {
        type,
        payload,
        triggeredAt: Date.now(),
      };
      setPowerUpEffect(effect);

      // 道具特定逻辑
      switch (type) {
        case 'freeze_time':
          // 冻结倒计时 5 秒
          setFreezeTimeSec(5);
          break;
        case 'skip':
          skipCurrentQuestion();
          break;
        case 'revive':
          // 复活:恢复 1 条命(仅当有生命限制且当前 < maxLives)
          setLives((prev) => {
            if (prev <= 0 || prev >= maxLives) return prev;
            return prev + 1;
          });
          break;
        // bomb/shuffle/replay/reveal 由 QuestionCard 监听 powerUpEffect 应用
      }
    },
    [maxLives, skipCurrentQuestion]
  );

  // P1-1: 道具系统 - 重置道具效果(组件应用完后调用)
  const clearPowerUpEffect = useCallback(() => {
    setPowerUpEffect(null);
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    sessionId,
    questions,
    currentQuestion: questions[currentIndex] || null,
    currentIndex,
    isGameOver,
    loading,
    error,
    timeLeft,
    interactionType,
    gameName,
    correctCount,
    wrongCount,
    lastResult,
    // P1-A: score / combo / maxCombo
    score,
    combo,
    maxCombo,
    // P3-E: lives / maxLives
    lives,
    maxLives,
    // P1-1: 道具系统
    powerUps,
    powerUpEffect,
    freezeTimeSec,
    availableProps,
    startSession,
    submitCurrentAnswer,
    finishSession,
    // P1-1: 道具系统 API
    applyPowerUp,
    clearPowerUpEffect,
  };
}
