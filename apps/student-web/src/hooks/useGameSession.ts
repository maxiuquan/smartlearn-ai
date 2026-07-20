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
}

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
  // P1-A 改进 (2026-07-20): 新增 score / combo / maxCombo 本地累计
  // 后端 submit_answer 不返回 score/combo,前端基于 base_xp=10/题 + combo 倍率累计
  // 最终 finish 阶段以服务端结算为准
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [baseXp, setBaseXp] = useState(10);
  const [comboMultiplier, setComboMultiplier] = useState(1.0);
  // P3-E: Hearts 生命值(从 session.lives 读取)
  const [lives, setLives] = useState(0);
  const [maxLives, setMaxLives] = useState(0);
  const gameIdRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startSession = useCallback(
    async (gameId: string, difficulty?: string) => {
      setLoading(true);
      setError(null);
      gameIdRef.current = gameId;
      finishedRef.current = false;
      setCorrectCount(0);
      setWrongCount(0);
      setLastResult(null);
      // P1-A: 重置 score/combo
      setScore(0);
      setCombo(0);
      setMaxCombo(0);
      try {
        const data = await startGame({ gameId, difficulty });
        setSessionId(data.session_id);
        setQuestions(data.questions || []);
        setCurrentIndex(0);
        setIsGameOver(false);
        setInteractionType(data.interaction_type || 'multiple_choice');
        setGameName(data.game_name || '');
        setTimeLeft(data.time_limit_sec || 0);
        // P1-A: 从游戏配置读取 base_xp 和 combo_multiplier
        // data 由后端返回,字段可能是 rewards.base_xp 或 base_xp
        const rewards = (data as any).rewards;
        if (rewards) {
          setBaseXp(rewards.base_xp || 10);
          setComboMultiplier(rewards.combo_multiplier || 1.0);
        }
        clearTimer();
        if (data.time_limit_sec > 0) {
          timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
              if (prev <= 1) {
                clearTimer();
                setIsGameOver(true);
                return 0;
              }
              return prev - 1;
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
    // P2-A: 播放游戏结束音效
    if (isSoundEnabled()) sounds.finish();
    try {
      const result = await finishGame({ gameId: gameIdRef.current, sessionId });
      setIsGameOver(true);
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
      const idempotencyKey = `${gameIdRef.current}-${sessionId}-${q.sequence}-${Date.now()}`;
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
          // P1-A: 更新 score 和 combo (本地累计,最终以服务端为准)
          setCombo((prevCombo) => {
            const newCombo = prevCombo + 1;
            setMaxCombo((prev) => Math.max(prev, newCombo));
            // score += baseXp * (1 + (newCombo - 1) * (comboMultiplier - 1))
            // 第 1 连击: baseXp; 第 2 连击: baseXp * comboMultiplier; 第 3 连击: baseXp * comboMultiplier^2...
            const multiplier = Math.pow(comboMultiplier, Math.max(0, newCombo - 1));
            const gain = Math.round(baseXp * multiplier);
            setScore((s) => s + gain);
            // P2-A: 播放连击音效
            if (isSoundEnabled()) {
              if (newCombo >= 2) sounds.combo(newCombo);
              else sounds.correct();
            }
            return newCombo;
          });
        } else {
          setWrongCount((c) => c + 1);
          // P1-A: 答错重置 combo
          setCombo(0);
          // P2-A: 播放错误音效
          if (isSoundEnabled()) sounds.wrong();
        }
        if (result.answered_count >= result.total_questions) {
          await finishSession();
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
        return result;
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || '提交失败');
      }
    },
    [sessionId, questions, currentIndex, finishSession, baseXp, comboMultiplier]
  );

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
    // P1-A: 新增 score / combo / maxCombo
    score,
    combo,
    maxCombo,
    // P3-E: 新增 lives / maxLives
    lives,
    maxLives,
    startSession,
    submitCurrentAnswer,
    finishSession,
  };
}
