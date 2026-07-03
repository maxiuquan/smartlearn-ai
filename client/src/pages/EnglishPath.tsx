import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';
import {
  GraduationCap, Target, BookOpen, ChevronRight, ChevronDown,
  Check, X, Trophy, Zap, TrendingUp,
  RotateCcw, Award, Calendar, Sparkles, ArrowRight,
  CheckCircle, Circle, Play
} from 'lucide-react';

interface AssessmentQuestion {
  id: number;
  question: string;
  options: string[];
  answer: string;
}

interface AssessmentResult {
  accuracy: number;
  level: string;
  levelLabel: string;
  correctCount: number;
  totalCount: number;
}

interface PathTask {
  id: number;
  name: string;
  description: string;
  completed: boolean;
}

interface PathStage {
  id: number;
  name: string;
  focus: string;
  targetVocab: number;
  estimatedWeeks: number;
  status: 'completed' | 'current' | 'upcoming';
  tasks: PathTask[];
}

interface WeeklyGoal {
  learned: number;
  target: number;
  week: number;
}

interface LearningPath {
  id: number;
  level: string;
  levelLabel: string;
  targetExam: string;
  totalVocab: number;
  masteredVocab: number;
  stages: PathStage[];
  weeklyGoals: WeeklyGoal[];
}

const LEVEL_THEMES: Record<string, { color: string; bg: string; textColor: string; icon: string; label: string }> = {
  '初级': { color: 'bg-green-500', bg: 'bg-green-50', textColor: 'text-green-600', icon: '🌱', label: '初级' },
  '中级': { color: 'bg-blue-500', bg: 'bg-blue-50', textColor: 'text-blue-600', icon: '📘', label: '中级' },
  '高级': { color: 'bg-purple-500', bg: 'bg-purple-50', textColor: 'text-purple-600', icon: '👑', label: '高级' },
};

export default function EnglishPath() {
  const { userId } = useAuthStore();
  const [assessed, setAssessed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<LearningPath | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (userId) {
      checkAssessment();
    }
  }, [userId]);

  const checkAssessment = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/english-path/${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          setPath(data);
          setAssessed(true);
        } else {
          setAssessed(false);
        }
      } else {
        setAssessed(false);
      }
    } catch {
      setAssessed(false);
    } finally {
      setLoading(false);
    }
  };

  const toggleStage = (stageId: number) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-64" />
          <div className="card"><div className="h-64 bg-gray-100 rounded-xl" /></div>
        </div>
      </div>
    );
  }

  if (assessed === false) {
    return <AssessmentView userId={userId} onComplete={checkAssessment} />;
  }

  if (!path) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">暂无学习路径数据</p>
        <button onClick={checkAssessment} className="btn-primary mt-4">
          <RotateCcw size={16} className="mr-1" />
          重新加载
        </button>
      </div>
    );
  }

  const theme = LEVEL_THEMES[path.level] || LEVEL_THEMES['初级'];
  const masteryRate = path.totalVocab > 0 ? Math.round((path.masteredVocab / path.totalVocab) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="text-primary-600" />
            英语能力评估
          </h1>
          <p className="text-sm text-gray-500 mt-1">个性化学习路径</p>
        </div>
        <button
          onClick={async () => {
            setAssessed(false);
            setPath(null);
          }}
          className="btn-secondary text-sm"
        >
          <RotateCcw size={16} className="mr-1" />
          重新评估
        </button>
      </div>

      <div className={`card ${theme.bg} border-0`}>
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl ${theme.color} flex items-center justify-center text-3xl shadow-lg`}>
            {theme.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${theme.textColor}`}>{theme.label}</span>
              <span className="text-xs bg-white/60 text-gray-600 px-2 py-0.5 rounded-full">
                {path.levelLabel}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-0.5">
              目标考试：<span className="font-medium">{path.targetExam}</span>
            </p>
          </div>
          <div className="ml-auto text-right">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className={theme.textColor} />
              <span className="text-sm text-gray-600">总词汇量</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{path.totalVocab}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center p-4">
          <BookOpen size={20} className="text-primary-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{path.totalVocab}</p>
          <p className="text-xs text-gray-500">总词汇量</p>
        </div>
        <div className="card text-center p-4">
          <CheckCircle size={20} className="text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-green-600">{path.masteredVocab}</p>
          <p className="text-xs text-gray-500">已掌握</p>
        </div>
        <div className="card text-center p-4">
          <Target size={20} className="text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-blue-600">{masteryRate}%</p>
          <p className="text-xs text-gray-500">掌握率</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-primary-600" />
          学习进度概览
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">总体掌握率</span>
              <span className="font-medium text-gray-800">{masteryRate}%</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${theme.color}`}
                style={{ width: `${masteryRate}%` }}
              />
            </div>
          </div>
          <div className="text-center shrink-0">
            <Award className={`w-8 h-8 mx-auto ${masteryRate >= 80 ? 'text-yellow-500' : masteryRate >= 50 ? 'text-blue-400' : 'text-gray-300'}`} />
            <span className="text-xs text-gray-400">
              {masteryRate >= 80 ? '冲刺阶段' : masteryRate >= 50 ? '稳步推进' : '基础阶段'}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-6">
          <Zap size={18} className="text-primary-600" />
          阶段路线图
        </h2>
        <div className="relative">
          <div className="space-y-0">
            {path.stages.map((stage, idx) => {
              const isCurrent = stage.status === 'current';
              const isCompleted = stage.status === 'completed';
              const isExpanded = expandedStages.has(stage.id);
              const completedTasks = stage.tasks.filter(t => t.completed).length;

              return (
                <div key={stage.id} className="relative flex gap-4">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all ${
                      isCompleted ? 'bg-green-500 text-white' :
                      isCurrent ? `${theme.color} text-white animate-pulse shadow-lg shadow-current` :
                      'bg-gray-200 text-gray-400'
                    }`}>
                      {isCompleted ? (
                        <Check size={18} />
                      ) : isCurrent ? (
                        <Play size={16} className="ml-0.5" />
                      ) : (
                        <span className="text-sm font-bold">{idx + 1}</span>
                      )}
                    </div>
                    {idx < path.stages.length - 1 && (
                      <div className={`w-0.5 flex-1 min-h-[40px] ${isCompleted ? 'bg-green-300' : 'bg-gray-200'}`} />
                    )}
                  </div>

                  <div
                    className={`flex-1 pb-6 ${isCurrent ? '' : ''}`}
                  >
                    <button
                      onClick={() => toggleStage(stage.id)}
                      className={`w-full card text-left !p-4 transition-all ${
                        isCurrent ? `ring-2 ${theme.textColor} ring-offset-2 ring-opacity-50` :
                        isCompleted ? 'bg-green-50/50 border-green-200' :
                        'opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <h3 className={`font-semibold ${isCurrent ? theme.textColor : 'text-gray-800'}`}>
                              {stage.name}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">{stage.focus}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              isCompleted ? 'bg-green-100 text-green-700' :
                              isCurrent ? `${theme.bg} ${theme.textColor}` :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {isCompleted ? '已完成' : isCurrent ? '进行中' : '待开始'}
                            </span>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-400">词汇 {stage.targetVocab}</span>
                              <span className="text-xs text-gray-400">{stage.estimatedWeeks}周</span>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronDown size={18} className="text-gray-400 shrink-0" />
                          ) : (
                            <ChevronRight size={18} className="text-gray-400 shrink-0" />
                          )}
                        </div>
                      </div>

                      {stage.tasks.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isCompleted ? 'bg-green-400' : theme.color}`}
                              style={{ width: `${stage.tasks.length > 0 ? Math.round((completedTasks / stage.tasks.length) * 100) : 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400">
                            {completedTasks}/{stage.tasks.length}
                          </span>
                        </div>
                      )}
                    </button>

                    {isExpanded && stage.tasks.length > 0 && (
                      <div className="mt-2 space-y-1.5 animate-fade-in">
                        {stage.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors ml-2"
                          >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${task.completed ? 'bg-green-400' : 'bg-gray-300'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800">{task.name}</p>
                              <p className="text-xs text-gray-400">{task.description}</p>
                            </div>
                            {task.completed ? (
                              <Check size={14} className="text-green-500 shrink-0" />
                            ) : (
                              <Circle size={14} className="text-gray-300 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {path.weeklyGoals && path.weeklyGoals.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-primary-600" />
            每周目标
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {path.weeklyGoals.map((goal) => {
              const progress = goal.target > 0 ? Math.round((goal.learned / goal.target) * 100) : 0;
              const circumference = 2 * Math.PI * 28;
              const offset = circumference - (progress / 100) * circumference;
              return (
                <div key={goal.week} className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-2">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle
                        cx="32" cy="32" r="28"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="6"
                      />
                      <circle
                        cx="32" cy="32" r="28"
                        fill="none"
                        stroke={progress >= 100 ? '#22c55e' : progress >= 50 ? '#3b82f6' : '#f59e0b'}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        className="transition-all duration-700"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-700">{progress}%</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-900">第{goal.week}周</p>
                  <p className="text-xs text-gray-400">{goal.learned}/{goal.target} 词</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AssessmentView({ userId, onComplete }: { userId: number | null; onComplete: () => void }) {
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string } | null>(null);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadQuestions();
    return () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); };
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/english-path/assessment');
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch {
      toast.error('加载评估题目失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (option: string) => {
    if (feedback || !questions[currentIndex]) return;
    setSelectedOption(option);
    const currentQ = questions[currentIndex];
    const correct = option === currentQ.answer;
    setFeedback({ correct, answer: currentQ.answer });
    setAnswers(prev => ({ ...prev, [currentQ.id]: option }));

    autoAdvanceRef.current = setTimeout(() => {
      setFeedback(null);
      setSelectedOption(null);
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setFinished(true);
      }
    }, 1000);
  };

  const handleSubmit = async () => {
    if (!userId) return;
    setSubmitting(true);
    try {
      const answerList = questions.map(q => ({
        questionId: q.id,
        userAnswer: answers[q.id] || '',
      }));
      const res = await fetch('/api/english-path/assessment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, answers: answerList }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      toast.error('提交评估失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-48 mx-auto" />
            <div className="h-4 bg-gray-200 rounded w-64 mx-auto" />
          </div>
        </div>
        <div className="card"><div className="h-64 bg-gray-100 rounded-xl animate-pulse" /></div>
      </div>
    );
  }

  if (finished && result) {
    const theme = LEVEL_THEMES[result.level] || LEVEL_THEMES['初级'];
    const accuracy = Math.round((result.correctCount / result.totalCount) * 100);
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="card text-center py-12 space-y-6">
          <div className={`w-24 h-24 rounded-full ${theme.color} flex items-center justify-center text-5xl mx-auto shadow-lg animate-bounce`}>
            {theme.icon}
          </div>
          <div>
            <div className={`text-4xl font-bold ${theme.textColor} mb-2`}>{result.level}</div>
            <h2 className="text-2xl font-bold text-gray-900">评估完成！</h2>
            <p className="text-gray-500 mt-2">已为你生成个性化学习路径</p>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            <div className="bg-green-50 rounded-xl p-4">
              <Check className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-600">{result.correctCount}</p>
              <p className="text-xs text-gray-500">正确</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <Target className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-600">{accuracy}%</p>
              <p className="text-xs text-gray-500">正确率</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-600">{result.level}</p>
              <p className="text-xs text-gray-500">评级</p>
            </div>
          </div>
          <button onClick={onComplete} className="btn-primary">
            <ArrowRight size={16} className="mr-1" />
            查看学习路径
          </button>
        </div>
      </div>
    );
  }

  if (finished && !result) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="card text-center py-12 space-y-6">
          <div className="text-6xl">🎯</div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">答题完成！</h2>
            <p className="text-gray-500 mt-2">提交答案获取你的个性化学习路径</p>
          </div>
          <div className="text-sm text-gray-400">
            已答 {Object.keys(answers).length}/{questions.length} 题
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                提交中...
              </div>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles size={16} />
                提交评估
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  if (!currentQ) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
          <GraduationCap className="text-primary-600" />
          英语能力评估
        </h1>
        <p className="text-sm text-gray-500 mt-1">完成10道题，获取个性化学习路径</p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500">
            第 {currentIndex + 1} / {questions.length} 题
          </span>
          <span className="text-sm text-gray-400">
            已答 {Object.keys(answers).length} 题
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-6">
          <div
            className="h-full rounded-full bg-primary-500 transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        <div className="space-y-6">
          <p className="text-lg font-medium text-gray-900">{currentQ.question}</p>

          <div className="space-y-3">
            {currentQ.options.map((option, i) => {
              const isSelected = selectedOption === option;
              const isCorrectAnswer = option === currentQ.answer;
              let optionClass = 'border-gray-200 hover:border-gray-300 bg-white';
              if (feedback) {
                if (isCorrectAnswer) {
                  optionClass = 'border-green-400 bg-green-50 text-green-700';
                } else if (isSelected && !feedback.correct) {
                  optionClass = 'border-red-400 bg-red-50 text-red-700';
                } else {
                  optionClass = 'border-gray-200 bg-white opacity-50';
                }
              } else if (isSelected) {
                optionClass = 'border-primary-400 bg-primary-50 text-primary-700';
              }

              return (
                <button
                  key={i}
                  onClick={() => handleSelectOption(option)}
                  disabled={!!feedback}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${optionClass}`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    feedback && isCorrectAnswer ? 'bg-green-500 text-white' :
                    feedback && isSelected && !feedback.correct ? 'bg-red-500 text-white' :
                    isSelected && !feedback ? 'bg-primary-500 text-white' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-sm">{option}</span>
                  {feedback && isCorrectAnswer && (
                    <Check size={18} className="text-green-500 ml-auto shrink-0" />
                  )}
                  {feedback && isSelected && !feedback.correct && (
                    <X size={18} className="text-red-500 ml-auto shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div className={`text-center py-3 rounded-lg font-medium animate-fade-in ${
              feedback.correct ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {feedback.correct ? '✓ 回答正确！' : `✗ 正确答案是：${feedback.answer}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}