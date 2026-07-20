import type { Quest } from '../hooks/useDailyQuests';

/**
 * P3-B 对标 Duolingo: 每日任务面板
 * - 显示 3 个任务进度
 * - 完成可点击领取金币奖励
 */
interface DailyQuestsPanelProps {
  quests: Quest[];
  onClaim: (questId: string) => void;
}

export default function DailyQuestsPanel({ quests, onClaim }: DailyQuestsPanelProps) {
  if (quests.length === 0) return null;

  const completedCount = quests.filter((q) => q.completed).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
          📅 今日任务
        </h2>
        <span className="text-xs text-gray-400">
          {completedCount}/{quests.length} 完成 · 每 0 点刷新
        </span>
      </div>
      <div className="space-y-3">
        {quests.map((q) => {
          const percent = Math.min(100, Math.round((q.progress / q.target) * 100));
          return (
            <div key={q.id} className="flex items-center gap-3">
              <span className="text-2xl flex-shrink-0">{q.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {q.title}
                  </span>
                  <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                    {q.progress}/{q.target}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      q.completed ? 'bg-green-500' : 'bg-blue-400'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
              <div className="flex-shrink-0">
                {q.claimed ? (
                  <span className="text-xs text-gray-400 px-2 py-1">已领取</span>
                ) : q.completed ? (
                  <button
                    onClick={() => onClaim(q.id)}
                    className="px-3 py-1.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-lg hover:bg-yellow-500 transition-colors animate-pulse whitespace-nowrap"
                  >
                    🎁 领 +{q.reward}
                  </button>
                ) : (
                  <span className="text-xs text-gray-400 px-2 py-1 whitespace-nowrap">
                    +{q.reward} 金币
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
