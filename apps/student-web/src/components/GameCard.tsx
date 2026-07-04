import { useNavigate } from 'react-router-dom';
import { getGameDisplayName } from '../api/client';

interface Game {
  game_id: string;
  name: string;
  name_en: string;
  category: string;
  subjects: string[];
  description: string;
  difficulty_levels: string[];
  session: {
    time_limit_sec: number;
  };
  stage: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  vocabulary: '📖',
  math: '🔢',
  cross_subject: '🎯',
};

const CATEGORY_NAMES: Record<string, string> = {
  vocabulary: '英语单词',
  math: '数学',
  cross_subject: '跨科目',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-red-100 text-red-700',
};

interface GameCardProps {
  game: Game;
}

export default function GameCard({ game }: GameCardProps) {
  const navigate = useNavigate();
  const gameType = getGameDisplayName(game.game_id);

  return (
    <div
      className="game-card bg-white rounded-xl shadow-md overflow-hidden cursor-pointer border border-gray-100"
      onClick={() => navigate(`/game/${game.game_id}`)}
    >
      {/* 顶部色条 */}
      <div className={`h-2 ${
        game.category === 'vocabulary' ? 'bg-blue-500' :
        game.category === 'math' ? 'bg-orange-500' : 'bg-purple-500'
      }`} />

      <div className="p-5">
        {/* 标题行 */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{CATEGORY_ICONS[game.category] || '🎮'}</span>
            <h3 className="font-bold text-lg text-gray-800">{game.name}</h3>
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
            {gameType}
          </span>
        </div>

        {/* 英文名 */}
        <p className="text-xs text-gray-400 mb-2">{game.name_en}</p>

        {/* 描述 */}
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{game.description}</p>

        {/* 标签行 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
            {CATEGORY_NAMES[game.category] || game.category}
          </span>

          {game.difficulty_levels.map((level) => (
            <span
              key={level}
              className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_COLORS[level] || 'bg-gray-100 text-gray-600'}`}
            >
              {level === 'easy' ? '简单' : level === 'medium' ? '中等' : '困难'}
            </span>
          ))}

          {game.session.time_limit_sec > 0 && (
            <span className="text-xs text-gray-400">
              ⏱ {game.session.time_limit_sec}秒
            </span>
          )}

          {game.subjects.map((subject) => (
            <span key={subject} className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
              {subject}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}