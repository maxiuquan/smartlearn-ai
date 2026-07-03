import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { api } from '../api/client';
import HandwritingCanvas from '../components/HandwritingCanvas';
import MathRenderer from '../components/MathRenderer';
import { StopPointDetector, PrerequisiteChain, AdaptiveDifficultyIndicator } from '../components/StopPointDetector';
import KnowledgeCard from '../components/KnowledgeCard';
import type { Question, AnalysisResult } from '../types';
import { Brain, Send, RotateCcw, CheckCircle, XCircle, Lightbulb, AlertTriangle, ChevronRight, ArrowLeft, ArrowRight, BarChart3, Timer, Hash, Activity, BookOpen, RefreshCw, Calendar, Bookmark } from 'lucide-react';
import { toast } from '../store/toast';

interface FromScratchStep {
  step: number;
  knowledgePointId: number;
  name: string;
  category: string;
  chapter: string;
  difficulty: number;
  mastery: number;
  isUnlocked: boolean;
  isCompleted: boolean;
}

function adaptiveDifficultySelector(masteryLevel: number, recentAccuracy: number, consecutiveCorrect: number, consecutiveWrong: number): number {
  if (consecutiveWrong >= 3) return 1;
  if (consecutiveCorrect >= 5) {
    if (masteryLevel >= 0.7) return 4;
    if (masteryLevel >= 0.4) return 3;
    return 2;
  }
  if (recentAccuracy >= 0.85) {
    return masteryLevel >= 0.7 ? 4 : 3;
  }
  if (recentAccuracy >= 0.6) {
    return masteryLevel >= 0.7 ? 3 : 2;
  }
  return 1;
}

function inferClassification(result: AnalysisResult): 'misconception' | 'method_missing' | 'knowledge_gap' | 'careless' {
  if (result.prerequisiteGaps && result.prerequisiteGaps.length > 0) {
    return 'knowledge_gap';
  }
  if (result.weakPoints && result.weakPoints.length > 0) {
    const analysis = result.analysis || '';
    if (analysis.includes('概念') || analysis.includes('误解') || analysis.includes('定义') || analysis.includes('理解')) {
      return 'misconception';
    }
    return 'method_missing';
  }
  return 'careless';
}

export default function MathPractice() {
  const userId = useAuthStore((s) => s.userId);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = searchParams.get('mode') || 'chapter';
  const category = searchParams.get('category') || '';
  const chapter = searchParams.get('chapter') || '';

  const [question, setQuestion] = useState<Question | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [inputMode, setInputMode] = useState<'handwrite' | 'type'>('handwrite');
  const [fromScratchPath, setFromScratchPath] = useState<FromScratchStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const [scaffoldSessionId, setScaffoldSessionId] = useState<string | null>(null);
  const [scaffoldHints, setScaffoldHints] = useState<string[]>([]);
  const [scaffoldAnswer, setScaffoldAnswer] = useState<string | null>(null);
  const [scaffoldSolution, setScaffoldSolution] = useState<string | null>(null);
  const [scaffoldLoading, setScaffoldLoading] = useState(false);
  const [showStopPoint, setShowStopPoint] = useState(false);
  const [prerequisites, setPrerequisites] = useState<{ id: number; name: string; mastery?: number }[]>([]);
  const [currentMastery, setCurrentMastery] = useState(0);
  const [recentAccuracy, setRecentAccuracy] = useState(0.7);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const [errorClassification, setErrorClassification] = useState<'misconception' | 'method_missing' | 'knowledge_gap' | 'careless'>('careless');
  const [showKnowledgeCard, setShowKnowledgeCard] = useState(false);

  useEffect(() => {
    if (question && !analysis) {
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [question, analysis]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const fetchFromScratchPath = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/knowledge/from-scratch/${userId}`);
      const data = await res.json();
      setFromScratchPath(data.path);
      setCurrentStep(data.currentStep);
      setTotalSteps(data.totalSteps);
    } catch (err) {
      console.error('获取学习路径失败', err);
    }
  }, [userId]);

  const fetchPrerequisiteChain = useCallback(async (kpId: number) => {
    try {
      const res = await fetch(`/api/knowledge/prerequisites/${kpId}`);
      if (!res.ok) return;
      const data = await res.json();
      const chain: { id: number; name: string; mastery?: number }[] = [];
      if (data.prerequisites && Array.isArray(data.prerequisites)) {
        for (const p of data.prerequisites) {
          chain.push({ id: p.id, name: p.name, mastery: p.masteryLevel ?? 0 });
        }
      }
      chain.push({ id: data.knowledgePoint?.id ?? kpId, name: data.knowledgePoint?.name ?? '当前', mastery: data.knowledgePoint?.masteryLevel ?? 0 });
      setPrerequisites(chain);
    } catch { /* ignore */ }
  }, []);

  const fetchCurrentMastery = useCallback(async (kpIds: number[]) => {
    if (!userId || kpIds.length === 0) return;
    try {
      const params = kpIds.map(id => `id=${id}`).join('&');
      const res = await fetch(`/api/knowledge/progress?userId=${userId}&${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const avgMastery = data.progress && data.progress.length > 0
        ? data.progress.reduce((s: number, p: { masteryLevel: number }) => s + (p.masteryLevel || 0), 0) / data.progress.length
        : 0;
      setCurrentMastery(avgMastery);
    } catch { /* ignore */ }
  }, [userId]);

  useEffect(() => {
    if (question && question.knowledgePoints && question.knowledgePoints.length > 0) {
      const kpIds = question.knowledgePoints.map(kp => kp.id);
      fetchPrerequisiteChain(kpIds[0]);
      fetchCurrentMastery(kpIds);
    }
  }, [question, fetchPrerequisiteChain, fetchCurrentMastery]);

  useEffect(() => {
    if (mode === 'from-scratch') {
      fetchFromScratchPath();
    }
  }, [mode, fetchFromScratchPath]);

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    setAnalysis(null);
    setUserAnswer('');
    try {
      if (mode === 'from-scratch' && fromScratchPath.length > 0) {
        const current = fromScratchPath.find(p => p.isUnlocked && !p.isCompleted) || fromScratchPath[0];
        const data = await api.getQuestions({
          knowledgePointId: String(current.knowledgePointId),
          limit: '20',
        });
        const eligible = data.questions.filter((q: unknown) => {
          const question = q as Question;
          return question.questionType !== 'essay' || current.difficulty <= 2;
        });
        if (eligible.length > 0) {
          const targetDifficulty = adaptiveDifficultySelector(currentMastery, recentAccuracy, consecutiveCorrect, consecutiveWrong);
          const filtered = eligible.filter((q: unknown) => {
            const question = q as Question;
            return Math.abs((question.difficulty ?? 3) - targetDifficulty) <= 1;
          });
          const pool = filtered.length > 0 ? filtered : eligible;
          setQuestion(pool[Math.floor(Math.random() * pool.length)] as Question);
        } else {
          const chapterData = await api.getQuestions({ chapter: current.chapter, limit: '100' });
          if (chapterData.questions.length > 0) {
            setQuestion(chapterData.questions[Math.floor(Math.random() * chapterData.questions.length)] as Question);
          }
        }
      } else if (mode === 'from-scratch') {
        setLoading(false);
        return;
      } else if (chapter) {
        const data = await api.getQuestions({ chapter, limit: '100' });
        if (data.questions.length > 0) {
          const targetDifficulty = adaptiveDifficultySelector(currentMastery, recentAccuracy, consecutiveCorrect, consecutiveWrong);
          const filtered = data.questions.filter((q: unknown) => {
            const question = q as Question;
            return Math.abs((question.difficulty ?? 3) - targetDifficulty) <= 1;
          });
          const pool = filtered.length > 0 ? filtered : data.questions;
          setQuestion(pool[Math.floor(Math.random() * pool.length)] as Question);
        }
      } else {
        const data = await api.getQuestions({ limit: '50' });
        if (data.questions.length > 0) {
          const targetDifficulty = adaptiveDifficultySelector(currentMastery, recentAccuracy, consecutiveCorrect, consecutiveWrong);
          const filtered = data.questions.filter((q: unknown) => {
            const question = q as Question;
            return Math.abs((question.difficulty ?? 3) - targetDifficulty) <= 1;
          });
          const pool = filtered.length > 0 ? filtered : data.questions;
          setQuestion(pool[Math.floor(Math.random() * pool.length)] as Question);
        }
      }
      setStartTime(Date.now());
    } catch (err) {
      console.error('获取题目失败', err);
    } finally {
      setLoading(false);
    }
  }, [mode, chapter, category, fromScratchPath, currentMastery, recentAccuracy, consecutiveCorrect, consecutiveWrong]);

  useEffect(() => {
    fetchQuestion();
  }, [fetchQuestion]);

  const handleSubmit = async () => {
    if (!question || !userId) return;
    setSubmitting(true);
    try {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      const result = await api.submitAnswer({
        userId,
        questionId: question.id,
        userAnswer,
        timeSpent,
      });
      setAnalysis(result);
      if (result.isCorrect) {
        toast.success('回答正确！');
        setConsecutiveCorrect(c => c + 1);
        setConsecutiveWrong(0);
      } else {
        toast.error('回答错误，查看解析学习吧');
        setConsecutiveWrong(w => w + 1);
        setConsecutiveCorrect(0);
        const inferred = inferClassification(result);
        setErrorClassification(inferred);
        if (consecutiveWrong + 1 >= 3) {
          toast.error('连续答错3次，建议进入「断点突破」模式');
        }
      }
      setRecentAccuracy(prev => {
        const updated = result.isCorrect
          ? prev * 0.7 + 1 * 0.3
          : prev * 0.7 + 0 * 0.3;
        return updated;
      });

      if (mode === 'from-scratch') {
        await fetchFromScratchPath();
      }
    } catch (err) {
      console.error('提交失败', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChoiceSelect = (option: string) => {
    setUserAnswer(option);
  };

  const handleNext = () => {
    setAnalysis(null);
    setUserAnswer('');
    setElapsed(0);
    setQuestionCount(prev => prev + 1);
    setScaffoldSessionId(null);
    setScaffoldHints([]);
    setScaffoldAnswer(null);
    setScaffoldSolution(null);
    setScaffoldLoading(false);
    setShowKnowledgeCard(false);
    if (mode === 'from-scratch') {
      fetchFromScratchPath();
    } else {
      fetchQuestion();
    }
  };

  const startScaffold = async () => {
    if (!question || scaffoldLoading) return;
    setScaffoldLoading(true);
    try {
      const res = await fetch('/api/scaffold/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id }),
      });
      const data = await res.json();
      setScaffoldSessionId(data.sessionId);
      await fetchScaffoldHint(data.sessionId);
    } catch (err) {
      console.error('启动支架教学失败', err);
    } finally {
      setScaffoldLoading(false);
    }
  };

  const fetchScaffoldHint = async (sessionId: string) => {
    setScaffoldLoading(true);
    try {
      const res = await fetch('/api/scaffold/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.hint) {
        setScaffoldHints(prev => [...prev, data.hint.content]);
        if (data.allHintsUsed) {
          setScaffoldAnswer(data.answer || null);
          setScaffoldSolution(data.solution || null);
        }
      } else {
        const revealRes = await fetch('/api/scaffold/reveal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const revealData = await revealRes.json();
        setScaffoldAnswer(revealData.answer || null);
        setScaffoldSolution(revealData.solution || null);
      }
    } catch (err) {
      console.error('获取支架提示失败', err);
    } finally {
      setScaffoldLoading(false);
    }
  };

  const handleNextScaffoldHint = () => {
    if (scaffoldSessionId) {
      fetchScaffoldHint(scaffoldSessionId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 mb-4">该章节暂无可用题目</p>
        <button onClick={() => navigate('/chapters')} className="btn-secondary">
          返回章节选择
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/chapters')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Brain className="text-primary-600" />
              {mode === 'from-scratch' ? '从零开始' : chapter || '数学练习'}
            </h1>
            {mode === 'from-scratch' && (
              <p className="text-sm text-gray-500 mt-0.5">
                第 {currentStep} / {totalSteps} 步
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowStopPoint(s => !s)}
            className={`flex items-center gap-1.5 text-sm rounded-lg px-3 py-1.5 border transition-colors ${
              showStopPoint
                ? 'bg-orange-50 text-orange-700 border-orange-200'
                : 'bg-white text-gray-500 border-gray-200 hover:text-orange-600'
            }`}
            title='智能断点检测'
          >
            <Activity size={14} />
            <span className="hidden md:inline">断点诊断</span>
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-white rounded-lg px-3 py-1.5 border">
            <Hash size={14} />
            <span>第 {questionCount + 1} 题</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-white rounded-lg px-3 py-1.5 border">
            <Timer size={14} />
            <span className="font-mono">{formatTime(elapsed)}</span>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${inputMode === 'handwrite' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'}`}
              onClick={() => setInputMode('handwrite')}
            >
              手写
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${inputMode === 'type' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'}`}
              onClick={() => setInputMode('type')}
            >
              输入
            </button>
          </div>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <BarChart3 size={14} />
            {'★'.repeat(question.difficulty)}{'☆'.repeat(3 - question.difficulty)}
          </span>
        </div>
      </div>

      {mode === 'from-scratch' && fromScratchPath.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-3 flex gap-1 overflow-x-auto">
          {fromScratchPath.slice(
            Math.max(0, currentStep - 4),
            Math.min(fromScratchPath.length, currentStep + 3)
          ).map((step) => (
            <div
              key={step.step}
              className={`flex-shrink-0 w-3 h-3 rounded-full ${
                step.isCompleted ? 'bg-green-400' :
                step.step === currentStep ? 'bg-primary-500 ring-2 ring-primary-200' :
                step.isUnlocked ? 'bg-gray-300' : 'bg-gray-200'
              }`}
              title={`${step.name} (${step.mastery > 0 ? Math.round(step.mastery * 100) + '%' : '未学'})`}
            />
          ))}
        </div>
      )}

      {showStopPoint && (
        <div className="animate-fade-in">
          <StopPointDetector
            userId={userId}
            currentKnowledgePointId={question?.knowledgePoints?.[0]?.id}
            onSelectRecovery={(kpId) => {
              const kp = question?.knowledgePoints?.find(k => k.id === kpId);
              if (kp) {
                fetch('/api/knowledge/progress?userId=' + userId + '&id=' + kpId)
                  .then(r => r.json())
                  .catch(() => null);
              }
              setShowStopPoint(false);
              toast.info('已锁定该知识点，下一题将聚焦此断点');
            }}
          />
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap gap-2 mb-4">
          {question.knowledgePoints.map((kp) => (
            <span key={kp.id} className="px-2.5 py-1 bg-primary-50 text-primary-700 text-xs rounded-full font-medium">
              {kp.name}
            </span>
          ))}
          {analysis && !analysis.isCorrect && consecutiveWrong >= 2 && (
            <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium flex items-center gap-1 animate-pulse">
              <AlertTriangle size={12} />
              连续答错 {consecutiveWrong} 次，建议断点突破
            </span>
          )}
        </div>

        {prerequisites.length > 0 && (
          <div className="mb-4">
            <PrerequisiteChain knowledgePoints={prerequisites} currentKpId={question.knowledgePoints?.[0]?.id ?? -1} />
          </div>
        )}

        <div className="mb-4">
          <AdaptiveDifficultyIndicator
            difficulty={question.difficulty ?? 3}
            masteryLevel={currentMastery}
            recentAccuracy={recentAccuracy}
          />
        </div>

        <div className="text-lg text-gray-900 leading-relaxed whitespace-pre-wrap">
          <MathRenderer content={question.content} />
        </div>

        {question.questionType === 'choice' && question.options && (
          <div className="mt-6 space-y-3">
            {question.options.map((option, idx) => (
              <button
                key={idx}
                disabled={!!analysis}
                onClick={() => handleChoiceSelect(option)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                  userAnswer === option
                    ? analysis
                      ? analysis.correctAnswer === option
                        ? 'border-green-400 bg-green-50'
                        : 'border-red-400 bg-red-50'
                      : 'border-primary-400 bg-primary-50'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <span className="font-medium text-gray-500 mr-2">{String.fromCharCode(65 + idx)}.</span>
                {option}
              </button>
            ))}
          </div>
        )}

        {question.questionType === 'fill_in' && (
          <div className="mt-6">
            {inputMode === 'handwrite' ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">请在下方手写区域作答：</p>
                <HandwritingCanvas className="h-40" />
                <input
                  type="text"
                  className="input-field"
                  placeholder="或在此输入答案（如：3, x^2+C）"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  disabled={!!analysis}
                />
              </div>
            ) : (
              <input
                type="text"
                className="input-field"
                placeholder="输入你的答案（如：3, x^2+C）"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                disabled={!!analysis}
              />
            )}
          </div>
        )}

        {question.questionType === 'essay' && (
          <div className="mt-6">
            {inputMode === 'handwrite' ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">请在下方手写区域作答：</p>
                <HandwritingCanvas className="h-48" />
              </div>
            ) : null}
            <textarea
              className="input-field mt-3"
              rows={4}
              placeholder="输入你的解题过程或答案..."
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={!!analysis}
            />
          </div>
        )}

        {!analysis && (
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting || !userAnswer.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <Send size={18} />
              )}
              提交答案
            </button>
            <button onClick={fetchQuestion} className="btn-secondary flex items-center gap-2">
              <RotateCcw size={18} />
              换一题
            </button>
          </div>
        )}
      </div>

      {analysis && (
        <div className="card space-y-5">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${analysis.isCorrect ? 'bg-green-100 shadow-green-200' : 'bg-red-100 shadow-red-200'}`}>
              {analysis.isCorrect ? <CheckCircle className="w-7 h-7 text-green-600" /> : <XCircle className="w-7 h-7 text-red-600" />}
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900">{analysis.isCorrect ? '回答正确！' : '回答错误'}</h3>
              {!analysis.isCorrect && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-500">正确答案：</span>
                  <span className="text-sm font-medium text-gray-900"><MathRenderer content={analysis.correctAnswer} /></span>
                </div>
              )}
            </div>
          </div>

          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
            <h4 className="font-semibold text-blue-900 flex items-center gap-2 mb-3">
              <Lightbulb size={18} /> 智能分析
            </h4>
            <p className="text-sm text-blue-800 whitespace-pre-wrap leading-relaxed"><MathRenderer content={analysis.analysis} /></p>
          </div>

          {analysis && !analysis.isCorrect && (
            <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              {!scaffoldSessionId ? (
                <button
                  onClick={startScaffold}
                  disabled={scaffoldLoading}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-yellow-100 hover:bg-yellow-200 rounded-lg transition-colors text-yellow-800 font-medium"
                >
                  {scaffoldLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-600 border-t-transparent" />
                  ) : (
                    <Lightbulb size={18} />
                  )}
                  不会做？让AI一步步引导你
                </button>
              ) : (
                <div className="space-y-3">
                  {scaffoldHints.map((hint, i) => (
                    <div key={i} className="p-3 bg-white rounded-lg border border-yellow-100">
                      <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                        提示 {i + 1}
                      </span>
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap"><MathRenderer content={hint} /></p>
                    </div>
                  ))}
                  {scaffoldAnswer && (
                    <div className="p-3 bg-white rounded-lg border border-green-200">
                      <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        正确答案
                      </span>
                      <p className="text-sm text-gray-900 mt-2 font-medium"><MathRenderer content={scaffoldAnswer} /></p>
                    </div>
                  )}
                  {scaffoldSolution && (
                    <div className="p-3 bg-white rounded-lg border border-blue-200">
                      <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                        解题过程
                      </span>
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap"><MathRenderer content={scaffoldSolution} /></p>
                    </div>
                  )}
                  {!scaffoldAnswer && !scaffoldSolution && (
                    <button
                      onClick={handleNextScaffoldHint}
                      disabled={scaffoldLoading}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-yellow-100 hover:bg-yellow-200 rounded-lg transition-colors text-yellow-800 font-medium text-sm"
                    >
                      {scaffoldLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-600 border-t-transparent" />
                      ) : (
                        <Lightbulb size={16} />
                      )}
                      还需要提示
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {analysis && !analysis.isCorrect && (
            <div className="p-5 bg-red-50 rounded-2xl border border-red-200">
              <h4 className="font-semibold text-red-900 flex items-center gap-2 mb-3 text-sm">
                <AlertTriangle size={16} /> 错误类型分析
              </h4>
              <p className="text-xs text-red-600 mb-3">AI 推断你的错误属于以下类型，可以手动调整：</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {([
                  { key: 'misconception', label: '概念误解' },
                  { key: 'method_missing', label: '方法缺失' },
                  { key: 'knowledge_gap', label: '知识缺口' },
                  { key: 'careless', label: '粗心' },
                ] as const).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setErrorClassification(item.key)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                      errorClassification === item.key
                        ? 'bg-red-500 text-white shadow-sm'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-red-300 hover:text-red-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="bg-white rounded-xl p-4 border border-red-100">
                {errorClassification === 'misconception' && (
                  <div>
                    <p className="text-sm font-semibold text-red-800 mb-2">概念误解</p>
                    <p className="text-xs text-red-700 leading-relaxed">
                      你可能混淆了相关概念的定义或适用范围。请查阅以下知识点定义：
                    </p>
                    {question.knowledgePoints.length > 0 && (
                      <button
                        onClick={() => setShowKnowledgeCard(true)}
                        className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                      >
                        <BookOpen size={12} />
                        查看「{question.knowledgePoints[0].name}」知识卡
                      </button>
                    )}
                  </div>
                )}
                {errorClassification === 'method_missing' && (
                  <div>
                    <p className="text-sm font-semibold text-blue-800 mb-2">方法缺失</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      你对该类题型的解题方法还不够熟悉。建议开启支架引导，逐步学习标准解题步骤：
                    </p>
                    {!scaffoldSessionId && (
                      <button
                        onClick={startScaffold}
                        disabled={scaffoldLoading}
                        className="mt-2 text-xs font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <Lightbulb size={12} />
                        获取分步引导
                      </button>
                    )}
                  </div>
                )}
                {errorClassification === 'knowledge_gap' && (
                  <div>
                    <p className="text-sm font-semibold text-orange-800 mb-2">知识缺口</p>
                    <p className="text-xs text-orange-700 leading-relaxed mb-3">
                      你的前置知识点掌握不足，影响了当前题目的解答。建议先巩固以下前置知识：
                    </p>
                    {analysis.prerequisiteGaps.length > 0 ? (
                      <div className="space-y-2">
                        {analysis.prerequisiteGaps.map((gap: any) => (
                          <div key={gap.id} className="flex items-center justify-between bg-orange-50 rounded-lg p-2.5 border border-orange-100">
                            <div>
                              <p className="text-xs font-medium text-gray-900">{gap.name}</p>
                              <p className="text-[10px] text-gray-500">{gap.category}</p>
                            </div>
                            <button
                              onClick={() => {
                                const params = new URLSearchParams();
                                params.set('mode', 'chapter');
                                params.set('chapter', gap.chapter || '');
                                navigate(`/practice?${params.toString()}`);
                              }}
                              className="text-xs font-medium text-orange-600 bg-orange-100 hover:bg-orange-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                            >
                              去学习 <ArrowRight size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowKnowledgeCard(true)}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                      >
                        <BookOpen size={12} />
                        查看相关知识卡
                      </button>
                    )}
                  </div>
                )}
                {errorClassification === 'careless' && (
                  <div>
                    <p className="text-sm font-semibold text-yellow-800 mb-2">粗心</p>
                    <p className="text-xs text-yellow-700 leading-relaxed mb-3">
                      你的解题思路基本正确，但可能在计算或书写过程中出现了失误。对比一下你的答案和正确答案：
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                        <p className="text-[10px] font-semibold text-red-600 mb-1">你的答案</p>
                        <p className="text-sm text-red-700 font-medium"><MathRenderer content={userAnswer} /></p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                        <p className="text-[10px] font-semibold text-green-600 mb-1">正确答案</p>
                        <p className="text-sm text-green-700 font-medium"><MathRenderer content={analysis.correctAnswer} /></p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {analysis && !analysis.isCorrect && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  setLoading(true);
                  setAnalysis(null);
                  setUserAnswer('');
                  try {
                    const data = await api.getQuestions({
                      knowledgePointId: String(question.knowledgePoints[0]?.id || ''),
                      limit: '20',
                    });
                    if (data.questions.length > 0) {
                      const filtered = data.questions.filter((q: unknown) => {
                        const qq = q as Question;
                        return qq.id !== question.id;
                      });
                      const pool = filtered.length > 0 ? filtered : data.questions;
                      setQuestion(pool[Math.floor(Math.random() * pool.length)] as Question);
                      setStartTime(Date.now());
                      setElapsed(0);
                      setScaffoldSessionId(null);
                      setScaffoldHints([]);
                      setScaffoldAnswer(null);
                      setScaffoldSolution(null);
                      setScaffoldLoading(false);
                      setShowKnowledgeCard(false);
                    }
                  } catch {
                    toast.error('获取同类题目失败');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
              >
                <RefreshCw size={14} />
                同类题再练
              </button>
              <button
                onClick={() => {
                  const queueStr = localStorage.getItem('redo_queue');
                  const queue = queueStr ? JSON.parse(queueStr) : [];
                  const sevenDaysLater = new Date();
                  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
                  queue.push({
                    questionId: question.id,
                    questionContent: question.content,
                    knowledgePointId: question.knowledgePoints[0]?.id,
                    knowledgePointName: question.knowledgePoints[0]?.name,
                    correctAnswer: analysis.correctAnswer,
                    dueDate: sevenDaysLater.toISOString(),
                    createdAt: new Date().toISOString(),
                  });
                  localStorage.setItem('redo_queue', JSON.stringify(queue));
                  toast.success('已加入7天后重做队列');
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
              >
                <Calendar size={14} />
                7天后重做
              </button>
              <button
                onClick={() => setShowKnowledgeCard(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
              >
                <Bookmark size={14} />
                查看知识卡
              </button>
            </div>
          )}

          {showKnowledgeCard && question.knowledgePoints.length > 0 && (
            <div className="border-2 border-primary-100 rounded-2xl overflow-hidden">
              <KnowledgeCard
                knowledgePointId={question.knowledgePoints[0].id}
                onClose={() => setShowKnowledgeCard(false)}
                compact
              />
            </div>
          )}

          {analysis.isCorrect && (
            <div className="p-4 bg-green-50 rounded-xl border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={18} className="text-green-600" />
                <h4 className="font-semibold text-green-900 text-sm">掌握度提升</h4>
              </div>
              <div className="space-y-2">
                {question.knowledgePoints.map((kp) => (
                  <div key={kp.id} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 flex-1">{kp.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border">
                        掌握度 {Math.round(currentMastery * 100)}% → {Math.round(Math.min(currentMastery + 0.15, 1) * 100)}%
                      </span>
                      <span className="text-xs text-green-600 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                        +15%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.weakPoints.length > 0 && (
            <div className="p-5 bg-orange-50 rounded-2xl border border-orange-100">
              <h4 className="font-semibold text-orange-900 flex items-center gap-2 mb-3">
                <AlertTriangle size={18} /> 知识点拆解 · 薄弱环节
              </h4>
              <div className="space-y-3">
                {analysis.weakPoints.map((wp: any) => {
                  const mastery = wp.masteryLevel ?? 0.3;
                  const masteryPercent = Math.round(mastery * 100);
                  const barColor = mastery >= 0.7 ? 'bg-green-400' : mastery >= 0.4 ? 'bg-yellow-400' : 'bg-orange-400';
                  return (
                    <div key={wp.id} className="bg-white rounded-xl p-3 border border-orange-100">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{wp.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{wp.reason}</p>
                        </div>
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">{wp.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div className={`h-2 rounded-full ${barColor} transition-all duration-500`} style={{ width: `${masteryPercent}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{masteryPercent}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {analysis.prerequisiteGaps.length > 0 && (
            <div className="p-5 bg-red-50 rounded-2xl border border-red-100">
              <h4 className="font-semibold text-red-900 flex items-center gap-2 mb-3">
                <AlertTriangle size={18} /> 前置知识点薄弱 · 建议优先巩固
              </h4>
              <p className="text-xs text-red-600 mb-3">以下前置知识点掌握不足，可能影响你对当前题目的理解</p>
              <div className="space-y-3">
                {analysis.prerequisiteGaps.map((gap: any) => {
                  const masteryPercent = Math.round((gap.masteryLevel ?? 0) * 100);
                  return (
                    <div key={gap.id} className="bg-white rounded-xl p-3 border border-red-100 flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${masteryPercent >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900 truncate">{gap.name}</p>
                          <span className="text-xs text-red-400 bg-red-50 px-2 py-0.5 rounded-full shrink-0 ml-2">{gap.category}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-red-400 transition-all duration-500" style={{ width: `${masteryPercent}%` }} />
                          </div>
                          <span className="text-xs text-red-500">{masteryPercent}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {analysis.isCorrect && analysis.weakPoints.length === 0 && analysis.prerequisiteGaps.length === 0 && (
            <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
              <p className="text-sm text-green-700 font-medium">👍 所有涉及的知识点你都掌握得很好！继续保持！</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={handleNext} className="btn-primary flex items-center gap-2">
              下一题 <ChevronRight size={18} />
            </button>
            <button onClick={() => navigate('/chapters')} className="btn-secondary">
              返回章节
            </button>
            {analysis.prerequisiteGaps.length > 0 && (
              <button onClick={() => navigate('/chapters')} className="btn-secondary text-orange-600 border-orange-200">
                去巩固前置知识
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}