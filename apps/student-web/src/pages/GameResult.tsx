import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getGameSummary } from '../api/client';
import PodiumCeremony from '../components/PodiumCeremony';
import LeaderboardPanel from '../components/LeaderboardPanel';

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
  // 兼容后端可能返回的扩展字段
  max_combo?: number;
  user_best_score?: number;
}

const BEST_SCORE_PREFIX = 'smartlearn_best_score_';

function loadBestScore(gameId: string): number {
  try {
    const raw = localStorage.getItem(`${BEST_SCORE_PREFIX}${gameId}`);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(gameId: string, score: number) {
  try {
    localStorage.setItem(`${BEST_SCORE_PREFIX}${gameId}`, String(score));
  } catch {
    // 忽略
  }
}

export default function GameResult() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const gameId = searchParams.get('gameId') || '';
  // P3-C: 从 URL 读取 maxCombo(游戏页跳转时附加)
  const urlMaxCombo = Number(searchParams.get('maxCombo') || '0');
  // 兼容旧链接
  const _ALLOWED_RETURN_PATHS = ['/games', '/dashboard', '/'];
  const rawFrom = searchParams.get('from') || '';
  const returnPath = _ALLOWED_RETURN_PATHS.includes(rawFrom) ? rawFrom : '/games';

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // P3-C: 排行榜弹窗
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  // P2-B: 个人最佳成绩
  const [bestScore, setBestScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);

  useEffect(() => {
    if (!sessionId || !gameId) return;

    (async () => {
      try {
        setLoading(true);
        const data = await getGameSummary(gameId, Number(sessionId));
        setSummary(data);
        // P2-B: 更新本地最佳成绩
        const prevBest = loadBestScore(gameId);
        const serverBest =
          typeof data.user_best_score === 'number' ? data.user_best_score : 0;
        const historicalBest = Math.max(prevBest, serverBest);
        if (data.score > historicalBest) {
          setIsNewRecord(true);
          saveBestScore(gameId, data.score);
          setBestScore(data.score);
        } else {
          setIsNewRecord(false);
          setBestScore(historicalBest);
        }
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
  const maxCombo = summary.max_combo || urlMaxCombo || 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* P3-C: 成绩卡片 + Podium 仪式 */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-6">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">游戏结束</h1>
        <p className="text-center text-sm text-gray-400 mb-4">
          {summary.game_name || summary.game_id}
        </p>

        {/* P2-B: 个人最佳成绩 */}
        {bestScore > 0 && (
          <div
            className={`mb-4 p-3 rounded-lg text-center text-sm font-medium ${
              isNewRecord
                ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-300 text-orange-600 animate-pulse'
                : 'bg-gray-50 text-gray-600'
            }`}
          >
            {isNewRecord ? (
              <>🎉 新纪录！个人最佳 {bestScore} 分</>
            ) : (
              <>📊 个人最佳:{bestScore} 分</>
            )}
          </div>
        )}

        {/* P3-C: Podium 领奖台动效 */}
        <PodiumCeremony accuracy={summary.accuracy} maxCombo={maxCombo} />

        {/* 核心数据 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <p className="text-3xl font-bold text-blue-600">{summary.score}</p>
            <p className="text-xs text-gray-500 mt-1">总得分</p>
            <p className="text-xs text-gray-400">
              +{summary.xp_gained} XP / +{summary.coins_gained} 金币
            </p>
          </div>

          <div className="text-center p-4 bg-green-50 rounded-xl">
            <p
              className={`text-3xl font-bold ${
                accuracyPercent >= 90
                  ? 'text-green-600'
                  : accuracyPercent >= 70
                  ? 'text-yellow-600'
                  : 'text-red-500'
              }`}
            >
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
            {maxCombo >= 2 && (
              <p className="text-xs text-orange-400">🔥 最高 {maxCombo} 连击</p>
            )}
          </div>
        </div>
      </div>

      {/* 单词统计 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-bold text-green-600 mb-3 flex items-center gap-2">
            <span>✅</span> 正确单词 ({summary.correct_items.length})
          </h3>
          {summary.correct_items.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {summary.correct_items.map((word, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-sm"
                >
                  {word}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">暂无</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-bold text-red-500 mb-3 flex items-center gap-2">
            <span>❌</span> 错误单词 ({summary.wrong_items.length})
          </h3>
          {summary.wrong_items.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {summary.wrong_items.map((word, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-sm"
                >
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
              <span
                key={i}
                className="px-2.5 py-1 bg-orange-50 text-orange-600 rounded-lg text-sm"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* P2-C: 排行榜弹窗 */}
      {showLeaderboard && (
        <div className="mb-6">
          <LeaderboardPanel limit={10} />
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={() => navigate(returnPath, { replace: true })}
          className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium
                     hover:bg-blue-600 transition-colors shadow-md shadow-blue-200"
        >
          再来一局
        </button>
        <button
          onClick={() => navigate('/games', { replace: true })}
          className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium
                     hover:bg-gray-200 transition-colors"
        >
          返回大厅
        </button>
        {/* P2-C: 排行榜入口 */}
        <button
          onClick={() => setShowLeaderboard((v) => !v)}
          className="px-6 py-3 bg-yellow-100 text-yellow-700 rounded-xl font-medium
                     hover:bg-yellow-200 transition-colors"
        >
          {showLeaderboard ? '收起排行榜' : '🏆 查看排行榜'}
        </button>
        <button
          onClick={() => navigate('/leaderboard', { replace: true })}
          className="px-6 py-3 bg-purple-100 text-purple-700 rounded-xl font-medium
                     hover:bg-purple-200 transition-colors"
        >
          完整排行
        </button>
      </div>
    </div>
  );
}
