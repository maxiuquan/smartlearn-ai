import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameSession } from '../hooks/useGameSession';
import QuestionCard from '../components/QuestionCard';
import ScoreBoard from '../components/ScoreBoard';
import ProgressBar from '../components/ProgressBar';

interface Feedback {
  isCorrect: boolean;
  message: string;
}

export default function WordGame() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const {
    sessionId,
    questions,
    currentQuestion,
    currentIndex,
    isGameOver,
    loading,
    error,
    timeLeft,
    correctCount,
    wrongCount,
    lastResult,
    startSession,
    submitCurrentAnswer,
    finishSession,
  } = useGameSession();

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatedRef = useRef(false);

  // 开始游戏
  useEffect(() => {
    if (!gameId) return;
    startSession(gameId);
  }, [gameId, startSession]);

  // 游戏结束后跳转结果页（finishSession 幂等，多次调用安全）
  useEffect(() => {
    if (isGameOver && sessionId && gameId && !navigatedRef.current) {
      navigatedRef.current = true;
      finishSession().then(() => {
        navigate(`/result/${sessionId}?gameId=${gameId}`, { replace: true });
      });
    }
  }, [isGameOver, sessionId, gameId, navigate, finishSession]);

  // 显示反馈后清空
  useEffect(() => {
    if (!lastResult) return;
    setFeedback({
      isCorrect: lastResult.is_correct,
      message: lastResult.is_correct ? '✓ 回答正确！' : '✗ 答错了，继续加油！',
    });
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 1000);
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [lastResult]);

  const handleAnswer = useCallback(
    async (answer?: string, structuredAnswer?: Record<string, unknown>) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        await submitCurrentAnswer(answer, structuredAnswer);
      } finally {
        // 反馈展示期间禁用按钮，1.2s 后恢复
        setTimeout(() => setSubmitting(false), 1200);
      }
    },
    [submitting, submitCurrentAnswer]
  );

  // 加载状态
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-gray-500">正在加载游戏...</p>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">😵</p>
        <p className="text-red-500 text-lg mb-4">{error}</p>
        <button
          onClick={() => navigate('/games')}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          返回游戏大厅
        </button>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* 评分面板 */}
      <ScoreBoard
        score={0}
        correctCount={correctCount}
        wrongCount={wrongCount}
        combo={0}
        timeLeft={timeLeft}
      />

      {/* 进度条 */}
      <div className="mt-4 mb-6">
        <ProgressBar
          current={currentIndex + 1}
          total={questions.length}
          label="游戏进度"
        />
      </div>

      {/* 题目卡片 */}
      <QuestionCard
        question={currentQuestion}
        questionIndex={currentIndex}
        totalQuestions={questions.length}
        onAnswer={handleAnswer}
        feedback={feedback}
        submitting={submitting}
      />
    </div>
  );
}
