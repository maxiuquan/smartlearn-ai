import { useState, useEffect } from 'react';
import { getLeaderboard } from '../api/client';

/**
 * P2-C 对标 Duolingo League: 好友排行榜面板
 * - 调用 GET /api/v1/games/leaderboards/friends
 * - 兼容多种返回格式
 * - Top 3 显示金银铜牌
 */
interface LeaderboardEntry {
  user_id: number;
  nickname: string;
  total_xp: number;
  rank?: number;
}

interface LeaderboardPanelProps {
  limit?: number;
}

export default function LeaderboardPanel({ limit = 10 }: LeaderboardPanelProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getLeaderboard(limit);
        if (cancelled) return;
        // 兼容后端返回格式:可能是 {entries:[]} / {leaderboard:[]} / [...]
        const list = data.entries || data.leaderboard || data || [];
        setEntries(Array.isArray(list) ? list : []);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.response?.data?.detail || e?.message || '排行榜加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <p className="text-center text-sm text-gray-400 py-6">加载排行榜...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <p className="text-center text-sm text-red-500 py-6">{error}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-700 mb-3">🏆 好友排行榜</h3>
        <p className="text-center text-sm text-gray-400 py-6">
          还没有好友加入,快去邀请朋友一起学习吧！
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
        🏆 好友排行榜
      </h3>
      <div className="space-y-2">
        {entries.map((entry, i) => {
          const rank = entry.rank || i + 1;
          const rankContent =
            rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
          return (
            <div
              key={entry.user_id || i}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                rank <= 3
                  ? 'bg-gradient-to-r from-yellow-50 to-transparent'
                  : 'hover:bg-gray-50'
              }`}
            >
              <span className="w-8 text-center font-bold text-gray-600">
                {rankContent}
              </span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {entry.nickname?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="flex-1 text-sm font-medium text-gray-700 truncate">
                {entry.nickname || '匿名用户'}
              </span>
              <span className="text-sm font-bold text-blue-600 flex-shrink-0">
                {entry.total_xp || 0} XP
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
