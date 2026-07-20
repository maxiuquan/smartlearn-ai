import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useGameSession } from '../hooks/useGameSession';
import { useStreak } from '../hooks/useStreak';
import { useDailyQuests } from '../hooks/useDailyQuests';
import QuestionCard from '../components/QuestionCard';
import ScoreBoard from '../components/ScoreBoard';
import ProgressBar from '../components/ProgressBar';
import GameToolbar from '../components/GameToolbar';

interface Feedback {
  isCorrect: boolean;
  message: string;
}

export default function CrossSubjectGame() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // P1-B: 从 URL 读取 difficulty 参数
  const difficulty = searchParams.get('difficulty') || undefined;

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
    // P1-A: 新增 score / combo / maxCombo
    score,
    combo,
    maxCombo,
    startSession,
    submitCurrentAnswer,
    finishSession,
  } = useGameSession();

  // P3-A/B: 全局连胜 + 每日任务
  const { recordDailyActivity } = useStreak();
  const { recordGamePlayed } = useDailyQuests();
  const questsTriggeredRef = useRef(false);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatedRef = useRef(false);

  // 开始游戏
  useEffect(() => {
    if (!gameId) return;
    // P1-B: 传递 difficulty 参数
    startSession(gameId, difficulty);
  }, [gameId, startSession, difficulty]);

  // 游戏结束后跳转结果页
  useEffect(() => {
    if (isGameOver && sessionId && gameId && !navigatedRef.current) {
      navigatedRef.current = true;
      // P3-A/B: 触发连胜 + 任务进度(只触发一次)
      if (!questsTriggeredRef.current) {
        questsTriggeredRef.current = true;
        recordDailyActivity();
        recordGamePlayed();
      }
      finishSession().then(() => {
        navigate(`/result/${sessionId}?gameId=${gameId}`, { replace: true });
      });
    }
  }, [isGameOver, sessionId, gameId, navigate, finishSession, recordDailyActivity, recordGamePlayed]);

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
        setTimeout(() => setSubmitting(false), 1200);
      }
    },
    [submitting, submitCurrentAnswer]
  );

  // P1-C: 提示道具
  const [hintText, setHintText] = useState<string | null>(null);
  const handleHint = useCallback(() => {
    if (!currentQuestion) return;
    if (currentQuestion.options && currentQuestion.options.length > 0) {
      setHintText(`💡 提示: 4 个选项中,先排除明显错误的 2 个`);
    } else {
      setHintText(`💡 提示: 仔细阅读题目,关键词决定答案`);
    }
    setTimeout(() => setHintText(null), 5000);
  }, [currentQuestion]);

  const handleSkip = useCallback(() => {
    if (submitting) return;
    setHintText('⏭️ 已跳过本题');
    setTimeout(() => setHintText(null), 1500);
    handleAnswer('__SKIP__');
  }, [submitting, handleAnswer]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin mb-4" />
        <p className="text-gray-500">正在加载跨科目游戏...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">😵</p>
        <p className="text-red-500 text-lg mb-4">{error}</p>
        <button
          onClick={() => navigate('/games')}
          className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          返回游戏大厅
        </button>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* 跨科目游戏标题 */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-purple-700">🎯 跨科目挑战</h2>
      </div>

      {/* 评分面板 */}
      <ScoreBoard
        score={score}
        correctCount={correctCount}
        wrongCount={wrongCount}
        combo={combo}
        maxCombo={maxCombo}
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

      {/* 题目卡片 — 统一使用 QuestionCard 渲染所有题型 */}
      <QuestionCard
        question={currentQuestion}
        questionIndex={currentIndex}
        totalQuestions={questions.length}
        onAnswer={handleAnswer}
        feedback={feedback}
        submitting={submitting}
        combo={combo}
      />

      {/* P1-C: 提示气泡 */}
      {hintText && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 animate-pulse">
          {hintText}
        </div>
      )}

      {/* P1-C: 道具工具栏 */}
      <GameToolbar
        disabled={submitting}
        onHint={handleHint}
        onSkip={handleSkip}
      />
    </div>
  );
}
