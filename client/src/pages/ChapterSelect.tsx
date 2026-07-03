import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { BookOpen, Play, ChevronRight, Rocket, BarChart3, Circle, CheckCircle2, GraduationCap } from 'lucide-react';

interface ChapterData {
  chapter: string;
  knowledgePointCount: number;
  knowledgePoints: { id: number; name: string; description: string; difficulty: number }[];
  averageMastery?: number;
  masteredPoints?: number;
  totalPoints?: number;
}

interface CategoryData {
  category: string;
  chapters: ChapterData[];
}

const LEVEL_CONFIG = [
  { level: 0, color: 'bg-gray-200', textColor: 'text-gray-400', label: '未学习', barColor: 'bg-gray-300' },
  { level: 1, color: 'bg-orange-400', textColor: 'text-orange-600', label: 'Lv.1', barColor: 'bg-orange-400' },
  { level: 2, color: 'bg-yellow-400', textColor: 'text-yellow-600', label: 'Lv.2', barColor: 'bg-yellow-400' },
  { level: 3, color: 'bg-blue-400', textColor: 'text-blue-600', label: 'Lv.3', barColor: 'bg-blue-400' },
  { level: 4, color: 'bg-green-400', textColor: 'text-green-600', label: 'Lv.4', barColor: 'bg-green-400' },
];

function getLevel(mastery: number): number {
  if (mastery === 0) return 0;
  if (mastery < 0.4) return 1;
  if (mastery < 0.7) return 2;
  if (mastery < 0.9) return 3;
  return 4;
}

export default function ChapterSelect() {
  const userId = useAuthStore((s) => s.userId);
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      fetch('/api/knowledge/chapters').then(r => r.json()),
      fetch('/api/knowledge/chapters-progress/' + userId).then(r => r.json()),
    ]).then(([chaptersData, progressData]) => {
      const chaptersCategories = (chaptersData as CategoryData[]) || [];
      const progressCategories = (progressData as CategoryData[]) || [];

      const merged = chaptersCategories.map(cat => ({
        category: cat.category,
        chapters: (cat.chapters || []).map(ch => {
          const progChapter = progressCategories
            .find(pc => pc.category === cat.category)
            ?.chapters?.find(pch => pch.chapter === ch.chapter);
          return {
            ...ch,
            averageMastery: progChapter?.averageMastery ?? 0,
            masteredPoints: progChapter?.masteredPoints ?? 0,
            totalPoints: progChapter?.totalPoints ?? ch.knowledgePointCount,
          };
        }),
      }));

      setCategories(merged);
      if (merged.length > 0) setExpandedCategory(merged[0].category);
    }).finally(() => setLoading(false));
  }, [userId]);

  const startChapter = (category: string, chapter: string) => {
    navigate(`/math?category=${encodeURIComponent(category)}&chapter=${encodeURIComponent(chapter)}`);
  };

  const startFromScratch = () => {
    navigate('/math?mode=from-scratch');
  };

  const categoryIcons: Record<string, string> = {
    '高等数学': '📐',
    '线性代数': '📊',
    '概率论与数理统计': '🎲',
  };

  const categoryDescriptions: Record<string, string> = {
    '高等数学': '函数、极限、微积分、级数、微分方程',
    '线性代数': '行列式、矩阵、向量、线性方程组、特征值',
    '概率论与数理统计': '随机事件、概率分布、参数估计、假设检验',
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="text-primary-600" />
            选择章节
          </h1>
          <p className="text-sm text-gray-500 mt-1">选择需要学习的章节，或从零开始跟随系统规划</p>
        </div>
      </div>

      <button
        onClick={startFromScratch}
        className="w-full card border-2 border-primary-200 bg-gradient-to-r from-primary-50 to-blue-50 hover:shadow-md transition-all group cursor-pointer"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200">
            <Rocket className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 text-left">
            <h2 className="text-lg font-bold text-primary-800">从零开始 · 渐进式学习</h2>
            <p className="text-sm text-primary-600/80">
              系统按知识依赖关系规划最优路径，自动追踪进度，智能推荐下一步，确保每个前置知识点都掌握牢固
            </p>
          </div>
          <Play className="text-primary-500 group-hover:translate-x-1 transition-transform" size={24} />
        </div>
      </button>

      <div className="space-y-4">
        {categories.map((cat) => {
          const catMastery = cat.chapters.length > 0
            ? cat.chapters.reduce((sum, ch) => sum + (ch.averageMastery ?? 0), 0) / cat.chapters.length
            : 0;
          const catLevel = getLevel(catMastery);
          const lvConfig = LEVEL_CONFIG[catLevel];

          return (
            <div key={cat.category} className="card overflow-hidden">
              <button
                onClick={() => setExpandedCategory(expandedCategory === cat.category ? null : cat.category)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{categoryIcons[cat.category] || '📖'}</span>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900">{cat.category}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${lvConfig.color} text-white font-medium`}>
                        {lvConfig.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {cat.chapters.length} 个章节 · {categoryDescriptions[cat.category] || ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${lvConfig.barColor} transition-all duration-500`}
                        style={{ width: `${Math.round(catMastery * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-8">{Math.round(catMastery * 100)}%</span>
                  </div>
                  <ChevronRight
                    size={20}
                    className={`text-gray-400 transition-transform ${expandedCategory === cat.category ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>

              {expandedCategory === cat.category && (
                <div className="mt-4 space-y-3 animate-fade-in">
                  {cat.chapters.map((ch) => {
                    const chMastery = ch.averageMastery ?? 0;
                    const chLevel = getLevel(chMastery);
                    const chLvConfig = LEVEL_CONFIG[chLevel];
                    const progress = Math.round(chMastery * 100);

                    return (
                      <div key={ch.chapter} className="border border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 transition-colors">
                        <button
                          onClick={() => setExpandedChapter(expandedChapter === ch.chapter ? null : ch.chapter)}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${chLvConfig.color} ${chMastery === 0 ? 'ring-1 ring-offset-1 ring-gray-200' : ''}`} />
                            <div className="flex-1 text-left min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-gray-900 truncate">{ch.chapter}</h3>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${chLvConfig.color} text-white font-medium shrink-0`}>
                                  {chLvConfig.label}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {ch.knowledgePointCount} 个知识点
                                {(ch.masteredPoints ?? 0) > 0 && ` · 已掌握 ${ch.masteredPoints}/${ch.totalPoints ?? ch.knowledgePointCount}`}
                              </p>
                            </div>

                            <div className="hidden sm:flex items-center gap-2 shrink-0">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${chLvConfig.barColor} transition-all duration-500`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">{progress}%</span>
                            </div>
                          </div>
                          <ChevronRight
                            size={16}
                            className={`text-gray-400 transition-transform ml-2 shrink-0 ${expandedChapter === ch.chapter ? 'rotate-90' : ''}`}
                          />
                        </button>

                        {expandedChapter === ch.chapter && (
                          <div className="px-4 pb-4 space-y-2 animate-fade-in">
                            {ch.knowledgePoints.map((kp) => (
                              <div key={kp.id} className="flex items-center justify-between py-2.5 px-3 border-l-2 border-gray-100 hover:border-primary-200 hover:bg-gray-50/50 rounded-r-lg transition-colors">
                                <div className="min-w-0">
                                  <p className="text-sm text-gray-700 font-medium">{kp.name}</p>
                                  <p className="text-xs text-gray-400 mt-0.5 truncate">{kp.description}</p>
                                </div>
                                <span className="text-xs text-gray-400 shrink-0 ml-2">
                                  {'★'.repeat(kp.difficulty)}{'☆'.repeat(3 - kp.difficulty)}
                                </span>
                              </div>
                            ))}

                            <button
                              onClick={() => startChapter(cat.category, ch.chapter)}
                              className="w-full mt-2 btn-primary flex items-center justify-center gap-2 py-2.5 text-sm"
                            >
                              <Play size={16} />
                              开始学习本章
                            </button>
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