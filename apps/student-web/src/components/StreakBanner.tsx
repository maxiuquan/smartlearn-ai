/**
 * P3-A 对标 Duolingo: 顶部连胜火焰条
 * - 显示当前连胜天数
 * - 显示可用冻结数
 * - 0 天连胜时不渲染
 */
interface StreakBannerProps {
  current: number;
  longest: number;
  freezes: number;
}

export default function StreakBanner({ current, longest, freezes }: StreakBannerProps) {
  if (current === 0) return null;
  return (
    <div className="bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 text-white py-1.5 px-4 text-sm flex items-center justify-center gap-3 shadow-sm">
      <span className="text-lg animate-pulse">🔥</span>
      <span className="font-bold">{current} 天连胜</span>
      {current >= 3 && (
        <span className="text-orange-100 text-xs hidden sm:inline">
          最长 {longest} 天
        </span>
      )}
      {freezes > 0 && (
        <span className="text-orange-100 text-xs flex items-center gap-1">
          <span>🧊</span>
          <span>x{freezes}</span>
        </span>
      )}
    </div>
  );
}
