import {
  POWER_UP_ICONS,
  POWER_UP_LABELS,
  type PowerUpType,
  type PowerUpsState,
} from '../hooks/useGameSession';

interface GameToolbarProps {
  /** 该游戏可用的道具列表(从 games-config.json 读取) */
  availableProps?: string[];
  /** 各道具剩余次数(useGameSession.powerUps) */
  powerUps: PowerUpsState;
  /** 是否禁用(提交中/加载中) */
  disabled?: boolean;
  /** 使用道具回调,由 useGameSession.applyPowerUp 处理 */
  onApplyPowerUp: (type: PowerUpType, payload?: Record<string, unknown>) => void;
}

/**
 * P1-1 改进 (2026-07-21): 完整道具工具栏
 * 对标 Quizizz Power-ups — 8 种道具全部可点击:
 *   💡 hint        提示(展示首字母/释义关键词) — QuestionCard 监听 powerUpEffect 渲染
 *   ⏭️ skip        跳过本题(必错,不影响 combo) — useGameSession 内部调用 skipCurrentQuestion
 *   ❄️ freeze_time 冻结倒计时 5 秒 — useGameSession 内部 setFreezeTimeSec(5)
 *   💣 bomb        消除 1 个干扰选项 — QuestionCard 监听 powerUpEffect 渲染
 *   🔀 shuffle     重新打乱选项/卡片 — QuestionCard 监听 powerUpEffect 渲染
 *   🔁 replay      重新播放发音 — QuestionCard 监听 powerUpEffect 触发 speak()
 *   👁️ reveal      揭示答案首字母 — QuestionCard 监听 powerUpEffect 渲染
 *   ❤️ revive      复活(恢复 1 条命) — useGameSession 内部 setLives(prev+1)
 *
 * 道具次数由 useGameSession.powerUps 统一管理。用完后按钮置灰。
 * availableProps 决定该游戏开放哪些道具。
 */
export default function GameToolbar({
  availableProps = ['hint', 'skip'],
  powerUps,
  disabled,
  onApplyPowerUp,
}: GameToolbarProps) {
  if (availableProps.length === 0) return null;

  // 颜色主题(每个道具有自己的边框/背景色)
  const colorThemes: Record<PowerUpType, string> = {
    hint: 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
    skip: 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100',
    freeze_time: 'border-cyan-300 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
    bomb: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100',
    shuffle: 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100',
    replay: 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100',
    reveal: 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    revive: 'border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100',
  };
  const disabledTheme = 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed';

  function handleClick(type: PowerUpType) {
    if (disabled) return;
    if (powerUps[type] <= 0) return;
    onApplyPowerUp(type);
  }

  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-400">道具:</span>

      {availableProps.map((prop) => {
        const type = prop as PowerUpType;
        const icon = POWER_UP_ICONS[type] || '🎁';
        const label = POWER_UP_LABELS[type] || prop;
        const remaining = powerUps[type] ?? 0;
        const isAvailable = remaining > 0 && !disabled;

        return (
          <button
            key={prop}
            type="button"
            onClick={() => handleClick(type)}
            disabled={!isAvailable}
            className={`px-3 py-1.5 text-xs rounded-lg border-2 transition-all flex items-center gap-1
              ${isAvailable ? `${colorThemes[type]} hover:scale-105` : disabledTheme}`}
            title={`${label} (剩余 ${remaining})`}
          >
            <span className="text-base">{icon}</span>
            <span>{label}</span>
            <span
              className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                remaining > 0 ? 'bg-white/70' : 'bg-gray-100'
              }`}
            >
              {remaining}
            </span>
          </button>
        );
      })}
    </div>
  );
}
