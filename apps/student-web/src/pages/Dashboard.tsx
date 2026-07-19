import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { vocabApi, type VocabProgress } from '../api/vocab';
import { statisticsApi, type OverviewStats } from '../api/statistics';

/** 快捷入口卡片配置 */
const QUICK_LINKS = [
  { path: '/vocab', label: '词汇学习', emoji: '📖', desc: '翻卡背单词', color: 'from-blue-400 to-blue-600' },
  { path: '/practice', label: '题库练习', emoji: '✏️', desc: '分学科刷题', color: 'from-green-400 to-green-600' },
  { path: '/exam', label: '真题模拟', emoji: '📝', desc: '历年真题', color: 'from-orange-400 to-orange-600' },
  { path: '/ai-tutor', label: 'AI 辅导', emoji: '🤖', desc: '智能问答', color: 'from-purple-400 to-purple-600' },
  { path: '/games', label: '游戏大厅', emoji: '🎮', desc: '趣味学习', color: 'from-pink-400 to-pink-600' },
  { path: '/profile', label: '个人中心', emoji: '👤', desc: '学习统计', color: 'from-teal-400 to-teal-600' },
];

/**
 * Dashboard 页面。
 * 学习进度总览 + 快捷功能入口 + 最近学习统计。
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<VocabProgress | null>(null);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [prog, over] = await Promise.allSettled([
        vocabApi.getProgress(),
        statisticsApi.getOverview(),
      ]);

      if (prog.status === 'fulfilled') setProgress(prog.value);
      if (over.status === 'fulfilled') setOverview(over.value);

      // 如果两个都失败才报错
      if (prog.status === 'rejected' && over.status === 'rejected') {
        throw new Error('无法加载学习数据');
      }
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── 加载态 ───
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-gray-500">正在加载...</p>
      </div>
    );
  }

  return (
    <div>
      {/* 欢迎语 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">📊 学习仪表盘</h1>
        <p className="text-gray-500">今日学习概览，继续保持！</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-500">
          {error}
          <button
            onClick={loadData}
            className="ml-3 text-blue-500 hover:underline"
          >
            重试
          </button>
        </div>
      )}

      {/* 学习进度卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {/* 已掌握 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">✅</span>
            <span className="text-xs text-green-500 bg-green-50 px-2 py-0.5 rounded">
              已掌握
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {progress?.mastered ?? '-'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            / {progress?.total_words ?? '-'} 词汇
          </p>
        </div>

        {/* 学习中 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">📚</span>
            <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
              学习中
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {progress?.learning ?? '-'}
          </p>
          <p className="text-xs text-gray-400 mt-1">个词汇</p>
        </div>

        {/* 今日待复习 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">⏰</span>
            <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded">
              待复习
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {progress?.due_today ?? '-'}
          </p>
          <p className="text-xs text-gray-400 mt-1">今日到期</p>
        </div>

        {/* 平均掌握度 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">📈</span>
            <span className="text-xs text-purple-500 bg-purple-50 px-2 py-0.5 rounded">
              掌握度
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {progress?.avg_mastery !== undefined
              ? `${Math.round(progress.avg_mastery * 100)}%`
              : '-'}
          </p>
          <p className="text-xs text-gray-400 mt-1">平均</p>
        </div>
      </div>

      {/* 进度条 */}
      {progress && progress.total_words > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">词汇总进度</span>
            <span className="text-sm text-gray-400">
              {progress.mastered} / {progress.total_words}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-400 to-purple-500 h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round((progress.mastered / progress.total_words) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 快捷入口 */}
      <h2 className="text-lg font-bold text-gray-700 mb-4">🚀 快捷入口</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {QUICK_LINKS.map((link) => (
          <div
            key={link.path}
            onClick={() => navigate(link.path)}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer
              hover:shadow-md hover:border-blue-200 transition-all group"
          >
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${link.color}
                flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform`}
            >
              {link.emoji}
            </div>
            <h3 className="font-bold text-gray-800 mb-1">{link.label}</h3>
            <p className="text-xs text-gray-400">{link.desc}</p>
          </div>
        ))}
      </div>

      {/* 平台统计概览 */}
      {overview && (
        <div>
          <h2 className="text-lg font-bold text-gray-700 mb-4">📈 平台概览</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {overview.total_questions !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {overview.total_questions?.toLocaleString() ?? '-'}
                  </p>
                  <p className="text-xs text-gray-400">题目总数</p>
                </div>
              )}
              {overview.total_vocab !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {overview.total_vocab?.toLocaleString() ?? '-'}
                  </p>
                  <p className="text-xs text-gray-400">词汇总数</p>
                </div>
              )}
              {overview.total_users !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {overview.total_users?.toLocaleString() ?? '-'}
                  </p>
                  <p className="text-xs text-gray-400">注册用户</p>
                </div>
              )}
              {overview.today_active !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {overview.today_active?.toLocaleString() ?? '-'}
                  </p>
                  <p className="text-xs text-gray-400">今日活跃</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
