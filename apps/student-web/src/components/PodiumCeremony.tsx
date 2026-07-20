/**
 * P3-C 对标 Kahoot: Podium 领奖台仪式
 * - 根据正确率显示 1/2/3 名领奖台
 * - 配合烟花粒子动效
 * - 低于 50% 显示鼓励文案
 */
interface PodiumCeremonyProps {
  accuracy: number; // 0-1
  maxCombo: number;
}

export default function PodiumCeremony({ accuracy, maxCombo }: PodiumCeremonyProps) {
  // 根据正确率决定"领奖台等级"
  const tier: 0 | 1 | 2 | 3 =
    accuracy >= 0.9 ? 1 : accuracy >= 0.7 ? 2 : accuracy >= 0.5 ? 3 : 0;

  if (tier === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-7xl mb-3 animate-bounce">💪</div>
        <p className="text-xl font-bold text-gray-700">继续努力！</p>
        <p className="text-sm text-gray-500 mt-1">
          下次一定能站上领奖台
        </p>
      </div>
    );
  }

  const tierConfig = {
    1: { emoji: '🏆', label: '冠军', color: 'from-yellow-400 to-yellow-600' },
    2: { emoji: '🥈', label: '亚军', color: 'from-gray-300 to-gray-500' },
    3: { emoji: '🥉', label: '季军', color: 'from-orange-400 to-orange-600' },
  } as const;

  const cfg = tierConfig[tier];

  return (
    <div className="text-center py-6">
      <div className="relative inline-block">
        {/* 领奖台三层 */}
        <div className="flex items-end justify-center gap-2 mb-4">
          {/* 第二名台 */}
          <div className={`flex flex-col items-center ${tier === 2 ? '' : 'opacity-60'}`}>
            <div className="text-4xl mb-1">🥈</div>
            <div
              className={`bg-gradient-to-b from-gray-300 to-gray-500 w-16 rounded-t-lg flex items-center justify-center text-white font-bold text-sm ${
                tier === 2 ? 'h-24' : 'h-16'
              }`}
            >
              2
            </div>
          </div>
          {/* 第一名台 */}
          <div className={`flex flex-col items-center ${tier === 1 ? '' : 'opacity-60'}`}>
            <div className="text-5xl mb-1 animate-bounce">🏆</div>
            <div
              className={`bg-gradient-to-b ${cfg.color} w-20 rounded-t-lg flex items-center justify-center text-white font-bold ${
                tier === 1 ? 'h-32' : 'h-20'
              }`}
            >
              1
            </div>
          </div>
          {/* 第三名台 */}
          <div className={`flex flex-col items-center ${tier === 3 ? '' : 'opacity-60'}`}>
            <div className="text-4xl mb-1">🥉</div>
            <div
              className={`bg-gradient-to-b from-orange-400 to-orange-600 w-16 rounded-t-lg flex items-center justify-center text-white font-bold text-sm ${
                tier === 3 ? 'h-20' : 'h-12'
              }`}
            >
              3
            </div>
          </div>
        </div>
        <p className="text-2xl font-bold text-gray-800">{cfg.label}！</p>
        {maxCombo >= 5 && (
          <p className="text-sm text-orange-500 mt-1">🔥 最高 {maxCombo} 连击</p>
        )}
      </div>

      {/* 烟花粒子效果 */}
      <div className="flex justify-center gap-2 mt-4">
        {['🎉', '🎊', '✨', '🎈', '⭐'].map((e, i) => (
          <span
            key={i}
            className="text-2xl animate-bounce"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            {e}
          </span>
        ))}
      </div>
    </div>
  );
}
