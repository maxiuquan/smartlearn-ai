import { useState } from 'react';

interface GameToolbarProps {
  /** 该游戏可用的道具列表 */
  props?: string[];
  /** 是否禁用（提交中、加载中） */
  disabled?: boolean;
  /** 提示回调，返回要展示的提示内容 */
  onHint?: () => void;
  /** 跳过回调 */
  onSkip?: () => void;
}

/**
 * P1-C 改进 (2026-07-20): 游戏道具工具栏
 * - 💡 提示：调用 onHint,展示首字母或释义的关键词
 * - ⏭️ 跳过：调用 onSkip,标记当前题为跳过(不计入正确,但不影响 combo)
 * - 道具数量限制：提示 3 次,跳过 1 次
 * - 道具用完后按钮置灰
 *
 * 其他道具（freeze_time / bomb / shuffle）暂未实现交互逻辑,仅做 UI 展示
 */
export default function GameToolbar({ props = [], disabled, onHint, onSkip }: GameToolbarProps) {
  // 默认所有游戏都有 hint + skip
  const availableProps = props.length > 0 ? props : ['hint', 'skip'];
  const hasHint = availableProps.includes('hint');
  const hasSkip = availableProps.includes('skip');

  // 道具使用次数限制
  const [hintUsed, setHintUsed] = useState(0);
  const [skipUsed, setSkipUsed] = useState(0);
  const HINT_LIMIT = 3;
  const SKIP_LIMIT = 1;

  const hintRemaining = HINT_LIMIT - hintUsed;
  const skipRemaining = SKIP_LIMIT - skipUsed;

  function handleHint() {
    if (disabled || hintRemaining <= 0) return;
    setHintUsed((n) => n + 1);
    onHint?.();
  }

  function handleSkip() {
    if (disabled || skipRemaining <= 0) return;
    setSkipUsed((n) => n + 1);
    onSkip?.();
  }

  // 如果没有任何可用道具,不渲染
  if (!hasHint && !hasSkip) return null;

  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-400">道具:</span>

      {/* 💡 提示 */}
      {hasHint && (
        <button
          type="button"
          onClick={handleHint}
          disabled={disabled || hintRemaining <= 0}
          className={`px-3 py-1.5 text-xs rounded-lg border-2 transition-all flex items-center gap-1
            ${hintRemaining > 0 && !disabled
              ? 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 hover:scale-105'
              : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            }`}
          title={`提示 (剩余 ${hintRemaining}/${HINT_LIMIT})`}
        >
          <span className="text-base">💡</span>
          <span>提示</span>
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-600 text-[10px]">
            {hintRemaining}
          </span>
        </button>
      )}

      {/* ⏭️ 跳过 */}
      {hasSkip && (
        <button
          type="button"
          onClick={handleSkip}
          disabled={disabled || skipRemaining <= 0}
          className={`px-3 py-1.5 text-xs rounded-lg border-2 transition-all flex items-center gap-1
            ${skipRemaining > 0 && !disabled
              ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:scale-105'
              : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            }`}
          title={`跳过 (剩余 ${skipRemaining}/${SKIP_LIMIT})`}
        >
          <span className="text-base">⏭️</span>
          <span>跳过</span>
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[10px]">
            {skipRemaining}
          </span>
        </button>
      )}

      {/* 其他道具(仅展示,未实现交互) */}
      {availableProps
        .filter((p) => !['hint', 'skip'].includes(p))
        .map((prop) => {
          const icons: Record<string, string> = {
            freeze_time: '❄️',
            bomb: '💣',
            shuffle: '🔀',
            replay: '🔁',
            reveal: '👁️',
            revive: '❤️',
          };
          return (
            <span
              key={prop}
              className="px-3 py-1.5 text-xs rounded-lg border-2 border-gray-200 bg-gray-50 text-gray-400
                         flex items-center gap-1 cursor-not-allowed"
              title={`${prop} (敬请期待)`}
            >
              <span className="text-base">{icons[prop] || '🎁'}</span>
              <span>敬请期待</span>
            </span>
          );
        })}
    </div>
  );
}
