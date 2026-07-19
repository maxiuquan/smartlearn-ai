import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameSession } from '../hooks/useGameSession';
import QuestionCard from '../components/QuestionCard';
import ScoreBoard from '../components/ScoreBoard';
import ProgressBar from '../components/ProgressBar';
import HandwritingPad from '../components/HandwritingPad';
import ScratchPad from '../components/ScratchPad';

interface Feedback {
  isCorrect: boolean;
  message: string;
}

export default function MathGame() {
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
  const [toolPanel, setToolPanel] = useState<'none' | 'handwriting' | 'scratch'>('none');
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatedRef = useRef(false);

  // 开始游戏
  useEffect(() => {
    if (!gameId) return;
    startSession(gameId);
  }, [gameId, startSession]);

  // 游戏结束后跳转结果页
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
        setTimeout(() => setSubmitting(false), 1200);
      }
    },
    [submitting, submitCurrentAnswer]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-4" />
        <p className="text-gray-500">正在加载数学游戏...</p>
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
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          返回游戏大厅
        </button>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* 数学游戏标题 */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-orange-700">🔢 数学游戏</h2>
      </div>

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

      {/* 题目卡片 - 使用 QuestionCard 支持全部 7 种题型（含 tap_match/drag_sort）*/}
      <QuestionCard
        question={currentQuestion}
        questionIndex={currentIndex}
        totalQuestions={questions.length}
        onAnswer={handleAnswer}
        feedback={feedback}
        submitting={submitting}
      />

      {/* 辅助工具切换 */}
      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={() => setToolPanel(toolPanel === 'handwriting' ? 'none' : 'handwriting')}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
            toolPanel === 'handwriting'
              ? 'border-purple-400 bg-purple-50 text-purple-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          ✍️ 手写板
        </button>
        <button
          type="button"
          onClick={() => setToolPanel(toolPanel === 'scratch' ? 'none' : 'scratch')}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
            toolPanel === 'scratch'
              ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          📝 草稿纸
        </button>
      </div>

      {/* 手写板面板 */}
      {toolPanel === 'handwriting' && (
        <div className="mt-3">
          <HandwritingPad height={260} />
          <p className="text-xs text-gray-400 mt-1">
            支持鼠标/触摸手写，可撤销、清空、保存图片。用于书写推导步骤或绘制图形。
          </p>
        </div>
      )}

      {/* 草稿纸面板 */}
      {toolPanel === 'scratch' && (
        <div className="mt-3">
          <ScratchPad height={260} />
        </div>
      )}
    </div>
  );
}
