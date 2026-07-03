import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { api } from '../api/client';
import { toast } from '../store/toast';
import { Calendar, BookOpen, CheckCircle, Clock, Target, ChevronRight, ChevronDown, ChevronLeft, Play, Bookmark, Award, TrendingUp, Zap, AlertTriangle } from 'lucide-react';

const EXAM_TYPES = ['考研数学一', '考研数学二', '考研数学三'];

interface KnowledgePoint {
  id: number;
  name: string;
  category: string;
  chapter: string;
}

interface StudyWeekItem {
  id: number;
  weekNumber: number;
  status: string;
  knowledgePoint: KnowledgePoint;
  mastered?: boolean;
}

interface StudyPlanData {
  id: number;
  examType: string;
  startDate: string;
  endDate: string;
  currentWeek: number;
  totalWeeks: number;
  items: StudyWeekItem[];
}

function getWeekStatus(weekNumber: number, currentWeek: number, allCompleted?: boolean): string {
  if (allCompleted) return '已完成';
  if (weekNumber < currentWeek) return '已完成';
  if (weekNumber === currentWeek) return '进行中';
  return '待开始';
}

function getExpectedWeek(startDate: string, totalWeeks: number): number {
  const start = new Date(startDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysPerWeek = (totalWeeks * 7) / totalWeeks;
  const expectedWeek = Math.ceil(diffDays / 7) + 1;
  return Math.max(1, Math.min(totalWeeks, expectedWeek));
}

export default function StudyPlan() {
  const navigate = useNavigate();
  const { userId, examType: storeExamType } = useAuthStore();
  const [plan, setPlan] = useState<StudyPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [completingWeek, setCompletingWeek] = useState(false);
  const autoCompletedRef = useRef<Set<number>>(new Set());

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedExam, setSelectedExam] = useState(storeExamType || '考研数学一');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalWeeks, setTotalWeeks] = useState(36);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (userId) {
      loadPlan();
    }
  }, [userId]);

  const loadPlan = async () => {
    setLoading(true);
    try {
      const data = await api.getStudyPlan(userId!) as StudyPlanData;
      if (data && data.id) {
        setPlan(data);
        setShowCreateForm(false);
      } else {
        setShowCreateForm(true);
      }
    } catch {
      setShowCreateForm(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!startDate || totalWeeks < 4) {
      toast.warning('请填写完整的规划信息');
      return;
    }
    setCreating(true);
    try {
      const data = await api.createStudyPlan({
        userId: userId!,
        examType: selectedExam,
        startDate,
        totalWeeks,
      }) as StudyPlanData;
      setPlan(data);
      setShowCreateForm(false);
      toast.success('学习规划创建成功！');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建规划失败');
    } finally {
      setCreating(false);
    }
  };

  const handleCompleteWeek = async (weekNumber: number) => {
    if (!plan) return;
    setCompletingWeek(true);
    try {
      await api.updateStudyWeek({
        userId: userId!,
        planId: plan.id,
        weekNumber,
      });
      await loadPlan();
      toast.success(`第 ${weekNumber} 周已完成！`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setCompletingWeek(false);
    }
  };

  const toggleWeek = (weekNumber: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekNumber)) {
        next.delete(weekNumber);
      } else {
        next.add(weekNumber);
      }
      return next;
    });
  };

  const weeklyData = useMemo(() => {
    if (!plan) return [];
    const weeks: { weekNumber: number; status: string; items: StudyWeekItem[]; mastery: number }[] = [];
    const grouped: Record<number, StudyWeekItem[]> = {};
    plan.items.forEach((item) => {
      if (!grouped[item.weekNumber]) grouped[item.weekNumber] = [];
      grouped[item.weekNumber].push(item);
    });
    for (let w = 1; w <= plan.totalWeeks; w++) {
      const items = grouped[w] || [];
      const masteredCount = items.filter((i) => i.mastered || (i.status === 'completed' && w < plan.currentWeek)).length;
      const mastery = items.length > 0 ? Math.round((masteredCount / items.length) * 100) : 0;
      weeks.push({
        weekNumber: w,
        status: getWeekStatus(w, plan.currentWeek),
        items,
        mastery,
      });
    }
    return weeks;
  }, [plan]);

  const overallProgress = useMemo(() => {
    if (!plan) return 0;
    if (plan.totalWeeks === 0) return 0;
    const completedWeeks = weeklyData.filter((w) => w.status === '已完成').length;
    return Math.round((completedWeeks / plan.totalWeeks) * 100);
  }, [weeklyData, plan]);

  const expectedWeek = plan ? getExpectedWeek(plan.startDate, plan.totalWeeks) : 0;
  const paceStatus: 'ahead' | 'normal' | 'behind' = plan
    ? plan.currentWeek > expectedWeek ? 'ahead' : plan.currentWeek < expectedWeek ? 'behind' : 'normal'
    : 'normal';

  const paceConfig = {
    ahead: { label: '超前', color: 'text-green-600', bg: 'bg-green-100', icon: TrendingUp },
    normal: { label: '正常', color: 'text-blue-600', bg: 'bg-blue-100', icon: CheckCircle },
    behind: { label: '落后', color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle },
  };

  const currentWeekData = weeklyData.find(w => w.weekNumber === plan?.currentWeek);
  const currentWeekItems = currentWeekData?.items ?? [];
  const allCurrentWeekMastered = currentWeekItems.length > 0 && currentWeekItems.every(i => i.mastered);

  useEffect(() => {
    if (allCurrentWeekMastered && plan && !autoCompletedRef.current.has(plan.currentWeek)) {
      const weekNum = plan.currentWeek;
      autoCompletedRef.current.add(weekNum);
      const timer = setTimeout(() => {
        handleCompleteWeek(weekNum);
        toast.success(`🎉 第 ${weekNum} 周所有知识点已掌握，自动完成！`);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [allCurrentWeekMastered, plan?.currentWeek]);

  const priorityKPs = currentWeekItems.filter(i => !i.mastered);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-64" />
          <div className="card"><div className="h-64 bg-gray-100 rounded-xl" /></div>
        </div>
      </div>
    );
  }

  if (showCreateForm && !plan) {
    return (
      <div className="max-w-xl mx-auto animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4">
            <Calendar className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">创建学习规划</h1>
          <p className="text-gray-500 mt-2">制定你的考研全程学习计划</p>
        </div>

        <div className="card space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">考试类型</label>
            <div className="relative">
              <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <select
                className="input-field pl-10 appearance-none"
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
              >
                {EXAM_TYPES.map((exam) => (
                  <option key={exam} value={exam}>{exam}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">开始日期</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="date"
                className="input-field pl-10"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              规划周数：
              <span className="text-primary-600 font-bold text-lg ml-2">{totalWeeks} 周</span>
            </label>
            <input
              type="range"
              min="24"
              max="48"
              step="2"
              value={totalWeeks}
              onChange={(e) => setTotalWeeks(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>24 周</span>
              <span>36 周（推荐）</span>
              <span>48 周</span>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
            <p className="flex items-center gap-1.5">
              <Target size={16} />
              预计结束日期：{startDate ? (() => {
                const d = new Date(startDate);
                d.setDate(d.getDate() + totalWeeks * 7);
                return d.toISOString().split('T')[0];
              })() : '--'}
            </p>
            <p className="mt-1 text-blue-500">总复习天数：{totalWeeks * 7} 天</p>
          </div>

          <button
            onClick={handleCreatePlan}
            disabled={creating}
            className="btn-primary w-full py-3"
          >
            {creating ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                创建中...
              </div>
            ) : (
              <span className="flex items-center gap-2">
                <Play size={18} />
                开始规划
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bookmark className="text-primary-600" />
            学习规划
          </h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <BookOpen size={16} />
            {plan?.examType}
            <span className="text-gray-300">·</span>
            <Calendar size={16} />
            {plan?.startDate} ~ {plan?.endDate}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">当前进度</p>
          <p className="text-2xl font-bold text-primary-600">{overallProgress}%</p>
        </div>
      </div>

      <div className={`card border-2 ${paceConfig[paceStatus].bg} ${paceConfig[paceStatus].color.replace('text', 'border')}`}>
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paceConfig[paceStatus].bg}`}>
            {(() => { const Icon = paceConfig[paceStatus].icon; return <Icon className={paceConfig[paceStatus].color} size={20} />; })()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">学习进度</p>
            <p className={`text-sm font-bold ${paceConfig[paceStatus].color}`}>
              {paceConfig[paceStatus].label}
              {paceStatus === 'behind' && ` (落后 ${expectedWeek - (plan?.currentWeek || 0)} 周)`}
              {paceStatus === 'ahead' && ` (超前 ${(plan?.currentWeek || 0) - expectedWeek} 周)`}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-500">当前周</p>
            <p className="text-lg font-bold text-gray-900">第 {plan?.currentWeek} 周</p>
          </div>
        </div>
      </div>

      {priorityKPs.length > 0 && (
        <div className="card bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="text-amber-600" size={18} />
            <h3 className="font-semibold text-gray-900">今日推荐</h3>
            <span className="text-xs text-gray-500">本周优先掌握的知识点</span>
          </div>
          <div className="space-y-2">
            {priorityKPs.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-amber-100">
                <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.knowledgePoint.name}</p>
                  <p className="text-xs text-gray-400">{item.knowledgePoint.category} · {item.knowledgePoint.chapter}</p>
                </div>
                <button
                  onClick={() => navigate(`/math?knowledgePointId=${item.knowledgePoint.id}`)}
                  className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded-lg font-medium hover:bg-amber-200 flex items-center gap-1"
                >
                  <Play size={10} />
                  开始学习
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-4 mb-2">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">总进度</span>
              <span className="font-medium text-gray-800">{overallProgress}%</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
          <div className="text-center shrink-0">
            <Award className={`w-8 h-8 mx-auto ${overallProgress >= 80 ? 'text-yellow-500' : 'text-gray-300'}`} />
            <span className="text-xs text-gray-400">
              {overallProgress >= 80 ? '冲刺阶段' : overallProgress >= 50 ? '稳步推进' : '基础阶段'}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {weeklyData.map((week) => {
          const isCurrentWeek = week.weekNumber === plan?.currentWeek;
          const isExpanded = expandedWeeks.has(week.weekNumber);
          const isCompleted = week.status === '已完成';
          const isInProgress = week.status === '进行中';

          return (
            <div
              key={week.weekNumber}
              className={`card transition-all ${isCurrentWeek ? 'ring-2 ring-primary-300 bg-primary-50/30' : ''}`}
            >
              <button
                className="w-full flex items-center gap-4 text-left"
                onClick={() => toggleWeek(week.weekNumber)}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCompleted ? 'bg-green-100' : isInProgress ? 'bg-primary-100' : 'bg-gray-100'}`}>
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : isInProgress ? (
                    <Play className="w-5 h-5 text-primary-600" />
                  ) : (
                    <span className="text-sm font-bold text-gray-400">{week.weekNumber}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold ${isCurrentWeek ? 'text-primary-700' : 'text-gray-800'}`}>
                      第 {week.weekNumber} 周
                    </p>
                    <span className={`badge text-xs ${isCompleted ? 'badge-success' : isInProgress ? 'badge-primary' : 'bg-gray-100 text-gray-500'}`}>
                      {isCompleted ? '已完成' : isInProgress ? '进行中' : '待开始'}
                    </span>
                  </div>
                  {week.items.length > 0 && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isCompleted ? 'bg-green-400' : 'bg-primary-400'}`}
                          style={{ width: `${isCompleted ? 100 : week.mastery}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {week.items.length} 个知识点
                      </span>
                    </div>
                  )}
                  {week.items.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">暂无知识点</p>
                  )}
                </div>

                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                )}
              </button>

              {isExpanded && week.items.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 animate-fade-in">
                  {week.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${item.mastered || isCompleted ? 'bg-green-400' : 'bg-gray-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.knowledgePoint.name}</p>
                        <p className="text-xs text-gray-400">{item.knowledgePoint.category} · {item.knowledgePoint.chapter}</p>
                      </div>
                      {item.mastered || isCompleted ? (
                        <span className="text-xs text-green-600 font-medium">已掌握</span>
                      ) : (
                        <span className="text-xs text-gray-400">学习中</span>
                      )}
                    </div>
                  ))}
                  {isInProgress && !allCurrentWeekMastered && (
                    <button
                      onClick={() => handleCompleteWeek(week.weekNumber)}
                      disabled={completingWeek}
                      className="w-full mt-2 btn-primary text-sm py-2"
                    >
                      <CheckCircle size={16} className="mr-1" />
                      {completingWeek ? '处理中...' : '完成本周'}
                    </button>
                  )}
                  {isInProgress && allCurrentWeekMastered && (
                    <p className="text-xs text-green-600 text-center py-2 font-medium">
                      ✅ 本周知识点已全部掌握，将自动完成
                    </p>
                  )}
                </div>
              )}

              {isExpanded && week.items.length === 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 text-center py-4 text-sm text-gray-400 animate-fade-in">
                  本周暂无安排的知识点，休息一下
                  {isInProgress && (
                    <button
                      onClick={() => handleCompleteWeek(week.weekNumber)}
                      disabled={completingWeek}
                      className="btn-secondary w-full mt-3 text-sm py-2"
                    >
                      <ChevronRight size={16} className="mr-1" />
                      跳过本周
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}