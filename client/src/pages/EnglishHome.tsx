import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useMembershipStore } from '../store/membership';
import { api } from '../api/client';
import { toast } from '../store/toast';
import {
  BookOpen, Flame, Target, Zap, Clock,
  Brain, ArrowRight, Gamepad2,
  LineChart, ChevronRight,
  BookType, CheckCircle, Star, Search, Eye, Shield, Swords
} from 'lucide-react';
import { StatsSkeleton } from '../components/Skeleton';

const EXAM_TABS = [
  { key: 'postgraduate', label: '考研英语', targetExam: '考研英语' },
  { key: 'cet4', label: '英语四级', targetExam: '英语四级' },
  { key: 'cet6', label: '英语六级', targetExam: '英语六级' },
] as const;

interface EnglishStats {
  total: number;
  mastered: number;
  toReview: number;
  streakDays: number;
  todayLearned: number;
  todayGoal: number;
}

export default function EnglishHome() {
  const navigate = useNavigate();
  const { userId } = useAuthStore();
  const { tier, getTierName, getRemainingFreeGames } = useMembershipStore();
  const [activeTab, setActiveTab] = useState<string>('postgraduate');
  const [stats, setStats] = useState<EnglishStats>({
    total: 0, mastered: 0, toReview: 0, streakDays: 0,
    todayLearned: 0, todayGoal: 20,
  });
  const [loading, setLoading] = useState(true);

  const loadUserWords = async () => {
    if (!userId) return;
    try {
      const data = await api.getUserWords(userId);
      const words = (data as { words: unknown[] }).words || [];
      const masteredCount = words.filter((w: any) => w.memoryLevel >= 4).length;
      const reviewingCount = words.filter((w: any) => {
        const level = w.memoryLevel;
        return level >= 1 && level < 4;
      }).length;
      const todayCount = words.filter((w: any) => {
        if (!w.lastReviewed) return false;
        const today = new Date();
        const lastReview = new Date(w.lastReviewed);
        return lastReview.toDateString() === today.toDateString();
      }).length;
      setStats({
        total: words.length,
        mastered: masteredCount,
        toReview: reviewingCount,
        streakDays: 0,
        todayLearned: todayCount,
        todayGoal: 20,
      });
    } catch {
      setStats({ total: 0, mastered: 0, toReview: 0, streakDays: 0, todayLearned: 0, todayGoal: 20 });
    }
  };

  const handleTabChange = async (targetExam: string) => {
    setActiveTab(targetExam === '考研英语' ? 'postgraduate' : targetExam === '英语四级' ? 'cet4' : 'cet6');
    if (!userId) return;
    try {
      await fetch('/api/subject/set-target-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetExam }),
      });
      toast.success(`已切换到${targetExam}`);
    } catch {
      toast.error('切换失败');
    }
  };

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    loadUserWords().finally(() => setLoading(false));
  }, [userId]);

  const dailyProgress = Math.min(Math.round((stats.todayLearned / stats.todayGoal) * 100), 100);

  const statCards = [
    { icon: BookOpen, label: '已学单词', value: stats.total, suffix: '个', color: 'bg-blue-50 text-blue-600' },
    { icon: CheckCircle, label: '已掌握', value: stats.mastered, suffix: '个', color: 'bg-green-50 text-green-600' },
    { icon: Clock, label: '今日待复习', value: stats.toReview, suffix: '个', color: 'bg-orange-50 text-orange-600' },
    { icon: Flame, label: '连续学习', value: stats.streakDays, suffix: '天', color: 'bg-red-50 text-red-600' },
  ];

  const games = [
    {
      icon: <Zap size={32} />,
      title: '熵增生存',
      desc: '合并词根方块，抵抗压力堆积',
      color: 'from-blue-500 to-cyan-500',
      bgLight: 'from-blue-50 to-cyan-50',
      iconBg: 'bg-gradient-to-br from-blue-100 to-cyan-100',
      path: '/english-games',
    },
    {
      icon: <Swords size={32} />,
      title: '词根深渊',
      desc: '构筑卡牌，瓦解长难句Boss',
      color: 'from-purple-500 to-pink-500',
      bgLight: 'from-purple-50 to-pink-50',
      iconBg: 'bg-gradient-to-br from-purple-100 to-pink-100',
      path: '/english-games',
    },
    {
      icon: <Shield size={32} />,
      title: '防线突围',
      desc: '塔防策略，词汇炮塔消灭怪兽',
      color: 'from-orange-500 to-red-500',
      bgLight: 'from-orange-50 to-red-50',
      iconBg: 'bg-gradient-to-br from-orange-100 to-red-100',
      path: '/english-games',
    },
    {
      icon: <Search size={32} />,
      title: '信息狩猎',
      desc: '滚动文章精准定位，淘汰晋级',
      color: 'from-green-500 to-emerald-500',
      bgLight: 'from-green-50 to-emerald-50',
      iconBg: 'bg-gradient-to-br from-green-100 to-emerald-100',
      path: '/english-games',
    },
  ];

  const smartCards = [
    {
      icon: <Brain size={28} />,
      title: '能力评估',
      desc: '测试你的词汇量水平',
      color: 'from-indigo-500 to-purple-500',
      path: '/english-path',
    },
    {
      icon: <LineChart size={28} />,
      title: '学习路径',
      desc: stats.total > 0
        ? `当前词库 ${stats.total} 词，已掌握 ${stats.mastered} 词`
        : '开始建立你的词库',
      color: 'from-blue-500 to-indigo-500',
      path: '/english-path',
    },
    {
      icon: <BookType size={28} />,
      title: '文章阅读',
      desc: 'AI 生成个性化阅读材料',
      color: 'from-emerald-500 to-teal-500',
      path: '/english',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-gray-900">英语学习中心 · 考研/四六级</h1>
        <StatsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="text-blue-600" />
            英语学习中心 · 考研/四六级
          </h1>
          <p className="text-sm text-gray-500 mt-1">游戏化学习，轻松攻克英语</p>
        </div>
      </div>

      <div className="card p-2">
        <div className="flex bg-gray-100 rounded-xl p-1">
          {EXAM_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.targetExam)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

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

      {tier === 'free' && getRemainingFreeGames() < 3 && (
        <div className="card bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Zap size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">今日剩余免费游戏</p>
              <p className="text-2xl font-bold text-amber-600">{getRemainingFreeGames()}次</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/membership')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-sm font-semibold rounded-xl hover:from-yellow-500 hover:to-amber-600 transition-all shadow-md shrink-0"
          >
            <Star size={16} />
            升级会员
          </button>
        </div>
      )}

      {tier !== 'free' && (
        <div className="card bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50 border-yellow-200 flex items-center gap-3">
          <Star size={20} className={tier === 'premium' ? 'text-purple-500' : 'text-yellow-500'} />
          <div>
            <p className="text-sm font-semibold text-gray-900">{getTierName()}</p>
            <p className="text-xs text-gray-500">畅享{tier === 'premium' ? '全部功能' : '高级功能'}，无限游戏，高效学习</p>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Zap size={18} className="text-blue-600" />
          游戏中心（4款训练游戏）
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {games.map((game, i) => (
            <button
              key={i}
              onClick={() => navigate(game.path)}
              className="card group text-left p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
            >
              <div className={`w-14 h-14 rounded-2xl ${game.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <div className={`bg-gradient-to-br ${game.color} bg-clip-text`}>
                  {game.icon}
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1.5">{game.title}</h3>
              <p className="text-sm text-gray-500 mb-3">{game.desc}</p>
              <span className={`text-xs font-medium flex items-center gap-1 bg-gradient-to-r ${game.color} bg-clip-text text-transparent group-hover:gap-2 transition-all`}>
                开始游戏 <ArrowRight size={14} className="text-blue-500" />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Brain size={18} className="text-purple-600" />
          智能学习
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {smartCards.map((card, i) => (
            <button
              key={i}
              onClick={() => navigate(card.path)}
              className="card group text-left p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                {card.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1.5">{card.title}</h3>
              <p className="text-sm text-gray-500 mb-3">{card.desc}</p>
              <span className="text-xs text-purple-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                立即体验 <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="card bg-gradient-to-r from-blue-50 to-purple-50 border-blue-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-700">每日目标</span>
          </div>
          <span className="text-sm font-bold text-blue-700">
            今日已学习 {stats.todayLearned} / 目标 {stats.todayGoal} 个单词
          </span>
        </div>
        <div className="w-full bg-white rounded-full h-4 overflow-hidden border border-blue-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-700"
            style={{ width: `${dailyProgress}%` }}
          />
        </div>
        {dailyProgress >= 100 ? (
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
            <CheckCircle size={12} /> 今日目标已完成！太棒了！
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <Target size={12} />
            继续加油，每天进步一点点
          </p>
        )}
      </div>

      {stats.total === 0 && (
        <div className="card text-center py-12 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
          <div className="text-5xl mb-4">📚</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">开始你的英语学习之旅</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            通过趣味游戏记忆单词，AI 智能分级，让英语学习不再枯燥
          </p>
          <button onClick={() => navigate('/english')} className="btn-primary">
            <Star size={16} className="mr-1" />
            开始学习
          </button>
        </div>
      )}
    </div>
  );
}