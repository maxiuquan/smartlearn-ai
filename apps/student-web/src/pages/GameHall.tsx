import { useState, useMemo } from 'react';
import gamesConfig from '@data/games/games-config.json';
import GameCard from '../components/GameCard';

interface Game {
  game_id: string;
  name: string;
  name_en: string;
  category: string;
  subjects: string[];
  description: string;
  difficulty_levels: string[];
  session: { time_limit_sec: number };
  stage: number;
}

const FILTER_OPTIONS = [
  { key: 'all', label: '全部游戏', emoji: '🎮' },
  { key: 'vocabulary', label: '英语单词', emoji: '📖' },
  { key: 'math', label: '数学', emoji: '🔢' },
  { key: 'cross_subject', label: '跨科目', emoji: '🎯' },
];

export default function GameHall() {
  const [filter, setFilter] = useState('all');
  const games: Game[] = (gamesConfig as any).games;

  const filteredGames = useMemo(() => {
    if (filter === 'all') return games;
    return games.filter((g) => g.category === filter);
  }, [filter, games]);

  const categoryCount = useMemo<Record<string, number>>(() => {
    return {
      all: games.length,
      vocabulary: games.filter((g) => g.category === 'vocabulary').length,
      math: games.filter((g) => g.category === 'math').length,
      cross_subject: games.filter((g) => g.category === 'cross_subject').length,
    };
  }, [games]);

  return (
    <div>
      {/* 标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">🎯 游戏大厅</h1>
        <p className="text-gray-500">选择一款游戏，开始趣味学习之旅</p>
      </div>

      {/* 分类筛选 */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`px-5 py-2.5 rounded-full font-medium text-sm transition-all
              ${filter === opt.key
                ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
          >
            {opt.emoji} {opt.label}
            <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs
              ${filter === opt.key ? 'bg-blue-400' : 'bg-gray-100'}`}>
              {categoryCount[opt.key]}
            </span>
          </button>
        ))}
      </div>

      {/* 游戏卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredGames.map((game) => (
          <GameCard key={game.game_id} game={game} />
        ))}
      </div>

      {filteredGames.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">🔍</p>
          <p>该分类下暂无游戏</p>
        </div>
      )}
    </div>
  );
}