import { Target, CheckCircle } from 'lucide-react';

interface DailyTargetProps {
  questionCount: number;
  target: number;
  compact?: boolean;
}

export default function DailyTarget({ questionCount, target, compact = false }: DailyTargetProps) {
  const safeTarget = target > 0 ? target : 1;
  const percentage = Math.min(Math.round((questionCount / safeTarget) * 100), 100);
  const completed = percentage >= 100;

  const radius = compact ? 28 : 40;
  const strokeWidth = compact ? 5 : 6;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const size = radius * 2;

  if (compact) {
    return (
      <div className="flex items-center gap-2.5">
        <svg width={size} height={size} className="shrink-0">
          <circle
            stroke="currentColor"
            className="text-gray-700"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={completed ? '#22c55e' : '#00FF9C'}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="transition-all duration-700 ease-out"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          />
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dy="0.35em"
            className="text-[10px] font-bold fill-gray-300"
          >
            {completed ? '✓' : `${percentage}%`}
          </text>
        </svg>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 truncate">今日目标</p>
          <p className="text-xs text-gray-300 font-medium">
            {questionCount}/{target}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative">
        <svg width={size} height={size}>
          <circle
            stroke="currentColor"
            className="text-gray-200"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={completed ? '#22c55e' : '#00FF9C'}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="transition-all duration-700 ease-out"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {completed ? (
            <CheckCircle size={22} className="text-green-500" />
          ) : (
            <>
              <span className="text-lg font-bold text-gray-800">{percentage}%</span>
            </>
          )}
        </div>
      </div>
      <div className="mt-2 text-center">
        <div className="flex items-center gap-1.5">
          <Target size={14} className={completed ? 'text-green-500' : 'text-[#00FF9C]'} />
          <span className="text-xs font-medium text-gray-500">今日目标</span>
        </div>
        <p className="text-sm font-semibold text-gray-800 mt-0.5">
          {questionCount}<span className="text-gray-400 font-normal">/ {target} 题</span>
        </p>
        {completed && (
          <p className="text-xs font-medium text-green-600 mt-1">今日完成！</p>
        )}
      </div>
    </div>
  );
}