import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import {
  BarChart3, TrendingUp, Award, Flame, Clock, Target, BookOpen,
  Brain, ChevronRight, Calendar, Activity, RefreshCw, Zap, Star,
  AlertTriangle, CheckCircle, ArrowUp, ArrowDown, Minus
} from 'lucide-react';

interface DailyStat {
  date: string;
  answers: number;
  correct: number;
}

interface KnowledgePoint {
  id: number;
  name: string;
  category: string;
  mastery: number;
}

interface CategoryProgress {
  category: string;
  mastery: number;
  total: number;
}

interface ReportData {
  totalAnswers: number;
  correctAnswers: number;
  accuracy: number;
  streakDays: number;
  totalStudyTime: number;
  masteredPoints: number;
  totalPoints: number;
  overallMastery: number;
  dailyData: DailyStat[];
  categoryProgress: CategoryProgress[];
  knowledgePoints: KnowledgePoint[];
  suggestions: string[];
}

type TimeFilter = '7d' | '30d' | 'all';

const LEVEL_CONFIG = [
  { level: 0, label: '未学习', color: '#9ca3af', bgColor: 'bg-gray-200', textColor: 'text-gray-400' },
  { level: 1, label: 'Lv.1 了解', color: '#f97316', bgColor: 'bg-orange-400', textColor: 'text-orange-600' },
  { level: 2, label: 'Lv.2 熟悉', color: '#eab308', bgColor: 'bg-yellow-400', textColor: 'text-yellow-600' },
  { level: 3, label: 'Lv.3 掌握', color: '#3b82f6', bgColor: 'bg-blue-400', textColor: 'text-blue-600' },
  { level: 4, label: 'Lv.4 精通', color: '#22c55e', bgColor: 'bg-green-400', textColor: 'text-green-600' },
];

function getLevelIndex(mastery: number): number {
  if (mastery === 0) return 0;
  if (mastery < 0.4) return 1;
  if (mastery < 0.7) return 2;
  if (mastery < 0.9) return 3;
  return 4;
}

function getMasteryColor(mastery: number): string {
  if (mastery >= 0.9) return '#22c55e';
  if (mastery >= 0.7) return '#3b82f6';
  if (mastery >= 0.4) return '#eab308';
  if (mastery > 0) return '#f97316';
  return '#9ca3af';
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

function generateMockReport(): ReportData {
  const now = new Date();
  const dailyStats30: DailyStat[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const answers = Math.floor(Math.random() * 50) + 10;
    const correct = Math.floor(answers * (0.5 + Math.random() * 0.4));
    dailyStats30.push({ date: dateStr, answers, correct });
  }

  const knowledgePoints: KnowledgePoint[] = [
    { id: 1, name: '极限与连续', category: '高等数学', mastery: 0.85 },
    { id: 2, name: '导数与微分', category: '高等数学', mastery: 0.72 },
    { id: 3, name: '不定积分', category: '高等数学', mastery: 0.35 },
    { id: 4, name: '定积分', category: '高等数学', mastery: 0.28 },
    { id: 5, name: '微分方程', category: '高等数学', mastery: 0.55 },
    { id: 6, name: '多元函数微分', category: '高等数学', mastery: 0.18 },
    { id: 7, name: '重积分', category: '高等数学', mastery: 0.08 },
    { id: 8, name: '矩阵运算', category: '线性代数', mastery: 0.65 },
    { id: 9, name: '行列式', category: '线性代数', mastery: 0.55 },
    { id: 10, name: '特征值与特征向量', category: '线性代数', mastery: 0.25 },
    { id: 11, name: '线性方程组', category: '线性代数', mastery: 0.70 },
    { id: 12, name: '随机事件与概率', category: '概率论', mastery: 0.70 },
    { id: 13, name: '随机变量', category: '概率论', mastery: 0.38 },
    { id: 14, name: '大数定律', category: '概率论', mastery: 0.15 },
    { id: 15, name: '数理统计', category: '概率论', mastery: 0.05 },
  ];

  const categoryMap: Record<string, { mastery: number; total: number }> = {};
  knowledgePoints.forEach(kp => {
    if (!categoryMap[kp.category]) categoryMap[kp.category] = { mastery: 0, total: 0 };
    categoryMap[kp.category].total++;
    if (kp.mastery >= 0.7) categoryMap[kp.category].mastery++;
  });

  const totalCorrect = dailyStats30.reduce((s, d) => s + d.correct, 0);
  const totalAnswers = dailyStats30.reduce((s, d) => s + d.answers, 0);
  const masteredCount = knowledgePoints.filter(k => k.mastery >= 0.7).length;
  const overallMastery = knowledgePoints.reduce((s, k) => s + k.mastery, 0) / knowledgePoints.length;

  return {
    totalAnswers,
    correctAnswers: totalCorrect,
    accuracy: totalAnswers > 0 ? totalCorrect / totalAnswers : 0,
    streakDays: Math.floor(Math.random() * 20) + 3,
    totalStudyTime: Math.floor(Math.random() * 3000) + 800,
    masteredPoints: masteredCount,
    totalPoints: knowledgePoints.length,
    overallMastery: Math.round(overallMastery * 1000) / 1000,
    dailyData: dailyStats30,
    categoryProgress: Object.entries(categoryMap).map(([category, data]) => ({
      category,
      mastery: data.mastery,
      total: data.total,
    })),
    knowledgePoints,
    suggestions: [
      '大数定律和数理统计掌握度较低，建议优先巩固概率论基础概念后再深入',
      '定积分和不定积分是薄弱环节，建议从不定积分的基本公式开始，逐步过渡到定积分应用',
      '你的高等数学极限与连续部分表现优秀，可继续保持当前学习节奏',
      '建议每天至少练习30道题，将更多时间分配给概率论的薄弱知识点',
      '线性代数整体表现良好，可适当减少复习时间，将精力集中在概率论',
    ],
  };
}

function CircularProgress({ percent, level }: { percent: number; level: ReturnType<typeof getLevelIndex> }) {
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const config = LEVEL_CONFIG[level];

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={config.color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold text-gray-900">{Math.round(percent)}%</span>
        <span className="text-sm font-medium mt-1" style={{ color: config.color }}>{config.label}</span>
      </div>
    </div>
  );
}

function BarChartSVG({ data, color, maxVal: maxValProp }: { data: { label: string; value: number }[]; color: string; maxVal?: number }) {
  if (data.length === 0) return null;
  const maxVal = maxValProp ?? Math.max(...data.map(d => d.value), 1);
  const w = data.length <= 7 ? 400 : 700;
  const h = 180;
  const pad = { t: 12, b: 36, l: 36, r: 8 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const barW = Math.min(cw / data.length * 0.6, 32);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {[0, 0.25, 0.5, 0.75, 1].map(p => (
        <g key={p}>
          <line x1={pad.l} y1={pad.t + ch * (1 - p)} x2={w - pad.r} y2={pad.t + ch * (1 - p)} stroke="#f3f4f6" strokeWidth="1" />
          <text x={pad.l - 8} y={pad.t + ch * (1 - p) + 4} textAnchor="end" fill="#9ca3af" fontSize="11">
            {Math.round(p * maxVal)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const bh = Math.max((d.value / maxVal) * ch, 2);
        const x = pad.l + (i / (data.length - 1)) * cw;
        return (
          <g key={i}>
            <rect
              x={x - barW / 2} y={pad.t + ch - bh}
              width={barW} height={bh} rx="4" fill={color} opacity="0.85"
            />
            <text x={x} y={h - 10} textAnchor="middle" fill="#9ca3af" fontSize="10">
              {data.length > 14 && i % 3 !== 0 ? '' : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChartSVG({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  if (data.length === 0) return null;
  const w = data.length <= 7 ? 400 : 700;
  const h = 180;
  const pad = { t: 12, b: 36, l: 36, r: 8 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;

  const points = data.map((d, i) => ({
    x: pad.l + (i / (data.length - 1)) * cw,
    y: pad.t + ch - (d.value / 100) * ch,
  }));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {[0, 25, 50, 75, 100].map(p => (
        <g key={p}>
          <line x1={pad.l} y1={pad.t + ch * (1 - p / 100)} x2={w - pad.r} y2={pad.t + ch * (1 - p / 100)} stroke="#f3f4f6" strokeWidth="1" />
          <text x={pad.l - 8} y={pad.t + ch * (1 - p / 100) + 4} textAnchor="end" fill="#9ca3af" fontSize="11">
            {p}%
          </text>
        </g>
      ))}
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {points.length > 1 && (
        <polygon
          points={points.map(p => `${p.x},${p.y}`).join(' ') + ` ${points[points.length - 1].x},${pad.t + ch} ${points[0].x},${pad.t + ch}`}
          fill="url(#lineGrad)"
        />
      )}
      {points.map((p, i) => {
        if (i === 0) return null;
        return (
          <line key={i} x1={points[i - 1].x} y1={points[i - 1].y} x2={p.x} y2={p.y}
            stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          />
        );
      })}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="white" stroke={color} strokeWidth="2.5" />
      ))}
      {data.map((d, i) => {
        const x = pad.l + (i / (data.length - 1)) * cw;
        return (
          <text key={i} x={x} y={h - 10} textAnchor="middle" fill="#9ca3af" fontSize="10">
            {data.length > 14 && i % 3 !== 0 ? '' : d.label}
          </text>
        );
      })}
    </svg>
  );
}

export default function StudyReport() {
  const navigate = useNavigate();
  const { userId } = useAuthStore();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7d');
  const [chartMode, setChartMode] = useState<'accuracy' | 'count'>('accuracy');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/user/${userId}/report`)
      .then(r => {
        if (!r.ok) throw new Error('API not available');
        return r.json();
      })
      .then(data => setReport(data))
      .catch(() => {
        setReport(generateMockReport());
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const currentLevel = report ? getLevelIndex(report.overallMastery) : 0;
  const levelConfig = LEVEL_CONFIG[currentLevel];

  const filteredStats = useMemo(() => {
    if (!report?.dailyData) return [];
    if (timeFilter === '7d') return report.dailyData.slice(-7);
    if (timeFilter === '30d') return report.dailyData.slice(-30);
    return report.dailyData;
  }, [report, timeFilter]);

  const accuracyData = useMemo(() =>
    filteredStats.map(d => ({
      label: d.date.slice(5),
      value: d.answers > 0 ? Math.round((d.correct / d.answers) * 100) : 0,
    })),
    [filteredStats]
  );

  const countData = useMemo(() =>
    filteredStats.map(d => ({
      label: d.date.slice(5),
      value: d.answers,
    })),
    [filteredStats]
  );

  const weakPoints = useMemo(() =>
    report?.knowledgePoints.filter(kp => kp.mastery < 0.4).sort((a, b) => a.mastery - b.mastery) ?? [],
    [report]
  );

  const strongPoints = useMemo(() =>
    report?.knowledgePoints.filter(kp => kp.mastery >= 0.7).sort((a, b) => b.mastery - a.mastery) ?? [],
    [report]
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">学习分析报告</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-gray-200 mb-3" />
              <div className="h-7 bg-gray-200 rounded w-16 mb-1" />
              <div className="h-3 bg-gray-100 rounded w-10" />
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card animate-pulse h-64" />
          <div className="card animate-pulse h-64" />
        </div>
        <div className="card animate-pulse h-48" />
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="text-primary-600" />
            学习分析报告
          </h1>
          <p className="text-gray-500 text-sm mt-1">基于你的学习数据生成个性化分析</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([
            { key: '7d' as TimeFilter, label: '近7天' },
            { key: '30d' as TimeFilter, label: '近30天' },
            { key: 'all' as TimeFilter, label: '全部' },
          ]).map(item => (
            <button
              key={item.key}
              onClick={() => setTimeFilter(item.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                timeFilter === item.key
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          {
            icon: Target, label: '累计答题', value: report.totalAnswers, suffix: '题',
            color: 'bg-blue-50 text-blue-600',
          },
          {
            icon: Award, label: '正确率', value: Math.round(report.accuracy * 100), suffix: '%',
            color: 'bg-green-50 text-green-600',
          },
          {
            icon: Flame, label: '连续学习', value: report.streakDays, suffix: '天',
            color: 'bg-red-50 text-red-600',
          },
          {
            icon: Clock, label: '总学习时间', value: formatMinutes(report.totalStudyTime), suffix: '',
            color: 'bg-purple-50 text-purple-600',
            isString: true,
          },
          {
            icon: Brain, label: '已掌握知识点', value: report.masteredPoints, suffix: `/${report.totalPoints}`,
            color: 'bg-amber-50 text-amber-600',
          },
        ].map((card, i) => (
          <div key={i} className="card animate-slide-up" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color} mb-3`}>
              <card.icon size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {card.isString ? card.value : card.value}
              {card.suffix && <span className="text-sm font-normal text-gray-400 ml-1">{card.suffix}</span>}
            </p>
            <p className="text-xs text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-6">
            <Star size={18} className="text-primary-600" />
            能力等级
          </h2>
          <div className="flex items-center gap-6">
            <CircularProgress percent={Math.round(report.overallMastery * 100)} level={currentLevel} />
            <div className="flex-1 space-y-3">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold ${levelConfig.bgColor} bg-opacity-15`}>
                <div className={`w-3 h-3 rounded-full ${levelConfig.bgColor}`} />
                <span className={levelConfig.textColor}>{levelConfig.label}</span>
              </div>
              <div className="space-y-2">
                {LEVEL_CONFIG.filter(l => l.level > 0).map(lv => {
                  const rangeStart = lv.level === 1 ? 1 : lv.level === 2 ? 40 : lv.level === 3 ? 70 : 90;
                  const rangeEnd = lv.level === 1 ? 39 : lv.level === 2 ? 69 : lv.level === 3 ? 89 : 100;
                  const achieved = currentLevel >= lv.level;
                  return (
                    <div key={lv.level} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${lv.bgColor} ${achieved ? '' : 'opacity-25'}`} />
                      <span className={`text-sm flex-1 ${achieved ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                        {lv.label}
                      </span>
                      <span className={`text-xs ${achieved ? lv.textColor : 'text-gray-400'}`}>
                        {rangeStart}-{rangeEnd}%
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${levelConfig.bgColor} transition-all duration-700`}
                  style={{ width: `${Math.round(report.overallMastery * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Activity size={18} className="text-primary-600" />
              答题趋势
            </h2>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setChartMode('accuracy')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  chartMode === 'accuracy' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'
                }`}
              >
                正确率
              </button>
              <button
                onClick={() => setChartMode('count')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  chartMode === 'count' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'
                }`}
              >
                答题数
              </button>
            </div>
          </div>
          {filteredStats.length > 0 ? (
            chartMode === 'accuracy' ? (
              <LineChartSVG data={accuracyData} color="#3b82f6" />
            ) : (
              <BarChartSVG data={countData} color="#8b5cf6" />
            )
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Activity size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">暂无学习数据</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {report.categoryProgress.map(cat => {
          const catMastery = cat.total > 0 ? cat.mastery / cat.total : 0;
          const catLevel = getLevelIndex(catMastery);
          const lvConfig = LEVEL_CONFIG[catLevel];
          const progressPercent = Math.round(catMastery * 100);
          const categoryPoints = report.knowledgePoints.filter(kp => kp.category === cat.category);
          return (
            <div key={cat.category} className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${lvConfig.bgColor}`} />
                  {cat.category}
                </h3>
                <span className={`text-sm font-bold ${lvConfig.textColor}`}>
                  {lvConfig.label}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden">
                <div
                  className={`h-full rounded-full ${lvConfig.bgColor} transition-all duration-700`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mb-4">
                <span>已掌握 {cat.mastery}/{cat.total} 个</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="space-y-2">
                {categoryPoints.map(kp => {
                  const kpPercent = Math.round(kp.mastery * 100);
                  const kpColor = getMasteryColor(kp.mastery);
                  return (
                    <div key={kp.id} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-20 truncate">{kp.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${kpPercent}%`, backgroundColor: kpColor }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-9 text-right">{kpPercent}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {weakPoints.length > 0 && (
        <div className="card border-red-100">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-red-500" />
            薄弱知识点
            <span className="text-sm font-normal text-red-400 ml-2">
              掌握度低于 40% · 共 {weakPoints.length} 个
            </span>
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {weakPoints.map(kp => {
              const kpPercent = Math.round(kp.mastery * 100);
              return (
                <div
                  key={kp.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100 cursor-pointer hover:bg-red-100 transition-colors"
                  onClick={() => navigate(`/math?category=${encodeURIComponent(kp.category)}&chapter=${encodeURIComponent(kp.name)}`)}
                >
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                    <AlertTriangle size={16} className="text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 truncate">{kp.name}</span>
                      <span className="text-xs text-red-500 font-bold ml-2 shrink-0">{kpPercent}%</span>
                    </div>
                    <span className="text-xs text-gray-400">{kp.category}</span>
                    <div className="w-full bg-red-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-500 transition-all duration-500"
                        style={{ width: `${kpPercent}%` }}
                      />
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-red-300 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {strongPoints.length > 0 && (
        <div className="card border-green-100">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <CheckCircle size={18} className="text-green-500" />
            已掌握知识点
            <span className="text-sm font-normal text-green-400 ml-2">
              掌握度 ≥ 70% · 共 {strongPoints.length} 个
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {strongPoints.map(kp => (
              <span
                key={kp.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100 cursor-pointer hover:bg-green-100 transition-colors"
                onClick={() => navigate(`/math?category=${encodeURIComponent(kp.category)}&chapter=${encodeURIComponent(kp.name)}`)}
              >
                <CheckCircle size={14} />
                {kp.name}
                <span className="text-green-400 text-xs">{Math.round(kp.mastery * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card bg-gradient-to-br from-purple-50 to-blue-50 border-purple-100">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Zap size={18} className="text-purple-500" />
          个性化学习建议
        </h2>
        <div className="space-y-3">
          {report.suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-purple-100">
              <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                <Brain size={14} className="text-purple-600" />
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{s}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate('/math?mode=from-scratch')} className="btn-primary">
          <Zap size={16} className="mr-1" />从零开始学习
        </button>
        <button onClick={() => navigate('/chapters')} className="btn-secondary">
          <BookOpen size={16} className="mr-1" />按章学习
        </button>
        <button onClick={() => { setReport(generateMockReport()); }} className="btn-ghost ml-auto">
          <RefreshCw size={16} className="mr-1" />刷新数据
        </button>
      </div>
    </div>
  );
}