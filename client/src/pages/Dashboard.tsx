import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import {
  Calendar, Flame, Target, Zap, AlertTriangle, BookOpen, ChevronRight, Brain, RefreshCw,
  Sparkles, Play, CheckCircle, XCircle, Trophy, Send
} from 'lucide-react';
import { StatsSkeleton } from '../components/Skeleton';
import type { YellowDotStatus, Question } from '../types';
import OnboardingWizard from '../components/OnboardingWizard';
import StudyShare from '../components/StudyShare';
import LearningTimeSettings from '../components/LearningTimeSettings';

interface DashboardStats {
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  totalTimeSpent: number;
  todayCount: number;
  todayCorrect: number;
  streakDays: number;
  masteredPoints: number;
  totalPoints: number;
  weakPoints: number;
}

interface StopPoint {
  id: number;
  name: string;
  category: string;
  chapter: string;
}

interface NextKnowledgePoint {
  id: number;
  name: string;
  category: string;
  chapter: string;
}

interface InterruptionData {
  lastActiveDate: string;
  daysAway: number;
  kpName: string;
  kpId: number | null;
}

interface QuickReviewQuestion {
  question: Question;
  userAnswer: string;
  result: { isCorrect: boolean; correctAnswer: string } | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { userId, user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [yellowDot, setYellowDot] = useState<YellowDotStatus | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [stopPoint, setStopPoint] = useState<StopPoint | null>(null);
  const [nextKp, setNextKp] = useState<NextKnowledgePoint | null>(null);
  const [showStudyShare, setShowStudyShare] = useState(false);
  const [showLearningTime, setShowLearningTime] = useState(false);

  const [interruptionData, setInterruptionData] = useState<InterruptionData | null>(null);
  const [isSprintMode, setIsSprintMode] = useState(false);
  const [sprintDays, setSprintDays] = useState(0);
  const [sprintExamLabel, setSprintExamLabel] = useState('');

  const [quickReviewActive, setQuickReviewActive] = useState(false);
  const [quickReviewQuestions, setQuickReviewQuestions] = useState<QuickReviewQuestion[]>([]);
  const [quickReviewIndex, setQuickReviewIndex] = useState(0);
  const [quickReviewLoading, setQuickReviewLoading] = useState(false);
  const [quickReviewCompleted, setQuickReviewCompleted] = useState(false);

  const targetExam = user?.targetExam || '考研';

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/user/${userId}/dashboard`).then(r => r.json()),
      fetch(`/api/review/yellow-dot/${userId}`).then(r => r.json()),
      fetch('/api/knowledge/stop-point').then(r => r.json()).catch(() => null),
      fetch('/api/knowledge/from-scratch').then(r => r.json()).catch(() => null),
    ])
      .then(([dashboardData, yellowDotData, stopPointData, fromScratchData]) => {
        setStats(dashboardData);
        if (yellowDotData.yellowDotCount !== undefined) {
          setYellowDot(yellowDotData);
        }
        if (stopPointData?.stopPoint) {
          setStopPoint(stopPointData.stopPoint);
        } else if (stopPointData?.id) {
          setStopPoint(stopPointData as StopPoint);
        }
        if (fromScratchData?.nextKp) {
          setNextKp(fromScratchData.nextKp);
        } else if (fromScratchData?.id) {
          setNextKp(fromScratchData as NextKnowledgePoint);
        }
        if (dashboardData.totalQuestions < 10 && !localStorage.getItem('onboarding_done')) {
          setShowOnboarding(true);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const lastActiveDate = localStorage.getItem('lastActiveDate');
    localStorage.setItem('lastActiveDate', todayStr);

    if (lastActiveDate && lastActiveDate !== todayStr) {
      const lastDate = new Date(lastActiveDate);
      const today = new Date(todayStr);
      const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 3) {
        const kpName = localStorage.getItem('last_study_kp') || '';
        const kpId = localStorage.getItem('last_study_kp_id');
        setInterruptionData({
          lastActiveDate,
          daysAway: diffDays,
          kpName,
          kpId: kpId ? Number(kpId) : null,
        });
      }
    }
  }, []);

  useEffect(() => {
    const ddayStr = localStorage.getItem('dday');
    const dday = ddayStr ? new Date(ddayStr) : getDdayDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dday.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 30 && diffDays > 0) {
      setIsSprintMode(true);
      setSprintDays(diffDays);
      setSprintExamLabel(targetExam);
    }
  }, [targetExam]);

  const getDdayDate = () => {
    if (targetExam === '考研') {
      const examDate = new Date(new Date().getFullYear(), 11, 21);
      if (examDate < new Date()) {
        examDate.setFullYear(examDate.getFullYear() + 1);
      }
      return examDate;
    }
    if (targetExam === '四六级') {
      const examDate = new Date(new Date().getFullYear(), 5, 15);
      if (examDate < new Date()) {
        examDate.setFullYear(examDate.getFullYear() + 1);
      }
      return examDate;
    }
    const today = new Date();
    const d = new Date(today.getFullYear(), 11, 21);
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return d;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-gray-900">今日指挥官</h1>
        <StatsSkeleton />
      </div>
    );
  }

  const handleOnboardingDismiss = () => {
    localStorage.setItem('onboarding_done', 'true');
    setShowOnboarding(false);
  };

  const handleOnboardingMode = (mode: string) => {
    localStorage.setItem('onboarding_done', 'true');
    setShowOnboarding(false);
    switch (mode) {
      case 'from-scratch': navigate('/math?mode=from-scratch'); break;
      case 'targeted': navigate('/diagnostic'); break;
      case 'review': navigate('/review'); break;
      case 'freshman': navigate('/chapters'); break;
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 12) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  const getDday = () => {
    if (targetExam === '考研') {
      const examDate = new Date(new Date().getFullYear(), 11, 21);
      if (examDate < new Date()) {
        examDate.setFullYear(examDate.getFullYear() + 1);
      }
      const diff = Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return { label: '考研', days: diff };
    }
    if (targetExam === '四六级') {
      const examDate = new Date(new Date().getFullYear(), 5, 15);
      if (examDate < new Date()) {
        examDate.setFullYear(examDate.getFullYear() + 1);
      }
      const diff = Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return { label: '四六级', days: diff };
    }
    const today = new Date();
    const d = new Date(today.getFullYear(), 11, 21);
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { label: targetExam, days: diff };
  };

  const handleContinueLearning = () => {
    if (interruptionData?.kpId) {
      navigate(`/math?knowledgePointId=${interruptionData.kpId}`);
    } else {
      navigate('/study-plan');
    }
  };

  const handleQuickWarmup = () => {
    const kpId = localStorage.getItem('last_study_kp_id');
    const params = new URLSearchParams();
    if (kpId) params.set('knowledgePointId', kpId);
    params.set('limit', '10');
    params.set('difficulty', '1,2');
    setQuickReviewLoading(true);
    fetch(`/api/questions?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        const questions = (data.questions || []) as Question[];
        const selected = questions.sort(() => Math.random() - 0.5).slice(0, 3);
        const qrq: QuickReviewQuestion[] = selected.map(q => ({
          question: q,
          userAnswer: '',
          result: null,
        }));
        setQuickReviewQuestions(qrq);
        setQuickReviewIndex(0);
        setQuickReviewActive(true);
        setQuickReviewCompleted(false);
      })
      .catch(() => {})
      .finally(() => setQuickReviewLoading(false));
  };

  const handleQuickReviewSelect = (option: string) => {
    setQuickReviewQuestions(prev => {
      const next = [...prev];
      next[quickReviewIndex] = { ...next[quickReviewIndex], userAnswer: option };
      return next;
    });
  };

  const handleQuickReviewSubmit = async () => {
    const current = quickReviewQuestions[quickReviewIndex];
    if (!current.userAnswer) return;
    const res = await fetch('/api/questions/solution/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: current.question.id, answer: current.userAnswer }),
    });
    const data = await res.json();
    setQuickReviewQuestions(prev => {
      const next = [...prev];
      next[quickReviewIndex] = {
        ...next[quickReviewIndex],
        result: { isCorrect: data.isCorrect, correctAnswer: data.correctAnswer },
      };
      return next;
    });
  };

  const handleQuickReviewNext = () => {
    if (quickReviewIndex < quickReviewQuestions.length - 1) {
      setQuickReviewIndex(prev => prev + 1);
    } else {
      setQuickReviewCompleted(true);
    }
  };

  const handleResetQuickReview = () => {
    setQuickReviewActive(false);
    setQuickReviewQuestions([]);
    setQuickReviewIndex(0);
    setQuickReviewCompleted(false);
  };

  const correctCount = quickReviewQuestions.filter(q => q.result?.isCorrect).length;

  const dday = getDday();
  const overallMastery = stats?.totalPoints ? Math.round((stats.masteredPoints / stats.totalPoints) * 100) : 0;
  const hasReviewTasks = yellowDot && yellowDot.yellowDotCount > 0;
  const tasksCompleted = [hasReviewTasks, !!stopPoint, !!nextKp].filter(Boolean).length;

  const today = new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6 animate-fade-in">
      {interruptionData && (
        <div className="card border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-200 rounded-2xl flex items-center justify-center shrink-0 text-2xl">
              👋
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-amber-800">欢迎回来！</h3>
              <p className="text-sm text-amber-700 mt-1">
                你上次学到这里：
                <span className="font-semibold">
                  {interruptionData.kpName || '学习计划'}
                </span>
              </p>
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={handleContinueLearning}
                  className="btn-primary bg-amber-600 hover:bg-amber-700 text-xs px-4 py-2"
                >
                  继续学习 <ChevronRight size={14} />
                </button>
                <button
                  onClick={handleQuickWarmup}
                  disabled={quickReviewLoading}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  <Play size={14} /> 用5分钟找回节奏
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSprintMode && (
        <div className="card bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 border-orange-400 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Trophy size={24} />
                冲刺模式
              </h2>
              <p className="text-orange-100 mt-1">
                距离{sprintExamLabel}还有 <span className="font-bold text-white text-lg">{sprintDays}</span> 天
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">{sprintDays}</div>
              <div className="text-orange-200 text-sm">天</div>
            </div>
          </div>
          <div className="mt-4 p-4 bg-white/10 rounded-xl border border-white/20">
            <div className="flex items-center gap-2 mb-2">
              <Target size={16} />
              <span className="font-semibold">今天必须完成</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-orange-100">
              <span className="flex items-center gap-1">
                <RefreshCw size={14} /> 优先复习
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle size={14} /> 错题纠正
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="text-primary-600" size={24} />
            {isSprintMode ? '冲刺阶段！加油 💪' : '今日指挥官'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLearningTime(!showLearningTime)}
            className="btn-ghost p-2"
            title="学习时间设置"
          >
            <Calendar size={18} className="text-gray-500" />
          </button>
          <button
            onClick={() => setShowStudyShare(true)}
            className="btn-ghost p-2"
            title="分享学习卡"
          >
            <Send size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      {showLearningTime && (
        <LearningTimeSettings onClose={() => setShowLearningTime(false)} />
      )}

      <div className={`card bg-gradient-to-r ${isSprintMode ? 'from-orange-50 via-red-50 to-pink-50 border-orange-200' : 'from-primary-50 via-blue-50 to-purple-50 border-primary-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {getGreeting()}，{user?.username || '同学'}
            </h2>
            <p className="text-gray-600 mt-1">今日是为你规划的最佳学习窗口</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 text-primary-600">
              <Calendar size={16} />
              <span className="text-sm font-medium">距离{dday.label}</span>
            </div>
            <div className="text-3xl font-bold text-primary-600">{dday.days}</div>
            <div className="text-xs text-gray-400">天</div>
          </div>
        </div>
      </div>

      {quickReviewActive && !quickReviewCompleted && quickReviewQuestions.length > 0 && (
        <div className="card border-blue-200 bg-blue-50/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Play size={18} className="text-blue-600" />
              快速热身 ({quickReviewIndex + 1}/{quickReviewQuestions.length})
            </h3>
            <button onClick={handleResetQuickReview} className="text-gray-400 hover:text-gray-600">
              <XCircle size={18} />
            </button>
          </div>
          <div className="mb-4">
            <p className="text-gray-800 font-medium mb-3">
              {quickReviewQuestions[quickReviewIndex].question.content}
            </p>
            {quickReviewQuestions[quickReviewIndex].question.options && (
              <div className="space-y-2">
                {quickReviewQuestions[quickReviewIndex].question.options!.map((opt, i) => {
                  const current = quickReviewQuestions[quickReviewIndex];
                  const isSelected = current.userAnswer === opt;
                  const isCorrectAnswer = current.result?.correctAnswer === opt;
                  let btnClass = 'border-gray-200 bg-white hover:border-gray-300';
                  if (current.result) {
                    if (isCorrectAnswer) btnClass = 'border-green-400 bg-green-50';
                    else if (isSelected && !current.result.isCorrect) btnClass = 'border-red-400 bg-red-50';
                  } else if (isSelected) {
                    btnClass = 'border-blue-400 bg-blue-50';
                  }
                  return (
                    <button
                      key={i}
                      disabled={!!current.result}
                      onClick={() => handleQuickReviewSelect(opt)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${btnClass}`}
                    >
                      <span className="text-sm">{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {!quickReviewQuestions[quickReviewIndex].question.options && (
              <div>
                <input
                  type="text"
                  value={quickReviewQuestions[quickReviewIndex].userAnswer}
                  onChange={(e) => {
                    setQuickReviewQuestions(prev => {
                      const next = [...prev];
                      next[quickReviewIndex] = { ...next[quickReviewIndex], userAnswer: e.target.value };
                      return next;
                    });
                  }}
                  disabled={!!quickReviewQuestions[quickReviewIndex].result}
                  className="input-field"
                  placeholder="输入答案..."
                />
              </div>
            )}
            {quickReviewQuestions[quickReviewIndex].result && (
              <div className={`mt-3 p-3 rounded-xl ${quickReviewQuestions[quickReviewIndex].result!.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2">
                  {quickReviewQuestions[quickReviewIndex].result!.isCorrect ? (
                    <CheckCircle size={16} className="text-green-600" />
                  ) : (
                    <XCircle size={16} className="text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${quickReviewQuestions[quickReviewIndex].result!.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                    {quickReviewQuestions[quickReviewIndex].result!.isCorrect ? '正确！' : `正确答案：${quickReviewQuestions[quickReviewIndex].result!.correctAnswer}`}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            {!quickReviewQuestions[quickReviewIndex].result ? (
              <button
                onClick={handleQuickReviewSubmit}
                disabled={!quickReviewQuestions[quickReviewIndex].userAnswer}
                className="btn-primary text-sm"
              >
                确认
              </button>
            ) : (
              <button onClick={handleQuickReviewNext} className="btn-primary text-sm flex items-center gap-1">
                {quickReviewIndex < quickReviewQuestions.length - 1 ? '下一题' : '查看结果'} <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {quickReviewCompleted && (
        <div className="card border-green-200 bg-green-50/50 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Sparkles className="text-green-600" size={28} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">热身完成！准备好正式学习 🎯</h3>
          <p className="text-sm text-gray-600 mt-1">
            答对 {correctCount}/{quickReviewQuestions.length} 题
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button onClick={handleResetQuickReview} className="btn-secondary text-sm">
              关闭
            </button>
            <button onClick={() => navigate('/review')} className="btn-primary text-sm flex items-center gap-1">
              <Zap size={16} /> 开始正式学习
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-amber-500" />
          <h2 className="text-lg font-bold text-gray-900">今日必做 {tasksCompleted} 项</h2>
        </div>

        <div className="space-y-3">
          <div className={`flex items-center gap-4 p-4 rounded-xl border ${hasReviewTasks ? 'border-yellow-300 bg-yellow-50/60' : 'border-gray-100 bg-gray-50/60'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hasReviewTasks ? 'bg-yellow-200 text-yellow-700' : 'bg-gray-200 text-gray-400'}`}>
              <RefreshCw size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${hasReviewTasks ? 'text-gray-900' : 'text-gray-400'}`}>到期复习</p>
              <p className={`text-sm ${hasReviewTasks ? 'text-yellow-700' : 'text-gray-400'}`}>
                {hasReviewTasks
                  ? `${yellowDot!.yellowDotCount} 个知识点待复习，${yellowDot!.dueTodayCount} 个今日到期`
                  : '暂无到期复习任务'}
              </p>
            </div>
            {hasReviewTasks && (
              <Link to="/review" className="btn-primary text-xs px-3 py-1.5 shrink-0">
                去复习 <ChevronRight size={14} />
              </Link>
            )}
          </div>

          <div className={`flex items-center gap-4 p-4 rounded-xl border ${stopPoint ? 'border-red-200 bg-red-50/60' : 'border-gray-100 bg-gray-50/60'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stopPoint ? 'bg-red-200 text-red-700' : 'bg-gray-200 text-gray-400'}`}>
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${stopPoint ? 'text-gray-900' : 'text-gray-400'}`}>最高优先级断点</p>
              <p className={`text-sm ${stopPoint ? 'text-red-700' : 'text-gray-400'}`}>
                {stopPoint
                  ? `${stopPoint.name}（${stopPoint.category}${stopPoint.chapter ? ' · ' + stopPoint.chapter : ''}）`
                  : '暂无学习断点'}
              </p>
            </div>
            {stopPoint && (
              <button onClick={() => navigate(`/knowledge?id=${stopPoint.id}`)} className="btn-secondary text-xs px-3 py-1.5 shrink-0">
                攻克 <ChevronRight size={14} />
              </button>
            )}
          </div>

          <div className={`flex items-center gap-4 p-4 rounded-xl border ${nextKp ? 'border-blue-200 bg-blue-50/60' : 'border-gray-100 bg-gray-50/60'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${nextKp ? 'bg-blue-200 text-blue-700' : 'bg-gray-200 text-gray-400'}`}>
              <BookOpen size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${nextKp ? 'text-gray-900' : 'text-gray-400'}`}>当前章节下一未学知识点</p>
              <p className={`text-sm ${nextKp ? 'text-blue-700' : 'text-gray-400'}`}>
                {nextKp
                  ? `${nextKp.name}（${nextKp.category}${nextKp.chapter ? ' · ' + nextKp.chapter : ''}）`
                  : '暂无待学知识点'}
              </p>
            </div>
            {nextKp && (
              <button onClick={() => navigate(`/math?mode=from-scratch&kp=${nextKp.id}`)} className="btn-secondary text-xs px-3 py-1.5 shrink-0">
                学习 <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 flex-wrap">
        <button
          onClick={() => navigate('/review')}
          className="btn-primary text-lg px-10 py-4 flex items-center gap-2 shadow-lg shadow-primary-200"
        >
          <Zap size={22} />
          开始今日任务
        </button>
        {!quickReviewActive && !quickReviewCompleted && (
          <button
            onClick={handleQuickWarmup}
            disabled={quickReviewLoading}
            className="btn-secondary text-lg px-8 py-4 flex items-center gap-2"
          >
            <Play size={22} />
            快速热身
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Brain className="text-green-600" size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {overallMastery}%
          </p>
          <p className="text-xs text-gray-500 mt-1">总掌握度</p>
        </div>
        <div className="card text-center">
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Flame className="text-orange-500" size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats?.streakDays || 0}
            <span className="text-sm font-normal text-gray-400 ml-1">天</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">连续学习天数</p>
        </div>
      </div>

      {stats && stats.weakPoints > 0 && (
        <div className="card border-yellow-200 bg-yellow-50/50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="text-yellow-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">需要巩固的知识点</h3>
              <p className="text-sm text-gray-600 mt-1">
                你有 <span className="font-medium text-yellow-700">{stats.weakPoints}</span> 个知识点掌握程度较低
              </p>
              <Link to="/errors" className="inline-flex items-center gap-1 text-sm text-primary-600 font-medium mt-2 hover:underline">
                查看详情 <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {showStudyShare && (
        <StudyShare onClose={() => setShowStudyShare(false)} />
      )}

      {showOnboarding && (
        <OnboardingWizard
          onDismiss={handleOnboardingDismiss}
          onSelectMode={handleOnboardingMode}
        />
      )}
    </div>
  );
}