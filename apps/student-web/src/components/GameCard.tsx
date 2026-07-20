import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
  // P1-B 新增: 配置中可能含 learning_goal / core_mechanisms / props 字段
  learning_goal?: string;
  core_mechanisms?: string[];
  props?: string[];
  rewards?: {
    base_xp: number;
    base_coin: number;
    combo_multiplier: number;
  };
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
  easy: 'bg-green-100 text-green-700 border-green-300',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  hard: 'bg-red-100 text-red-700 border-red-300',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

const DIFFICULTY_DESC: Record<string, string> = {
  easy: '入门级 · 适合新手熟悉玩法',
  medium: '标准级 · 平衡挑战与学习',
  hard: '挑战级 · 考验词汇量与反应',
};

const DIFFICULTY_EMOJI: Record<string, string> = {
  easy: '🌱',
  medium: '⚡',
  hard: '🔥',
};

const PROP_ICONS: Record<string, string> = {
  hint: '💡',
  skip: '⏭️',
  freeze_time: '❄️',
  bomb: '💣',
  shuffle: '🔀',
  replay: '🔁',
  reveal: '👁️',
  revive: '❤️',
};

interface GameCardProps {
  game: Game;
}

function getGameRoute(game: Game): string {
  switch (game.category) {
    case 'math':
      return `/math-game/${game.game_id}`;
    case 'cross_subject':
      return `/cross-game/${game.game_id}`;
    default:
      return `/game/${game.game_id}`;
  }
}

/**
 * P1-B 改进 (2026-07-20): GameCard 点击后弹出难度选择弹框
 * - 显示游戏详情(learning_goal, core_mechanisms, rewards, props)
 * - 让玩家选择难度后跳转
 * - 单难度游戏直接跳转
 */
export default function GameCard({ game }: GameCardProps) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  function handleClick() {
    // 单难度直接跳转
    if (game.difficulty_levels.length <= 1) {
      navigate(getGameRoute(game));
      return;
    }
    // 多难度弹出选择框
    setShowModal(true);
  }

  function handleSelectDifficulty(level: string) {
    setShowModal(false);
    // 通过 state 传递难度,游戏页 useLocation 读取
    navigate(`${getGameRoute(game)}?difficulty=${level}`);
  }

  return (
    <>
      <div
        className="game-card bg-white rounded-xl shadow-md overflow-hidden cursor-pointer border border-gray-100
                   hover:shadow-lg hover:-translate-y-0.5 transition-all"
        onClick={handleClick}
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
            {game.rewards && (
              <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
                ⭐ {game.rewards.base_xp} XP
              </span>
            )}
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
                {DIFFICULTY_LABELS[level] || level}
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

          {/* 道具提示 P1-B */}
          {game.props && game.props.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs text-gray-400">道具:</span>
              {game.props.slice(0, 4).map((prop) => (
                <span key={prop} className="text-base" title={prop}>
                  {PROP_ICONS[prop] || '🎁'}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* P1-B: 难度选择弹框 */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹框头部 */}
            <div className={`p-5 text-white ${
              game.category === 'vocabulary' ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
              game.category === 'math' ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
              'bg-gradient-to-r from-purple-500 to-purple-600'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{CATEGORY_ICONS[game.category]}</span>
                  <div>
                    <h3 className="text-xl font-bold">{game.name}</h3>
                    <p className="text-xs opacity-90">{game.name_en}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white/80 hover:text-white text-2xl leading-none"
                  aria-label="关闭"
                >
                  ×
                </button>
              </div>
            </div>

            {/* 弹框内容 */}
            <div className="p-5">
              {/* 学习目标 */}
              {game.learning_goal && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs font-medium text-blue-600 mb-1">🎯 学习目标</p>
                  <p className="text-sm text-gray-700">{game.learning_goal}</p>
                </div>
              )}

              {/* 核心机制 */}
              {game.core_mechanisms && game.core_mechanisms.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-600 mb-2">⚙️ 玩法机制</p>
                  <div className="flex flex-wrap gap-1.5">
                    {game.core_mechanisms.map((m) => (
                      <span key={m} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 奖励 */}
              {game.rewards && (
                <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-yellow-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">基础XP</p>
                    <p className="text-lg font-bold text-yellow-600">+{game.rewards.base_xp}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">金币</p>
                    <p className="text-lg font-bold text-orange-600">+{game.rewards.base_coin}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">连击倍率</p>
                    <p className="text-lg font-bold text-red-600">{game.rewards.combo_multiplier}x</p>
                  </div>
                </div>
              )}

              {/* 难度选择 */}
              <p className="text-sm font-medium text-gray-700 mb-2">选择难度开始挑战:</p>
              <div className="space-y-2">
                {game.difficulty_levels.map((level) => (
                  <button
                    key={level}
                    onClick={() => handleSelectDifficulty(level)}
                    className={`w-full px-4 py-3 rounded-lg border-2 transition-all text-left
                      hover:scale-[1.02] ${DIFFICULTY_COLORS[level] || 'border-gray-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{DIFFICULTY_EMOJI[level]}</span>
                        <div>
                          <p className="font-bold text-gray-800">{DIFFICULTY_LABELS[level] || level}</p>
                          <p className="text-xs text-gray-500">{DIFFICULTY_DESC[level]}</p>
                        </div>
                      </div>
                      <span className="text-gray-400 text-xl">→</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* 道具提示 */}
              {game.props && game.props.length > 0 && (
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                  <span>可用道具:</span>
                  {game.props.map((prop) => (
                    <span key={prop} className="text-base" title={prop}>
                      {PROP_ICONS[prop] || '🎁'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
