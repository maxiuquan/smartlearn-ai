import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import {
  LineChart, BookOpen, Bookmark, FileText, BarChart3, Target, Activity, ChevronRight
} from 'lucide-react';
import { StatsSkeleton } from '../components/Skeleton';
import { getLevelConfig } from '../types';

interface CenterStats {
  weeklyActivity: { date: string; count: number }[];
  categoryProgress: { category: string; mastery: number; total: number; averageLevel: number }[];
}

const toolCards = [
  {
    to: '/knowledge',
    icon: LineChart,
    title: '知识图谱',
    description: '可视化知识点依赖关系与掌握度',
    color: 'bg-blue-50 text-blue-600',
    gradient: 'from-blue-50 to-blue-100',
  },
  {
    to: '/errors',
    icon: Bookmark,
    title: '错题精炼本',
    description: '智能分析错题原因，精准巩固弱点',
    color: 'bg-red-50 text-red-600',
    gradient: 'from-red-50 to-red-100',
  },
  {
    to: '/study-plan',
    icon: FileText,
    title: '学习计划',
    description: '根据目标考试制定个性化学习路径',
    color: 'bg-purple-50 text-purple-600',
    gradient: 'from-purple-50 to-purple-100',
  },
  {
    to: '/mock-exam',
    icon: BarChart3,
    title: '模拟考',
    description: '历年真题模拟，考场实战演练',
    color: 'bg-orange-50 text-orange-600',
    gradient: 'from-orange-50 to-orange-100',
  },
  {
    to: '/report',
    icon: Activity,
    title: '学习报告',
    description: '详细的学习数据分析和能力评估',
    color: 'bg-green-50 text-green-600',
    gradient: 'from-green-50 to-green-100',
  },
  {
    to: '/diagnostic',
    icon: Target,
    title: '智能诊断',
    description: 'AI 精准定位薄弱环节，定制学习路径',
    color: 'bg-primary-50 text-primary-600',
    gradient: 'from-primary-50 to-blue-100',
  },
];

export default function StudyCenter() {
  const navigate = useNavigate();
  const { userId } = useAuthStore();
  const [stats, setStats] = useState<CenterStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/user/${userId}/dashboard`)
      .then(r => r.json())
      .then((data) => {
        setStats({
          weeklyActivity: data.weeklyActivity || [],
          categoryProgress: data.categoryProgress || [],
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="text-primary-600" />
          学习中心
        </h1>
        <StatsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="text-primary-600" />
            学习中心
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">探索学习工具，追踪学习进度</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {toolCards.map((card) => (
          <button
            key={card.to}
            onClick={() => navigate(card.to)}
            className="card group hover:border-primary-200 hover:shadow-lg transition-all text-left"
          >
            <div className={`w-12 h-12 bg-gradient-to-br ${card.gradient} rounded-2xl flex items-center justify-center mb-3`}>
              <card.icon size={24} className={card.color} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{card.title}</h3>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">{card.description}</p>
            <span className="text-xs text-primary-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
              进入 <ChevronRight size={14} />
            </span>
          </button>
        ))}
      </div>

      {stats?.weeklyActivity && stats.weeklyActivity.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Activity size={18} className="text-primary-600" />
            本周学习活动
          </h2>
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
        </div>
      )}

      {(stats?.categoryProgress || []).length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-primary-600" />
            各科目掌握进度
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
      )}
    </div>
  );
}