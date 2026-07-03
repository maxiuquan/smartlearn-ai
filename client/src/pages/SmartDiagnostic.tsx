import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { api } from '../api/client';
import MathRenderer from '../components/MathRenderer';
import { toast } from '../store/toast';
import {
  Target, Zap, Brain, TrendingUp, AlertTriangle, CheckCircle, XCircle,
  ChevronRight, Clock, RotateCcw, Activity, Award, BarChart3, ArrowRight, RefreshCw
} from 'lucide-react';

interface DiagnosticQuestion {
  id: number;
  content: string;
  questionType: 'choice' | 'fill_in' | 'essay';
  options: string[] | null;
  difficulty: number;
  knowledgePoints: { id: number; name: string; category: string }[];
}

interface KnowledgePointReport {
  id: number;
  name: string;
  category: string;
  mastery: number;
}

interface CategoryReport {
  category: string;
  mastery: number;
  knowledgePoints: KnowledgePointReport[];
}

interface DiagnosticReport {
  totalScore: number;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  categoryBreakdown: CategoryReport[];
  weakPoints: KnowledgePointReport[];
}

const QUESTION_TIME_LIMIT = 120;

type DiagnosticMode = 'idle' | 'test' | 'report';

export default function SmartDiagnostic() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);

  const [mode, setMode] = useState<DiagnosticMode>('idle');
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [questionResults, setQuestionResults] = useState<Record<number, boolean | null>>({});
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (mode === 'test' && !questionResults[questions[currentIndex]?.id]) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode, currentIndex, questions]);

  useEffect(() => {
    if (mode === 'test' && timeLeft === 0 && !questionResults[questions[currentIndex]?.id]) {
      handleSubmitAnswer();
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getTimePercent = () => (timeLeft / QUESTION_TIME_LIMIT) * 100;

  const fetchDiagnosticQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/questions/diagnostic');
    if (!res.ok) {
      throw new Error('获取诊断题目失败，请稍后重试');
    }
    const data = await res.json();
    setQuestions(data.questions as DiagnosticQuestion[]);
    setLoading(false);
  }, []);

  const startDiagnostic = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchDiagnosticQuestions();
      setMode('test');
      setCurrentIndex(0);
      setAnswers({});
      setQuestionResults({});
      setReport(null);
      setTimeLeft(QUESTION_TIME_LIMIT);
      setQuestionStartTime(Date.now());
    } catch (err: any) {
      setError(err.message || '加载诊断题目失败');
      toast.error(err.message || '加载诊断题目失败');
    }
    setLoading(false);
  };

  const handleAnswer = (questionId: number, answer: string) => {
    if (questionResults[questionId] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmitAnswer = async () => {
    const q = questions[currentIndex];
    if (!q) return;
    const userAnswer = answers[q.id] || '';
    if (questionResults[q.id] !== undefined && questionResults[q.id] !== null) return;

    try {
      const res = await fetch('/api/practice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 1, questionId: q.id, userAnswer, timeSpent: QUESTION_TIME_LIMIT - timeLeft }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuestionResults((prev) => ({ ...prev, [q.id]: data.isCorrect }));
        return;
      }
      throw new Error('提交答案失败');
    } catch (err: any) {
      toast.error(err.message || '提交答案失败，请重试');
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setTimeLeft(QUESTION_TIME_LIMIT);
      setQuestionStartTime(Date.now());
    }
  };

  const handleCompleteDiagnostic = async () => {
    setLoading(true);
    setError(null);
    try {
      const answerList = Object.entries(answers).map(([qId, ans]) => ({
        questionId: Number(qId),
        answer: ans,
      }));
      const res = await fetch('/api/questions/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 1, answers: answerList }),
      });
      if (!res.ok) {
        throw new Error('获取诊断报告失败');
      }
      const data = await res.json();
      setReport(data as DiagnosticReport);
      setMode('report');
      toast.success('诊断完成，查看你的专属报告');
    } catch (err: any) {
      setError(err.message || '获取诊断报告失败');
      toast.error(err.message || '获取诊断报告失败，请重试');
    }
    setLoading(false);
  };

  const allAnswered = questions.length > 0 && Object.keys(questionResults).length === questions.length;
  const answeredCount = Object.keys(questionResults).length;

  const getLevelInfo = (mastery: number) => {
    if (mastery >= 0.9) return { level: 'Lv.4', label: '精通', color: 'bg-green-500', textColor: 'text-green-600' };
    if (mastery >= 0.7) return { level: 'Lv.3', label: '掌握', color: 'bg-blue-500', textColor: 'text-blue-600' };
    if (mastery >= 0.4) return { level: 'Lv.2', label: '熟悉', color: 'bg-yellow-500', textColor: 'text-yellow-600' };
    if (mastery > 0) return { level: 'Lv.1', label: '了解', color: 'bg-orange-500', textColor: 'text-orange-600' };
    return { level: 'Lv.0', label: '未学习', color: 'bg-gray-400', textColor: 'text-gray-500' };
  };

  const getMasteryBarColor = (mastery: number) => {
    if (mastery >= 0.9) return 'bg-green-500';
    if (mastery >= 0.7) return 'bg-blue-500';
    if (mastery >= 0.4) return 'bg-yellow-500';
    if (mastery > 0) return 'bg-orange-500';
    return 'bg-gray-300';
  };

  const getCategoryColor = (category: string) => {
    if (category === '高等数学') return { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600', icon: '🔵' };
    if (category === '线性代数') return { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600', icon: '🟣' };
    return { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600', icon: '🟢' };
  };

  if (loading && mode === 'idle') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Target className="text-primary-600" />
          智能诊断
        </h1>
        {mode === 'report' && (
          <button onClick={startDiagnostic} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={16} />
            重新诊断
          </button>
        )}
      </div>

      {mode === 'idle' && (
        <div className="card text-center py-16 space-y-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary-100 to-blue-100 rounded-3xl flex items-center justify-center">
            <Brain className="text-primary-600" size={48} />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-gray-900">AI 智能诊断</h2>
            <p className="text-gray-500 max-w-lg mx-auto leading-relaxed">
              系统将为你生成一套跨知识点的诊断题目，通过答题结果智能分析你的掌握程度，找出薄弱环节，为你量身定制学习路径。
            </p>
          </div>
          <div className="flex items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Zap className="text-blue-500" size={24} />
              </div>
              <span className="text-sm text-gray-500">跨知识点</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                <Activity className="text-purple-500" size={24} />
              </div>
              <span className="text-sm text-gray-500">智能分析</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                <BarChart3 className="text-emerald-500" size={24} />
              </div>
              <span className="text-sm text-gray-500">详细报告</span>
            </div>
          </div>
          {error && (
            <div className="flex items-center justify-center gap-2 text-red-600 bg-red-50 rounded-xl py-3 px-4 max-w-lg mx-auto">
              <AlertTriangle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}
          <button onClick={startDiagnostic} className="btn-primary text-lg px-10 py-3.5" disabled={loading}>
            {loading ? '加载中...' : '开始诊断'}
          </button>
        </div>
      )}

      {mode === 'test' && (
        <div className="space-y-6">
          <div className="card sticky top-0 z-10 bg-white/95 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 font-medium">
                  第 {currentIndex + 1} / {questions.length} 题
                </span>
                <div className="w-40 bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-primary-500 transition-all duration-500"
                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Clock size={16} className={timeLeft <= 15 ? 'text-red-500' : 'text-gray-400'} />
                  <span className={`text-sm font-mono font-medium ${timeLeft <= 15 ? 'text-red-500' : 'text-gray-600'}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <div className="w-24 bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-1000 ${timeLeft <= 15 ? 'bg-red-500' : 'bg-primary-400'}`}
                    style={{ width: `${getTimePercent()}%` }}
                  />
                </div>
                {allAnswered && (
                  <button onClick={handleCompleteDiagnostic} className="btn-primary text-sm">
                    查看诊断报告
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex flex-wrap gap-2 mb-4">
              {questions[currentIndex].knowledgePoints.map((kp) => (
                <span key={kp.id} className="px-2.5 py-1 bg-primary-50 text-primary-700 text-xs rounded-full font-medium">
                  {kp.category} · {kp.name}
                </span>
              ))}
              <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                questions[currentIndex].questionType === 'choice'
                  ? 'bg-blue-100 text-blue-700'
                  : questions[currentIndex].questionType === 'fill_in'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-orange-100 text-orange-700'
              }`}>
                {questions[currentIndex].questionType === 'choice' ? '选择题' : questions[currentIndex].questionType === 'fill_in' ? '填空题' : '解答题'}
              </span>
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                {'★'.repeat(questions[currentIndex].difficulty)}{'☆'.repeat(3 - questions[currentIndex].difficulty)}
              </span>
            </div>

            <div className="text-lg text-gray-900 leading-relaxed whitespace-pre-wrap mb-6">
              <MathRenderer content={questions[currentIndex].content} />
            </div>

            {questions[currentIndex].questionType === 'choice' && questions[currentIndex].options && (
              <div className="space-y-3">
                {questions[currentIndex].options.map((option, idx) => {
                  const isSelected = answers[questions[currentIndex].id] === option;
                  const result = questionResults[questions[currentIndex].id];
                  let optionClass = 'border-gray-100 hover:border-gray-200';
                  if (isSelected) {
                    if (result === true) optionClass = 'border-green-400 bg-green-50';
                    else if (result === false) optionClass = 'border-red-400 bg-red-50';
                    else optionClass = 'border-primary-400 bg-primary-50';
                  } else if (result !== undefined && result !== null) {
                    optionClass = 'border-gray-100 opacity-60';
                  }
                  return (
                    <button
                      key={idx}
                      disabled={result !== undefined && result !== null}
                      onClick={() => handleAnswer(questions[currentIndex].id, option)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${optionClass}`}
                    >
                      <span className="font-medium text-gray-500 mr-2">{String.fromCharCode(65 + idx)}.</span>
                      <MathRenderer content={option} />
                    </button>
                  );
                })}
              </div>
            )}

            {(questions[currentIndex].questionType === 'fill_in' || questions[currentIndex].questionType === 'essay') && (
              <input
                type="text"
                value={answers[questions[currentIndex].id] || ''}
                onChange={(e) => handleAnswer(questions[currentIndex].id, e.target.value)}
                disabled={questionResults[questions[currentIndex].id] !== undefined && questionResults[questions[currentIndex].id] !== null}
                placeholder={questions[currentIndex].questionType === 'essay' ? '请输入解答过程或答案...' : '请输入答案...'}
                className={`input-field ${questionResults[questions[currentIndex].id] === true ? 'border-green-400' : questionResults[questions[currentIndex].id] === false ? 'border-red-400' : ''}`}
              />
            )}

            {questionResults[questions[currentIndex].id] !== undefined && questionResults[questions[currentIndex].id] !== null && (
              <div className={`mt-4 p-4 rounded-xl ${questionResults[questions[currentIndex].id] ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2">
                  {questionResults[questions[currentIndex].id] ? (
                    <>
                      <CheckCircle size={20} className="text-green-600" />
                      <span className="text-green-700 font-medium">回答正确</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={20} className="text-red-600" />
                      <span className="text-red-700 font-medium">回答错误</span>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              {questionResults[questions[currentIndex].id] === undefined || questionResults[questions[currentIndex].id] === null ? (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!answers[questions[currentIndex].id]?.trim()}
                  className="btn-primary flex items-center gap-2"
                >
                  确认作答
                </button>
              ) : (
                <>
                  {currentIndex < questions.length - 1 ? (
                    <button onClick={handleNextQuestion} className="btn-primary flex items-center gap-2">
                      下一题 <ChevronRight size={18} />
                    </button>
                  ) : (
                    <button onClick={handleCompleteDiagnostic} className="btn-primary flex items-center gap-2">
                      查看诊断报告 <ArrowRight size={18} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 'report' && report && (
        <div className="space-y-6">
          <div className="card bg-gradient-to-r from-primary-50 via-blue-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                  <Award className="text-primary-600" size={36} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">诊断报告</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    综合评估你的知识掌握情况，找出薄弱环节
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-primary-600">{report.totalScore}</div>
                <div className="text-xs text-gray-400">综合得分</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <div className="text-3xl font-bold text-gray-900">{report.correctCount}<span className="text-lg text-gray-400">/{report.totalCount}</span></div>
              <div className="text-sm text-gray-500 mt-1">正确题数</div>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-gray-900">{Math.round(report.accuracy * 100)}%</div>
              <div className="text-sm text-gray-500 mt-1">正确率</div>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-gray-900">{report.categoryBreakdown.length}</div>
              <div className="text-sm text-gray-500 mt-1">覆盖科目</div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp size={20} className="text-primary-600" />
              科目掌握度
            </h2>
            {report.categoryBreakdown.map((cat) => {
              const colorInfo = getCategoryColor(cat.category);
              return (
                <div key={cat.category} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <span>{colorInfo.icon}</span>
                      {cat.category}
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${colorInfo.bg} transition-all duration-700`}
                          style={{ width: `${Math.round(cat.mastery * 100)}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold ${colorInfo.text}`}>
                        {Math.round(cat.mastery * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {cat.knowledgePoints.map((kp) => {
                      const levelInfo = getLevelInfo(kp.mastery);
                      const barColor = getMasteryBarColor(kp.mastery);
                      const isWeak = report.weakPoints.some((w) => w.id === kp.id);
                      return (
                        <div key={kp.id} className={`flex items-center gap-3 p-2 rounded-lg ${isWeak ? 'bg-red-50 border border-red-100' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm ${isWeak ? 'text-red-700 font-semibold' : 'text-gray-700'}`}>
                                {isWeak && <AlertTriangle size={12} className="inline mr-1 text-red-500" />}
                                {kp.name}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelInfo.color} text-white`}>
                                {levelInfo.level} {levelInfo.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${barColor} transition-all duration-700`}
                                  style={{ width: `${Math.round(kp.mastery * 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs w-10 text-right ${isWeak ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                                {Math.round(kp.mastery * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {report.weakPoints.length > 0 && (
            <div className="card border-red-200 bg-red-50/30">
              <h2 className="text-lg font-bold text-red-800 flex items-center gap-2 mb-4">
                <AlertTriangle size={20} />
                薄弱知识点
              </h2>
              <p className="text-sm text-red-600 mb-4">
                以下知识点掌握度较低，建议优先学习巩固
              </p>
              <div className="space-y-2">
                {report.weakPoints.map((wp) => {
                  const levelInfo = getLevelInfo(wp.mastery);
                  return (
                    <div key={wp.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-red-100">
                      <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                        <AlertTriangle size={16} className="text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-900">{wp.name}</span>
                          <span className="text-xs text-gray-400">{wp.category}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-red-400 transition-all duration-700" style={{ width: `${Math.round(wp.mastery * 100)}%` }} />
                          </div>
                          <span className={`text-xs font-medium ${levelInfo.textColor}`}>
                            {levelInfo.level} · {Math.round(wp.mastery * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => navigate('/chapters')}
              className="btn-primary text-lg px-8 py-3 flex items-center gap-2"
            >
              开始针对性学习
              <ArrowRight size={20} />
            </button>
            <button
              onClick={startDiagnostic}
              className="btn-secondary text-lg px-8 py-3 flex items-center gap-2"
            >
              <RotateCcw size={20} />
              重新诊断
            </button>
          </div>
        </div>
      )}
    </div>
  );
}