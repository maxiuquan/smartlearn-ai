import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import {
  TrendingUp, Target, Clock, Award, BookOpen, Brain, ChevronRight,
  Zap, Calendar, BarChart3, PieChart, ArrowUp, ArrowRight, Flame, Star,
  Sparkles, Activity, Shield, Swords, GraduationCap, Radar,
  Lightbulb, CheckCircle, Bookmark, Circle, RefreshCw
} from 'lucide-react';
import { StatsSkeleton } from '../components/Skeleton';
import MathRenderer from '../components/MathRenderer';
import { LEVEL_CONFIG, getLevelConfig } from '../types';
import type { YellowDotStatus, LevelDistribution, ExamReadiness } from '../types';

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
  weeklyActivity: { date: string; count: number }[];
  categoryProgress: { category: string; mastery: number; total: number; averageLevel: number }[];
  levelDistribution?: LevelDistribution[];
  examReadiness?: ExamReadiness;
}

interface DailyQuestion {
  id: number;
  content: string;
  questionType: string;
  options: string[] | null;
  difficulty: number;
  answer: string;
  date: string;
  knowledgePoints: { id: number; name: string; category: string }[];
  solution?: string;
}

const EXTERNAL_BOOKS_QUICK = [
  { name: '李永乐·660题', icon: '📖', desc: '基础题型强化训练' },
  { name: '张宇·1000题', icon: '📘', desc: '难度递进全覆盖' },
  { name: '汤家凤·1800题', icon: '📙', desc: '基础+提高渐进式' },
  { name: '历年真题', icon: '📝', desc: '1987-2024全收录' },
];

export default function MathHome() {
  const navigate = useNavigate();
  const { userId } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyQuestion, setDailyQuestion] = useState<DailyQuestion | null>(null);
  const [dailyAnswer, setDailyAnswer] = useState('');
  const [dailySubmitted, setDailySubmitted] = useState(false);
  const [dailyResult, setDailyResult] = useState<{ correct: boolean; answer: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [yellowDot, setYellowDot] = useState<YellowDotStatus | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/user/${userId}/dashboard`).then(r => r.json()),
      fetch('/api/questions/daily').then(r => r.json()),
      fetch(`/api/review/yellow-dot/${userId}`).then(r => r.json()),
    ])
      .then(([dashboardData, dailyData, yellowDotData]) => {
        setStats(dashboardData);
        setDailyQuestion(dailyData.question || null);
        if (yellowDotData.yellowDotCount !== undefined) {
          setYellowDot(yellowDotData);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-gray-900">数学学习中心 · 考研数学</h1>
        <StatsSkeleton />
      </div>
    );
  }

  const handleDailySubmit = () => {
    if (!dailyQuestion || !dailyAnswer.trim()) return;
    const isCorrect = dailyAnswer.trim().toLowerCase() === dailyQuestion.answer.trim().toLowerCase();
    setDailyResult({ correct: isCorrect, answer: dailyQuestion.answer });
    setDailySubmitted(true);
  };

  const accuracy = stats?.totalQuestions ? Math.round((stats.correctCount / stats.totalQuestions) * 100) : 0;
  const todayAccuracy = stats?.todayCount ? Math.round(((stats?.todayCorrect || 0) / stats.todayCount) * 100) : 0;
  const overallProgress = stats?.totalPoints ? Math.round((stats.masteredPoints / stats.totalPoints) * 100) : 0;

  const overallLevel = stats?.categoryProgress
    ? Math.round(stats.categoryProgress.reduce((sum, c) => sum + (c.averageLevel || 0), 0) / Math.max(stats.categoryProgress.length, 1))
    : 0;
  const lvConfig = getLevelConfig(overallLevel);

  const statCards = [
    { icon: Target, label: '总答题', value: stats?.totalQuestions || 0, suffix: '题', color: 'bg-blue-50 text-blue-600' },
    { icon: Award, label: '正确率', value: accuracy, suffix: '%', color: 'bg-green-50 text-green-600' },
    { icon: Clock, label: '今日答题', value: stats?.todayCount || 0, suffix: '题', color: 'bg-orange-50 text-orange-600' },
    { icon: Flame, label: '连续天数', value: stats?.streakDays || 0, suffix: '天', color: 'bg-red-50 text-red-600' },
  ];

  const today = new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">数学学习中心</h1>
          <p className="text-gray-500 text-sm mt-1">数学学习中心 · 考研数学 · {today}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/review')} className="btn-secondary text-sm relative">
            <RefreshCw size={16} className="mr-1" />
            综测
            {yellowDot && yellowDot.yellowDotCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full text-xs text-white flex items-center justify-center font-bold animate-pulse">
                {yellowDot.yellowDotCount > 99 ? '99+' : yellowDot.yellowDotCount}
              </span>
            )}
          </button>
          <button onClick={() => navigate('/chapters')} className="btn-primary text-sm">
            <Brain size={16} className="mr-1" />
            开始学习
          </button>
        </div>
      </div>

      {yellowDot && yellowDot.yellowDotCount > 0 && (
        <div className="card border-yellow-300 bg-yellow-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-200 rounded-full flex items-center justify-center">
                <Circle size={20} className="fill-yellow-400 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  小黄点提醒
                  <span className="bg-yellow-400 text-white text-xs px-2 py-0.5 rounded-full">
                    {yellowDot.yellowDotCount} 个知识点待复习
                  </span>
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {yellowDot.dueTodayCount > 0
                    ? `其中有 ${yellowDot.dueTodayCount} 个已到期，建议尽快复习`
                    : '根据遗忘曲线，系统已为你安排了最佳复习时间'}
                </p>
              </div>
            </div>
            <Link
              to="/review"
              className="btn-primary text-sm flex items-center gap-1 shrink-0"
            >
              去复习 <ChevronRight size={14} />
            </Link>
          </div>
          {yellowDot.categories.length > 0 && (
            <div className="flex gap-2 mt-3">
              {yellowDot.categories.map(cat => (
                <span key={cat.category} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                  {cat.category} ×{cat.count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="card animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color} mb-3`}>
              <card.icon size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {card.value}
              <span className="text-sm font-normal text-gray-400 ml-1">{card.suffix}</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {stats?.levelDistribution && stats.levelDistribution.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-primary-600" />
            知识点等级分布
          </h2>
          <div className="space-y-2">
            {stats.levelDistribution.map((item) => (
              <div key={item.level} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-12 shrink-0">{item.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-4 rounded-full transition-all duration-700`}
                    style={{
                      width: `${stats.totalPoints > 0 ? Math.round((item.count / stats.totalPoints) * 100) : 0}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-8 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <GraduationCap size={18} className="text-primary-600" />
            能力等级
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white ${lvConfig.color}`}>
              {overallLevel === 0 ? '—' : `L${overallLevel}`}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${lvConfig.textColor}`}>
                  {lvConfig.label}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
                <div
                  className={`h-3 rounded-full ${lvConfig.color} transition-all duration-700`}
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                {LEVEL_CONFIG.slice(1).map((lv) => (
                  <span key={lv.level} className="text-xs text-gray-400">{lv.range}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {LEVEL_CONFIG.map((lv) => (
              <div key={lv.level} className="text-center">
                <div className={`h-1.5 rounded-full mb-1 ${lv.color} ${overallLevel >= lv.level ? '' : 'opacity-20'}`} />
                <span className={`text-xs ${overallLevel >= lv.level ? lv.textColor + ' font-medium' : 'text-gray-300'}`}>
                  {lv.level === 0 ? '—' : `L${lv.level}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Activity size={18} className="text-primary-600" />
            本周学习活动
          </h2>
          {stats?.weeklyActivity && stats.weeklyActivity.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-end gap-2 h-32">
                {stats.weeklyActivity.map((day, i) => {
                  const maxCount = Math.max(...stats.weeklyActivity.map(d => d.count), 1);
                  const height = (day.count / maxCount) * 100;
                  const todayDow = new Date().getDay();
                  const dayNum = new Date(day.date).getDay();
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500">{day.count}</span>
                      <div className="w-full flex justify-center">
                        <div
                          className={`w-8 rounded-t-lg transition-all duration-500 ${dayNum === todayDow ? 'bg-primary-500' : 'bg-primary-200'}`}
                          style={{ height: `${Math.max(height, 4)}%` }}
                        />
                      </div>
                      <span className={`text-xs ${dayNum === todayDow ? 'text-primary-600 font-medium' : 'text-gray-400'}`}>
                        {['日', '一', '二', '三', '四', '五', '六'][dayNum]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Activity size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">本周暂无学习记录</p>
              <p className="text-xs mt-1">开始学习后这里会显示你的学习活动</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-primary-600" />
          数学各模块掌握进度
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {(stats?.categoryProgress || []).map((cat) => {
            const catProgress = cat.total > 0 ? Math.round((cat.mastery / cat.total) * 100) : 0;
            const catLevel = cat.averageLevel || 0;
            const catLvConfig = getLevelConfig(catLevel);
            return (
              <div key={cat.category} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${catLvConfig.color}`} />
                    <span className="font-medium text-gray-900">{cat.category}</span>
                  </div>
                  <span className={`text-sm font-bold ${catLvConfig.textColor}`}>
                    {catLvConfig.label}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${catLvConfig.color} transition-all duration-700`}
                    style={{ width: `${catProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>已掌握 {cat.mastery}/{cat.total} 个知识点</span>
                  <span>{catProgress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="card md:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Lightbulb size={18} className="text-primary-600" />
            每日一题
            {dailyQuestion && (
              <span className="text-xs text-gray-400 font-normal ml-2">
                {dailyQuestion.date}
              </span>
            )}
          </h2>
          {dailyQuestion ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  dailyQuestion.questionType === 'choice' ? 'bg-blue-100 text-blue-700' :
                  dailyQuestion.questionType === 'fill_in' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {dailyQuestion.questionType === 'choice' ? '选择题' : dailyQuestion.questionType === 'fill_in' ? '填空题' : '解答题'}
                </span>
                <span className="text-xs text-gray-400">
                  {'★'.repeat(dailyQuestion.difficulty)}{'☆'.repeat(3 - dailyQuestion.difficulty)}
                </span>
              </div>
              <p className="text-gray-800"><MathRenderer content={dailyQuestion.content} /></p>

              {dailyQuestion.questionType === 'choice' && dailyQuestion.options && (
                <div className="space-y-2">
                  {dailyQuestion.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => !dailySubmitted && setDailyAnswer(opt)}
                      disabled={dailySubmitted}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        dailyAnswer === opt
                          ? dailySubmitted
                            ? dailyResult?.correct ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'
                            : 'border-primary-400 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-sm">{String.fromCharCode(65 + i)}. {opt}</span>
                    </button>
                  ))}
                </div>
              )}

              {(dailyQuestion.questionType === 'fill_in' || dailyQuestion.questionType === 'essay') && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dailyAnswer}
                    onChange={(e) => setDailyAnswer(e.target.value)}
                    disabled={dailySubmitted}
                    placeholder="请输入答案..."
                    className={`flex-1 p-3 border rounded-lg text-sm ${dailySubmitted ? (dailyResult?.correct ? 'border-green-400' : 'border-red-400') : 'border-gray-200'}`}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDailySubmit(); }}
                  />
                  {!dailySubmitted && (
                    <button onClick={handleDailySubmit} disabled={!dailyAnswer.trim()} className="btn-primary text-sm px-4">
                      提交
                    </button>
                  )}
                </div>
              )}

              {dailyQuestion.questionType === 'choice' && !dailySubmitted && (
                <button onClick={handleDailySubmit} disabled={!dailyAnswer} className="btn-primary text-sm">
                  提交答案
                </button>
              )}

              {dailySubmitted && dailyResult && (
                <div className={`p-3 rounded-lg ${dailyResult.correct ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {dailyResult.correct ? <CheckCircle size={16} /> : '✗'}
                    {dailyResult.correct ? '回答正确！' : `回答错误，正确答案是：${dailyResult.answer}`}
                  </div>
                  <button onClick={() => { setDailySubmitted(false); setDailyAnswer(''); setDailyResult(null); }} className="text-xs mt-1 underline opacity-70 hover:opacity-100">
                    再试一次
                  </button>
                </div>
              )}

              {dailyQuestion.knowledgePoints.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {dailyQuestion.knowledgePoints.map(kp => (
                    <span key={kp.id} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                      {kp.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Lightbulb size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">暂无每日一题</p>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Bookmark size={18} className="text-primary-600" />
            外部题库
          </h2>
          <div className="space-y-3">
            {EXTERNAL_BOOKS_QUICK.map((book) => (
              <button
                key={book.name}
                onClick={() => navigate(`/mock-exam?tab=external&book=${encodeURIComponent(book.name)}`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <span className="text-2xl">{book.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{book.name}</p>
                  <p className="text-xs text-gray-400">{book.desc}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('/mock-exam?tab=external')}
            className="w-full text-center text-sm text-primary-600 font-medium pt-3 border-t border-gray-100 mt-3 hover:text-primary-700"
          >
            查看全部题库 →
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Link to="/math?mode=from-scratch" className="card group hover:border-primary-200 hover:shadow-lg transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center">
              <Zap className="text-primary-600" size={20} />
            </div>
            <h3 className="font-semibold text-gray-900">从零开始</h3>
          </div>
          <p className="text-sm text-gray-500 mb-3">按知识点依赖关系，系统规划最优学习路径</p>
          <span className="text-xs text-primary-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            开始学习 <ArrowRight size={14} />
          </span>
        </Link>

        <Link to="/chapters" className="card group hover:border-primary-200 hover:shadow-lg transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
              <BookOpen className="text-blue-600" size={20} />
            </div>
            <h3 className="font-semibold text-gray-900">按章学习</h3>
          </div>
          <p className="text-sm text-gray-500 mb-3">选择具体章节，针对性练习薄弱知识点</p>
          <span className="text-xs text-blue-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            选择章节 <ArrowRight size={14} />
          </span>
        </Link>

        <Link to="/review" className="card group hover:border-yellow-200 hover:shadow-lg transition-all relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-xl flex items-center justify-center">
              <RefreshCw className="text-yellow-600" size={20} />
            </div>
            <h3 className="font-semibold text-gray-900">综合测试</h3>
          </div>
          <p className="text-sm text-gray-500 mb-3">智能复习系统，基于遗忘曲线安排最佳复习时间</p>
          {yellowDot && yellowDot.yellowDotCount > 0 && (
            <span className="absolute top-3 right-3 w-6 h-6 bg-yellow-400 rounded-full text-xs text-white flex items-center justify-center font-bold animate-pulse">
              {yellowDot.yellowDotCount > 9 ? '9+' : yellowDot.yellowDotCount}
            </span>
          )}
          <span className="text-xs text-yellow-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            去复习 <ArrowRight size={14} />
          </span>
        </Link>
      </div>

      {stats?.examReadiness && (
        <div className="card bg-gradient-to-r from-purple-50 to-blue-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Target size={18} className="text-purple-600" />
            考场能力预测
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-purple-100">
              <span className="text-2xl font-bold text-purple-600">{stats.examReadiness.overall}%</span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-1">预计正确率</p>
              <span className="inline-block text-xs font-medium text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
                {stats.examReadiness.overallLabel}
              </span>
            </div>
          </div>
          {stats.examReadiness.categories.length > 0 && (
            <div className="space-y-3">
              {stats.examReadiness.categories.map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">{cat.category}</span>
                    <span className="text-sm font-medium text-gray-900">{cat.readiness}%</span>
                  </div>
                  <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-purple-400 to-blue-400 transition-all duration-700"
                      style={{ width: `${cat.readiness}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{cat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {stats && stats.totalQuestions === 0 && (
        <div className="card text-center py-12 bg-gradient-to-br from-primary-50 to-blue-50">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">准备好开始你的考研之旅了吗？</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            系统会根据你的学习情况智能推荐题目，帮你高效掌握每一个知识点
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={() => navigate('/math?mode=from-scratch')} className="btn-primary">
              <Zap size={16} className="mr-1" />从零开始
            </button>
            <button onClick={() => navigate('/chapters')} className="btn-secondary">
              <BookOpen size={16} className="mr-1" />按章学习
            </button>
          </div>
        </div>
      )}

      {stats && stats.weakPoints > 0 && (
        <div className="card border-yellow-200 bg-yellow-50/50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center shrink-0">
              <Sparkles className="text-yellow-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">需要巩固的知识点</h3>
              <p className="text-sm text-gray-600 mt-1">
                你有 <span className="font-medium text-yellow-700">{stats.weakPoints}</span> 个知识点掌握程度较低，
                建议进行针对性练习
              </p>
              <Link to="/errors" className="inline-flex items-center gap-1 text-sm text-primary-600 font-medium mt-2 hover:underline">
                查看详情 <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}