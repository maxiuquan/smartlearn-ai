import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { api } from '../api/client';
import KnowledgeCard from '../components/KnowledgeCard';
import {
  LineChart,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Circle,
  CheckCircle2,
  BarChart3,
  PieChart,
  Play,
  Filter,
} from 'lucide-react';

interface KnowledgePoint {
  id: number;
  name: string;
  chapter: string;
  description: string;
  difficulty: number;
  prerequisites: { id: number; name: string }[];
  children: { id: number; name: string; description: string; difficulty: number }[];
}

interface CategoryTree {
  category: string;
  knowledgePoints: KnowledgePoint[];
}

interface LevelConfig {
  level: number;
  color: string;
  bgColor: string;
  textColor: string;
  barColor: string;
  ringColor: string;
  label: string;
}

const LEVEL_CONFIG: LevelConfig[] = [
  { level: 0, color: 'bg-gray-200', bgColor: 'bg-gray-50', textColor: 'text-gray-400', barColor: 'bg-gray-300', ringColor: '#d1d5db', label: '未学习' },
  { level: 1, color: 'bg-orange-400', bgColor: 'bg-orange-50', textColor: 'text-orange-600', barColor: 'bg-orange-400', ringColor: '#fb923c', label: 'Lv.1 了解' },
  { level: 2, color: 'bg-yellow-400', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600', barColor: 'bg-yellow-400', ringColor: '#facc15', label: 'Lv.2 熟悉' },
  { level: 3, color: 'bg-blue-400', bgColor: 'bg-blue-50', textColor: 'text-blue-600', barColor: 'bg-blue-400', ringColor: '#60a5fa', label: 'Lv.3 掌握' },
  { level: 4, color: 'bg-emerald-400', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600', barColor: 'bg-emerald-400', ringColor: '#34d399', label: 'Lv.4 精通' },
];

function getLevel(mastery: number): number {
  if (mastery >= 0.9) return 4;
  if (mastery >= 0.7) return 3;
  if (mastery >= 0.4) return 2;
  if (mastery > 0) return 1;
  return 0;
}

function getLevelConfig(mastery: number): LevelConfig {
  return LEVEL_CONFIG[getLevel(mastery)];
}

function CircularProgress({ percentage, size = 100, strokeWidth = 8 }: { percentage: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  const config = getLevelConfig(percentage / 100);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={config.ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="animate-pulse-ring"
          style={{
            transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s ease',
            animation: 'pulse-ring 2s ease-in-out infinite',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-gray-800">{percentage}%</span>
        <span className={`text-xs font-medium ${config.textColor}`}>{config.label}</span>
      </div>
    </div>
  );
}

function LevelBadge({ mastery }: { mastery: number }) {
  const config = getLevelConfig(mastery);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
      {config.label}
    </span>
  );
}

function MasteryBar({ mastery, showLabel = true }: { mastery: number; showLabel?: boolean }) {
  const config = getLevelConfig(mastery);
  const pct = Math.round(mastery * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${config.barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className={`text-xs font-medium w-9 text-right ${config.textColor}`}>{pct}%</span>}
    </div>
  );
}

function LevelCountBar({ counts }: { counts: Record<number, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden">
      {LEVEL_CONFIG.map((cfg) => {
        const cnt = counts[cfg.level] || 0;
        const w = (cnt / total) * 100;
        if (w === 0) return null;
        return (
          <div
            key={cfg.level}
            className={`${cfg.color} transition-all duration-500`}
            style={{ width: `${w}%` }}
            title={`${cfg.label}: ${cnt}`}
          />
        );
      })}
    </div>
  );
}

export default function KnowledgeGraph() {
  const userId = useAuthStore((s) => s.userId);
  const navigate = useNavigate();
  const [tree, setTree] = useState<CategoryTree[]>([]);
  const [progress, setProgress] = useState<Record<string, { id: number; name: string; masteryLevel: number }[]>>({});
  const [overallMastery, setOverallMastery] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'unmastered' | 'mastered' | 'weak'>('all');
  const [selectedKpId, setSelectedKpId] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      api.getKnowledgeTree(),
      api.getProgress(userId),
    ]).then(([treeData, progressData]) => {
      setTree(treeData.tree as CategoryTree[]);
      setProgress(progressData.progress as Record<string, { id: number; name: string; masteryLevel: number }[]>);
      setOverallMastery(progressData.overallMastery as number);
    }).finally(() => setLoading(false));
  }, [userId]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getMasteryForPoint = (pointId: number): number => {
    for (const cat of Object.values(progress)) {
      const found = cat.find((p) => p.id === pointId);
      if (found) return found.masteryLevel;
    }
    return 0;
  };

  const overallLevelCounts = useMemo(() => {
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const seen = new Set<number>();
    for (const cat of Object.values(progress)) {
      for (const p of cat) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        counts[getLevel(p.masteryLevel)]++;
      }
    }
    return counts;
  }, [progress]);

  const getCategoryLevelCounts = (category: string) => {
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const seen = new Set<number>();
    const catProgress = progress[category] || [];
    for (const p of catProgress) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      counts[getLevel(p.masteryLevel)]++;
    }
    const catTree = tree.find((c) => c.category === category);
    const totalInCategory = catTree?.knowledgePoints.length || 0;
    const counted = Object.values(counts).reduce((a, b) => a + b, 0);
    if (counted < totalInCategory) {
      counts[0] += totalInCategory - counted;
    }
    return counts;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <LineChart className="text-primary-600" />
          知识图谱
        </h1>
        <div className="flex items-center gap-4">
          <CircularProgress percentage={Math.round(overallMastery * 100)} size={72} strokeWidth={6} />
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <PieChart size={18} className="text-primary-600" />
          <h2 className="font-semibold text-gray-900">整体掌握概览</h2>
        </div>
        <div className="grid grid-cols-5 gap-2 mb-3">
          {LEVEL_CONFIG.map((cfg) => {
            const count = overallLevelCounts[cfg.level] || 0;
            return (
              <div
                key={cfg.level}
                className={`${cfg.bgColor} rounded-lg p-2 text-center border border-transparent`}
              >
                <div className={`text-lg font-bold ${cfg.textColor}`}>{count}</div>
                <div className={`text-xs font-medium ${cfg.textColor}`}>{cfg.label}</div>
              </div>
            );
          })}
        </div>
        <LevelCountBar counts={overallLevelCounts} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={16} className="text-gray-400" />
        {([
          { key: 'all', label: '全部' },
          { key: 'unmastered', label: '未掌握' },
          { key: 'mastered', label: '已掌握' },
          { key: 'weak', label: '薄弱' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterType(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filterType === key
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {tree.map((category) => {
          const catCounts = getCategoryLevelCounts(category.category);
          const masteredCount = catCounts[3] + catCounts[4];
          const totalCount = category.knowledgePoints.length;
          return (
            <div key={category.category} className="card">
              <button
                onClick={() => toggleExpand(category.category)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="text-primary-600" size={20} />
                  <h2 className="text-lg font-semibold text-gray-900">{category.category}</h2>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {totalCount} 个知识点
                  </span>
                  {masteredCount > 0 && (
                    <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {masteredCount} 已掌握
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-1">
                    {LEVEL_CONFIG.slice(1).map((cfg) => (
                      <span
                        key={cfg.level}
                        className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.bgColor} ${cfg.textColor}`}
                      >
                        {cfg.label.replace(/Lv\.\d\s?/, '')}{catCounts[cfg.level]}
                      </span>
                    ))}
                  </div>
                  {expanded.has(category.category) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
              </button>

              <div className="mt-1">
                <LevelCountBar counts={catCounts} />
              </div>

              {expanded.has(category.category) && (
                <div className="mt-4 space-y-3">
                  {category.knowledgePoints.filter(kp => {
                    const m = getMasteryForPoint(kp.id);
                    if (filterType === 'unmastered') return m < 0.5;
                    if (filterType === 'mastered') return m >= 0.7;
                    if (filterType === 'weak') return m > 0 && m < 0.5;
                    return true;
                  }).map((kp) => {
                    const mastery = getMasteryForPoint(kp.id);
                    const prereqMasteries = kp.prerequisites.map((pr) => getMasteryForPoint(pr.id));
                    const hasMissingPrereqs = prereqMasteries.some((m) => m < 0.4);
                    const isSelected = selectedKpId === kp.id;

                    const cardBorderColor = mastery >= 0.9
                      ? 'border-emerald-400'
                      : mastery >= 0.7
                        ? 'border-blue-400'
                        : mastery >= 0.4
                          ? 'border-yellow-400'
                          : mastery > 0
                            ? 'border-orange-400'
                            : 'border-gray-200';
                    const cardBgColor = mastery >= 0.9
                      ? 'bg-emerald-50/50'
                      : mastery >= 0.7
                        ? 'bg-blue-50/50'
                        : mastery >= 0.4
                          ? 'bg-yellow-50/50'
                          : mastery > 0
                            ? 'bg-orange-50/50'
                            : 'bg-white';
                    const cardShadow = mastery >= 0.9
                      ? 'shadow-emerald-200/50'
                      : mastery >= 0.7
                        ? 'shadow-blue-200/50'
                        : mastery > 0
                          ? 'shadow-orange-200/30'
                          : '';

                    return (
                      <div key={kp.id}>
                        <div
                          onClick={() => setSelectedKpId(isSelected ? null : kp.id)}
                          className={`border-2 rounded-xl p-4 transition-all cursor-pointer group relative ${cardBorderColor} ${cardBgColor} shadow-sm ${cardShadow} hover:shadow-md hover:-translate-y-0.5 ${isSelected ? 'ring-2 ring-primary-400' : ''}`}
                          title="点击练习"
                        >
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] bg-gray-800 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Play size={10} /> 点击练习
                            </span>
                          </div>

                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {mastery >= 0.9 ? (
                                  <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />
                                ) : mastery > 0 ? (
                                  <Circle className="text-blue-500 shrink-0" size={18} />
                                ) : (
                                  <Circle className="text-gray-300 shrink-0" size={18} />
                                )}
                                <h3 className="font-medium text-gray-900">{kp.name}</h3>
                                <LevelBadge mastery={mastery} />
                                <span className="text-xs text-gray-400">
                                  {'★'.repeat(kp.difficulty)}{'☆'.repeat(3 - kp.difficulty)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <p className="text-sm text-gray-500 mb-3">{kp.description}</p>

                          <div className="space-y-2">
                            <MasteryBar mastery={mastery} />

                            {kp.prerequisites.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                {kp.prerequisites.map((pr, idx) => {
                                  const prMastery = getMasteryForPoint(pr.id);
                                  const prConfig = getLevelConfig(prMastery);
                                  return (
                                    <span key={pr.id} className="flex items-center gap-1">
                                      {idx > 0 && (
                                        <svg width="14" height="14" viewBox="0 0 14 14" className="text-gray-300 shrink-0">
                                          <line x1="0" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1.5" />
                                          <polyline points="6,3 10,7 6,11" fill="none" stroke="currentColor" strokeWidth="1.5" />
                                        </svg>
                                      )}
                                      <span
                                        className={`text-xs px-2 py-0.5 rounded-full font-medium border ${prConfig.bgColor} ${prConfig.textColor} border-current/20`}
                                      >
                                        {pr.name}
                                        <span className="ml-1 opacity-70">{Math.round(prMastery * 100)}%</span>
                                      </span>
                                    </span>
                                  );
                                })}
                                {hasMissingPrereqs && (
                                  <span className="text-xs text-orange-500 font-medium ml-1">
                                    (存在薄弱前置)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {kp.children.length > 0 && (
                            <div className="mt-3 pl-4 border-l-2 border-dashed space-y-2" style={{ borderColor: '#e5e7eb' }}>
                              {kp.children.map((child) => {
                                const childMastery = getMasteryForPoint(child.id);
                                const childConfig = getLevelConfig(childMastery);
                                return (
                                  <div key={child.id} className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {childMastery >= 0.9 ? (
                                        <CheckCircle2 className="text-emerald-500 shrink-0" size={14} />
                                      ) : childMastery > 0 ? (
                                        <Circle className="text-blue-500 shrink-0" size={14} />
                                      ) : (
                                        <Circle className="text-gray-300 shrink-0" size={14} />
                                      )}
                                      <span className="text-sm text-gray-700 truncate">{child.name}</span>
                                      <span className={`text-xs font-medium ${childConfig.textColor}`}>
                                        {childConfig.label}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className={`h-1.5 rounded-full transition-all duration-500 ${childConfig.barColor}`}
                                          style={{ width: `${Math.round(childMastery * 100)}%` }}
                                        />
                                      </div>
                                      <span className={`text-xs font-medium w-8 text-right ${childConfig.textColor}`}>
                                        {Math.round(childMastery * 100)}%
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {isSelected && (
                          <div className="mt-2 ml-4 border-l-2 border-primary-300 pl-4">
                            <KnowledgeCard
                              knowledgePointId={kp.id}
                              onStartPractice={(kpId) => navigate(`/math?knowledgePointId=${kpId}`)}
                              compact
                            />
                            <div className="mt-3 flex justify-end">
                              <button
                                onClick={() => navigate(`/math?knowledgePointId=${kp.id}`)}
                                className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
                              >
                                <Play size={16} />
                                开始练习
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}