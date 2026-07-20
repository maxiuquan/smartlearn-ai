import LeaderboardPanel from '../components/LeaderboardPanel';

/**
 * P2-C 对标 Duolingo League: 排行榜独立页
 */
export default function Leaderboard() {
  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">🏆 排行榜</h1>
        <p className="text-gray-500">看看好友的学习进度</p>
      </div>
      <div className="max-w-2xl mx-auto">
        <LeaderboardPanel limit={20} />
      </div>
    </div>
  );
}
