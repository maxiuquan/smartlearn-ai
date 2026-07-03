import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';
import { AlertTriangle, Zap, Clock, BookOpen, CheckCircle, ChevronRight, Target, Circle, RefreshCw, Play, TrendingUp, Sparkles } from 'lucide-react';
import type { ReviewStatus, ReviewTask } from '../types';
import { LEVEL_CONFIG, getLevelConfig } from '../types';

export default function ComprehensiveReview() {
  const navigate = useNavigate();
  const { userId } = useAuthStore();
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'overdue'>('all');
  const [completedToday, setCompletedToday] = useState<number[]>([]);
  const [celebration, setCelebration] = useState(false);

  useEffect(() => {
    if (!userId) return;
    loadReviewData();
  }, [userId]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('review_completed_today') || '[]');
      const today = new Date().toDateString();
      if (saved._date === today) {
        setCompletedToday(saved.ids || []);
      } else {
        setCompletedToday([]);
        localStorage.setItem('review_completed_today', JSON.stringify({ _date: today, ids: [] }));
      }
    } catch {
      // silent
    }
  }, []);

  const loadReviewData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/review/queue/${userId}`);
      const data = await res.json();
      setReviewStatus(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (knowledgePointId: number) => {
    try {
      await fetch('/api/review/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgePointId, userId }),
      });
      const updated = [...completedToday, knowledgePointId];
      setCompletedToday(updated);
      const today = new Date().toDateString();
      localStorage.setItem('review_completed_today', JSON.stringify({ _date: today, ids: updated }));
      toast.success('复习完成！');
      loadReviewData();

      const allTasks = reviewStatus?.tasks ?? [];
      const remaining = allTasks.filter(t => !updated.includes(t.knowledgePointId));
      if (remaining.length === 0) {
        setCelebration(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickReview = (knowledgePointId: number) => {
    navigate(`/math?knowledgePointId=${knowledgePointId}&quick=3`);
    toast.info('快速复习：3道题');
  };

  const handleFullReview = (knowledgePointId: number) => {
    navigate(`/math?knowledgePointId=${knowledgePointId}`);
  };

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">综合测试</h1>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-12" />
            </div>
          ))}
        </div>
        <div className="card animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const allTasks = reviewStatus?.tasks ?? [];
  const overdueTasks = reviewStatus?.tasks.filter(t => t.isOverdue) ?? [];
  const filteredTasks = activeTab === 'overdue' ? overdueTasks : allTasks;
  const todayCompleted = completedToday.length;
  const todayTotal = allTasks.length;
  const todayProgress = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;
  const allDone = todayTotal > 0 && todayCompleted >= todayTotal;

  return (
    <div className="space-y-6 animate-fade-in">
      {celebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 pointer-events-none">
          <div className="card text-center py-12 px-8 max-w-sm animate-bounce">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">今日复习完成！</h2>
            <p className="text-gray-500">所有知识点都已复习完毕，继续保持！</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">综合测试</h1>
          <p className="text-gray-500 text-sm mt-1">基于艾宾浩斯遗忘曲线的智能复习系统</p>
        </div>
        <button onClick={loadReviewData} className="btn-secondary text-sm flex items-center gap-1">
          <RefreshCw size={14} />
          刷新
        </button>
      </div>

      <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-700">今日进度</span>
          </div>
          <span className="text-sm font-bold text-blue-700">
            今日已完成 {todayCompleted} / {todayTotal}
          </span>
        </div>
        <div className="w-full bg-white rounded-full h-3 overflow-hidden border border-blue-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-700"
            style={{ width: `${todayProgress}%` }}
          />
        </div>
        {allDone && (
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
            <CheckCircle size={12} /> 今日复习全部完成！
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Circle size={16} className="text-yellow-600 fill-yellow-400" />
            </div>
            <span className="text-xs text-gray-500">小黄点</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{reviewStatus?.yellowDotCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">待复习知识点</p>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-600" />
            </div>
            <span className="text-xs text-gray-500">今日到期</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{reviewStatus?.dueCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">需要立即复习</p>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <BookOpen size={16} className="text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">复习队列</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{reviewStatus?.totalCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">全部待复习任务</p>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={16} className="text-green-600" />
            </div>
            <span className="text-xs text-gray-500">已完成</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {reviewStatus ? reviewStatus.totalCount - reviewStatus.dueCount : 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">未到期任务</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setActiveTab('all')}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'all' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            全部任务 ({reviewStatus?.totalCount ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              activeTab === 'overdue' ? 'bg-red-100 text-red-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Circle size={10} className="fill-red-400 text-red-400" />
            已到期 ({overdueTasks.length})
          </button>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无复习任务</h3>
            <p className="text-gray-500 text-sm mb-4">
              {reviewStatus && reviewStatus.yellowDotCount === 0
                ? '所有知识点都在掌握中，继续保持！'
                : '开始做题后，系统会自动安排复习任务'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task, i) => (
              <ReviewTaskCard
                key={i}
                task={task}
                isCompleted={completedToday.includes(task.knowledgePointId)}
                onComplete={() => handleComplete(task.knowledgePointId)}
                onQuickReview={() => handleQuickReview(task.knowledgePointId)}
                onFullReview={() => handleFullReview(task.knowledgePointId)}
              />
            ))}
          </div>
        )}
      </div>

      {reviewStatus && reviewStatus.yellowDotCount > 0 && (
        <div className="card border-yellow-300 bg-yellow-50/50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-yellow-200 rounded-xl flex items-center justify-center shrink-0">
              <Zap className="text-yellow-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">知能行小黄点提醒</h3>
              <p className="text-sm text-gray-600 mt-1">
                你有 <span className="font-bold text-yellow-700">{reviewStatus.yellowDotCount}</span> 个知识点需要复习。
                知能行的综测系统基于艾宾浩斯遗忘曲线，在最佳复习时间点提醒你巩固薄弱点。
                及时复习能达到"想忘也忘不掉"的效果。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewTaskCard({
  task,
  isCompleted,
  onComplete,
  onQuickReview,
  onFullReview,
}: {
  task: ReviewTask;
  isCompleted: boolean;
  onComplete: () => void;
  onQuickReview: () => void;
  onFullReview: () => void;
}) {
  const lvConfig = getLevelConfig(task.level);
  const dueColor = task.isOverdue ? 'text-red-600' : formatTime(task.nextReviewAt || '') === '今天' ? 'text-yellow-600' : 'text-green-600';
  const dueBg = task.isOverdue ? 'bg-red-100' : formatTime(task.nextReviewAt || '') === '今天' ? 'bg-yellow-100' : 'bg-green-100';
  const overdueClass = task.isOverdue
    ? 'border-l-4 border-l-red-400 bg-red-50/30'
    : 'border-l-4 border-l-transparent';

  const masteryPercent = Math.max(5, (task.theta + 3) / 6 * 100);
  const prevMasteryPercent = Math.max(5, masteryPercent * 0.85);

  return (
    <div className={`rounded-xl bg-white border border-gray-100 hover:border-gray-200 transition-colors ${overdueClass} ${isCompleted ? 'opacity-60' : ''}`}>
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${lvConfig.color}`}>
            <span className="text-white font-bold text-sm">L{task.level}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 text-sm">{task.name}</span>
              {task.isOverdue && (
                <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                  已到期
                </span>
              )}
              {isCompleted && (
                <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <CheckCircle size={10} /> 已完成
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-400">{task.category}</span>
              <span className="text-xs text-gray-400">{task.chapter}</span>
              <span className={`text-xs font-medium ${lvConfig.textColor}`}>
                {task.levelLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">上次掌握度</span>
                  <span className="text-xs font-mono text-gray-500">{Math.round(prevMasteryPercent)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-gray-400 transition-all"
                    style={{ width: `${prevMasteryPercent}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">当前掌握度</span>
                  <span className="text-xs font-mono font-bold" style={{ color: lvConfig.color.replace('bg-', '#').replace(/-\d+$/, '') }}>
                    {Math.round(masteryPercent)}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${lvConfig.color} transition-all`}
                    style={{ width: `${masteryPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${dueBg} ${dueColor}`}>
              <Clock size={12} />
              {task.isOverdue ? '已过期' : task.nextReviewAt ? formatTime(task.nextReviewAt) : '—'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={onQuickReview}
            className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg font-medium hover:bg-amber-100 flex items-center gap-1"
          >
            <Zap size={12} />
            快速复习
          </button>
          <button
            onClick={onFullReview}
            className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 flex items-center gap-1"
          >
            <Play size={12} />
            开始
          </button>
          {!isCompleted && (
            <button
              onClick={onComplete}
              className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 flex items-center gap-1 ml-auto"
            >
              <CheckCircle size={12} />
              完成复习
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return '已过期';
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '明天';
  if (diffDays < 7) return `${diffDays}天后`;
  if (diffDays < 30) return `${Math.round(diffDays / 7)}周后`;
  return `${Math.round(diffDays / 30)}月后`;
}