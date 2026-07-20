import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useGameSession } from '../hooks/useGameSession';
import { useStreak } from '../hooks/useStreak';
import { useDailyQuests } from '../hooks/useDailyQuests';
import { getGameProps } from '../utils/gameConfig';
import QuestionCard from '../components/QuestionCard';
import ScoreBoard from '../components/ScoreBoard';
import ProgressBar from '../components/ProgressBar';
import GameToolbar from '../components/GameToolbar';
// P1-2: 单词接龙特色玩法
import WordChainGame from '../components/WordChainGame';

interface Feedback {
  isCorrect: boolean;
  message: string;
}

export default function WordGame() {
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
    // P3-E: lives
    lives,
    maxLives,
    // P1-1: 道具系统
    powerUps,
    powerUpEffect,
    availableProps,
    applyPowerUp,
    clearPowerUpEffect,
    startSession,
    submitCurrentAnswer,
    finishSession,
  } = useGameSession();

  // P0-3: 读取该游戏的可用道具列表
  const gameProps = useMemo(() => (gameId ? getGameProps(gameId) : ['hint', 'skip']), [gameId]);

  // P3-A/B: 全局连胜 + 每日任务
  const { recordDailyActivity } = useStreak();
  const { recordGamePlayed, recordCorrectAnswer, recordCombo } = useDailyQuests();
  const questsTriggeredRef = useRef(false);

  // P3-B: 答对一题 → 任务进度 +1
  useEffect(() => {
    if (lastResult?.is_correct) {
      recordCorrectAnswer();
    }
  }, [lastResult, recordCorrectAnswer]);

  // P3-B: 连击更新
  useEffect(() => {
    if (combo >= 2) recordCombo(combo);
  }, [combo, recordCombo]);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatedRef = useRef(false);

  // 开始游戏 — P0-3: 传 gameProps 让 useGameSession 设置 availableProps
  useEffect(() => {
    if (!gameId) return;
    startSession(gameId, difficulty, gameProps);
  }, [gameId, startSession, difficulty, gameProps]);

  // 游戏结束后跳转结果页（finishSession 幂等，多次调用安全）
  useEffect(() => {
    if (isGameOver && sessionId && gameId && !navigatedRef.current) {
      navigatedRef.current = true;
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

  // P1-2: word-chain 是页面级特色玩法,使用独立组件接管渲染
  const isWordChain = gameId === 'word-chain';

  return (
    <div className="max-w-2xl mx-auto">
      {/* 评分面板 */}
      <ScoreBoard
        score={score}
        correctCount={correctCount}
        wrongCount={wrongCount}
        combo={combo}
        maxCombo={maxCombo}
        timeLeft={timeLeft}
        lives={lives}
        maxLives={maxLives}
      />

      {/* 进度条 */}
      <div className="mt-4 mb-6">
        <ProgressBar
          current={currentIndex + 1}
          total={questions.length}
          label="游戏进度"
        />
      </div>

      {/* P1-2: word-chain 使用专用组件,其他游戏走标准 QuestionCard */}
      {isWordChain ? (
        <WordChainGame
          questions={questions}
          onAnswer={handleAnswer}
          onFinish={finishSession}
          submitting={submitting}
        />
      ) : (
        <QuestionCard
          question={currentQuestion}
          questionIndex={currentIndex}
          totalQuestions={questions.length}
          onAnswer={handleAnswer}
          feedback={feedback}
          submitting={submitting}
          combo={combo}
          powerUpEffect={powerUpEffect}
          onClearPowerUpEffect={clearPowerUpEffect}
          gameId={gameId}
        />
      )}

      {/* P1-1: 道具工具栏 — 8 种道具全部可点击 */}
      <GameToolbar
        availableProps={availableProps}
        powerUps={powerUps}
        disabled={submitting}
        onApplyPowerUp={applyPowerUp}
      />
    </div>
  );
}
