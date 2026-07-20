/**
 * P3-E 对标 Duolingo: Hearts 生命值可视化
 * - 显示爱心数量
 * - 失去时变灰
 * - 仅剩 1 颗时闪烁提醒
 */
interface HeartsDisplayProps {
  current: number;
  max: number;
}

export default function HeartsDisplay({ current, max }: HeartsDisplayProps) {
  if (max <= 0) return null;
  const hearts = Array.from({ length: max });
  return (
    <div className="flex items-center gap-1" aria-label={`生命值 ${current} / ${max}`}>
      {hearts.map((_, i) => {
        const alive = i < current;
        const isLast = i === current - 1 && current === 1;
        return (
          <span
            key={i}
            className={`text-xl transition-all duration-300 ${
              alive ? 'opacity-100' : 'opacity-25 grayscale'
            } ${isLast ? 'animate-pulse' : ''}`}
          >
            {alive ? '❤️' : '🤍'}
          </span>
        );
      })}
    </div>
  );
}
