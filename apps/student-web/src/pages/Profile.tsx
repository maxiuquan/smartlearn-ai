import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { statisticsApi, type UserStats } from '../api/statistics';

/**
 * 个人中心页面。
 * 用户信息卡片（调 auth.getMe()）；学习统计（调 statistics.getUserStats()）；退出登录。
 */
export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await statisticsApi.getUserStats();
        setStats(data);
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || '无法加载统计数据');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function handleRefresh() {
    refreshUser();
  }

  // ─── 统计卡片数据 ───
  const statCards = [
    {
      label: '答题总数',
      value: stats?.total_questions_answered ?? '-',
      emoji: '✏️',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: '正确率',
      value: stats?.accuracy !== undefined ? `${Math.round(stats.accuracy * 100)}%` : '-',
      emoji: '🎯',
      color: 'bg-green-50 text-green-600',
    },
    {
      label: '学习天数',
      value: stats?.total_study_days ?? '-',
      emoji: '📅',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: '连续打卡',
      value: stats?.current_streak ? `${stats.current_streak} 天` : '-',
      emoji: '🔥',
      color: 'bg-orange-50 text-orange-600',
    },
    {
      label: '掌握词汇',
      value: stats?.vocab_mastered ?? '-',
      emoji: '📖',
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: '学习时长',
      value: stats?.total_study_minutes ? `${Math.round(stats.total_study_minutes / 60)}h` : '-',
      emoji: '⏱',
      color: 'bg-teal-50 text-teal-600',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">👤 个人中心</h1>

      {/* 用户信息卡片 */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-4">
          {/* 头像 */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
            {user?.nickname?.charAt(0).toUpperCase() ||
              user?.email?.charAt(0).toUpperCase() ||
              'U'}
          </div>

          {/* 用户信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-gray-800">
                {user?.nickname || '同学'}
              </h2>
              {user?.vip_level && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                  {user.vip_level}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-medium">
                {user?.role === 'student' ? '学生' : user?.role || '用户'}
              </span>
              <span className="text-xs text-gray-400">ID: {user?.id}</span>
            </div>
          </div>

          {/* 刷新按钮 */}
          <button
            onClick={handleRefresh}
            className="text-sm text-gray-400 hover:text-blue-500 transition-colors px-3 py-1.5"
            title="刷新用户信息"
          >
            🔄 刷新
          </button>
        </div>
      </div>

      {/* 学习统计 */}
      <div className="mb-6">
        <h3 className="font-bold text-gray-700 mb-4">📊 学习统计</h3>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {statCards.map((card, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center"
              >
                <div className={`w-12 h-12 rounded-full ${card.color} flex items-center justify-center text-xl mx-auto mb-2`}>
                  {card.emoji}
                </div>
                <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                <p className="text-xs text-gray-500 mt-1">{card.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 操作区 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-700 mb-4">⚙️ 账号操作</h3>
        <div className="space-y-3">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 text-left text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>🚪</span>
            <span className="font-medium">退出登录</span>
          </button>
        </div>
      </div>

      {/* 底部信息 */}
      <p className="text-center text-xs text-gray-400 mt-6">
        SmartLearn AI · 学生端 · v1.0
      </p>
    </div>
  );
}
