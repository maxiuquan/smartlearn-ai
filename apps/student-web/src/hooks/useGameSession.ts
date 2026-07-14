import { useState, useEffect, useCallback, useRef } from 'react';
import { startGame, submitAnswer, finishGame } from '../api/client';

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
      try {
        const data = await startGame({ gameId, difficulty });
        setSessionId(data.session_id);
        setQuestions(data.questions || []);
        setCurrentIndex(0);
        setIsGameOver(false);
        setInteractionType(data.interaction_type || 'multiple_choice');
        setGameName(data.game_name || '');
        setTimeLeft(data.time_limit_sec || 0);
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
        } else {
          setWrongCount((c) => c + 1);
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
    [sessionId, questions, currentIndex, finishSession]
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
    startSession,
    submitCurrentAnswer,
    finishSession,
  };
}
