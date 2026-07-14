import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getGameSummary } from '../api/client';

interface SummaryData {
  session_id: number;
  game_id: string;
  game_name: string;
  score: number;
  xp_gained: number;
  coins_gained: number;
  accuracy: number;
  correct_count: number;
  total_questions: number;
  duration: number;
  correct_items: string[];
  wrong_items: string[];
  improvement_items: string[];
  completed_at: string;
}

export default function GameResult() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 从 URL query 读取 gameId（由游戏页跳转时附加）
  const gameId = searchParams.get('gameId') || '';
  // 兼容旧链接的 from 参数；校验 allowlist 避免开放重定向
  const _ALLOWED_RETURN_PATHS = ['/games', '/dashboard', '/'];
  const rawFrom = searchParams.get('from') || '';
  const returnPath = _ALLOWED_RETURN_PATHS.includes(rawFrom) ? rawFrom : '/games';

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId || !gameId) return;

    (async () => {
      try {
        setLoading(true);
        const data = await getGameSummary(gameId, Number(sessionId));
        setSummary(data);
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || '无法加载游戏结果');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, gameId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-gray-500">正在加载结果...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">😵</p>
        <p className="text-red-500 text-lg mb-4">{error}</p>
        <button
          onClick={() => navigate('/games')}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          返回游戏大厅
        </button>
      </div>
    );
  }

  if (!summary) return null;

  const accuracyPercent = Math.round(summary.accuracy * 100);
  const minutes = Math.floor(summary.duration / 60);
  const seconds = summary.duration % 60;
  const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;

  const getAccuracyEmoji = () => {
    if (accuracyPercent >= 100) return '🏆';
    if (accuracyPercent >= 90) return '🌟';
    if (accuracyPercent >= 80) return '👏';
    if (accuracyPercent >= 60) return '💪';
    return '📚';
  };

  const getAccuracyColor = () => {
    if (accuracyPercent >= 90) return 'text-green-600';
    if (accuracyPercent >= 70) return 'text-yellow-600';
    return 'text-red-500';
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* 成绩卡片 */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-6">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">游戏结束</h1>

        {/* 游戏名称 */}
        <p className="text-center text-sm text-gray-400 mb-6">
          {summary.game_name || summary.game_id}
        </p>

        {/* 核心数据 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <p className="text-3xl font-bold text-blue-600">{summary.score}</p>
            <p className="text-xs text-gray-500 mt-1">总得分</p>
            <p className="text-xs text-gray-400">
              +{summary.xp_gained} XP / +{summary.coins_gained} 金币
            </p>
          </div>

          <div className="text-center p-4 bg-green-50 rounded-xl">
            <p className={`text-3xl font-bold ${getAccuracyColor()}`}>
              {accuracyPercent}%
            </p>
            <p className="text-xs text-gray-500 mt-1">正确率</p>
            <p className="text-xs text-gray-400">
              {summary.correct_count} / {summary.total_questions} 题
            </p>
          </div>

          <div className="text-center p-4 bg-purple-50 rounded-xl">
            <p className="text-3xl font-bold text-purple-600">{timeStr}</p>
            <p className="text-xs text-gray-500 mt-1">总用时</p>
          </div>
        </div>

        {/* 正确率大字 */}
        <div className="text-center py-4">
          <span className="text-6xl">{getAccuracyEmoji()}</span>
        </div>
      </div>

      {/* 单词统计 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* 正确单词 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-bold text-green-600 mb-3 flex items-center gap-2">
            <span>✅</span> 正确单词 ({summary.correct_items.length})
          </h3>
          {summary.correct_items.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {summary.correct_items.map((word, i) => (
                <span key={i} className="px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-sm">
                  {word}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">暂无</p>
          )}
        </div>

        {/* 错误单词 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-bold text-red-500 mb-3 flex items-center gap-2">
            <span>❌</span> 错误单词 ({summary.wrong_items.length})
          </h3>
          {summary.wrong_items.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {summary.wrong_items.map((word, i) => (
                <span key={i} className="px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-sm">
                  {word}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">暂无</p>
          )}
        </div>
      </div>

      {/* 需要加强 */}
      {summary.improvement_items.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-4 mb-6">
          <h3 className="font-bold text-orange-500 mb-3 flex items-center gap-2">
            <span>📝</span> 需要加强的单词
          </h3>
          <div className="flex flex-wrap gap-2">
            {summary.improvement_items.map((word, i) => (
              <span key={i} className="px-2.5 py-1 bg-orange-50 text-orange-600 rounded-lg text-sm">
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => navigate(returnPath, { replace: true })}
          className="px-8 py-3 bg-blue-500 text-white rounded-xl font-medium 
                     hover:bg-blue-600 transition-colors shadow-md shadow-blue-200"
        >
          再来一局
        </button>
        <button
          onClick={() => navigate('/games', { replace: true })}
          className="px-8 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium 
                     hover:bg-gray-200 transition-colors"
        >
          返回大厅
        </button>
      </div>
    </div>
  );
}
