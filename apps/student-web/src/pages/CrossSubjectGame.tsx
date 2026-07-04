import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startGame, submitAnswer, type SubmitAnswerParams } from '../api/client';
import QuestionCard from '../components/QuestionCard';
import ScoreBoard from '../components/ScoreBoard';
import ProgressBar from '../components/ProgressBar';

interface Question {
  question_id: string;
  question_type: string;
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  hint: string | null;
  points: number;
  word?: {
    word: string;
    meaning: string;
    pronunciation?: string;
  };
}

interface Feedback {
  isCorrect: boolean;
  message: string;
}

export default function CrossSubjectGame() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const [sessionId, setSessionId] = useState('');
  const [question, setQuestion] = useState<Question | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const questionStartTime = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // 开始游戏
  useEffect(() => {
    if (!gameId) return;

    (async () => {
      try {
        setLoading(true);
        setError('');
        const data = await startGame({ gameId });

        setSessionId(data.session.session_id);
        setQuestion(data.first_question);
        setTotalQuestions(data.total_questions);
        setTimeLeft(data.session.time_limit_seconds);
        questionStartTime.current = Date.now();
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || '无法连接游戏服务，请确认 AI 引擎已启动');
      } finally {
        setLoading(false);
      }
    })();
  }, [gameId]);

  // 倒计时
  useEffect(() => {
    if (timeLeft <= 0 || loading) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          navigate(`/result/${sessionId}`, { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timeLeft, loading, sessionId, navigate]);

  // 提交答案
  const handleAnswer = useCallback(
    async (answer: string) => {
      if (submitting || !question) return;

      setSubmitting(true);
      const timeSpent = Math.round((Date.now() - questionStartTime.current) / 1000);

      try {
        const params: SubmitAnswerParams = {
          sessionId,
          questionId: question.question_id,
          userAnswer: answer,
          timeSpentSeconds: timeSpent,
        };

        const data = await submitAnswer(params);

        setScore(data.current_score);
        if (data.result.is_correct) {
          setCorrectCount((c) => c + 1);
          setCombo((c) => c + 1);
        } else {
          setWrongCount((c) => c + 1);
          setCombo(0);
        }

        setFeedback({
          isCorrect: data.result.is_correct,
          message: data.result.feedback,
        });

        setTimeout(() => {
          setFeedback(null);

          if (data.is_game_over) {
            clearInterval(timerRef.current);
            setTimeout(() => {
              navigate(`/result/${sessionId}`, { replace: true });
            }, 500);
          } else if (data.next_question) {
            setQuestion(data.next_question);
            setQuestionIndex((i) => i + 1);
            questionStartTime.current = Date.now();
          }
          setSubmitting(false);
        }, 1200);
      } catch (err: any) {
        setFeedback({
          isCorrect: false,
          message: '提交失败，请重试',
        });
        setSubmitting(false);
      }
    },
    [submitting, question, sessionId, navigate]
  );

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
          onClick={() => navigate('/')}
          className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          返回游戏大厅
        </button>
      </div>
    );
  }

  if (!question) return null;

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
        timeLeft={timeLeft}
      />

      {/* 进度条 */}
      <div className="mt-4 mb-6">
        <ProgressBar
          current={questionIndex + 1}
          total={totalQuestions}
          label="游戏进度"
        />
      </div>

      {/* 题目卡片 */}
      <QuestionCard
        question={question}
        questionIndex={questionIndex}
        totalQuestions={totalQuestions}
        onAnswer={handleAnswer}
        feedback={feedback}
        submitting={submitting}
      />
    </div>
  );
}