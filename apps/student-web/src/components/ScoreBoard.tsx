interface ScoreBoardProps {
  score: number;
  correctCount: number;
  wrongCount: number;
  combo: number;
  timeLeft: number;
}

export default function ScoreBoard({ score, correctCount, wrongCount, combo, timeLeft }: ScoreBoardProps) {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const isUrgent = timeLeft <= 30;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-4 sm:gap-6">
      {/* 得分 */}
      <div className="flex items-center gap-2">
        <span className="text-yellow-500 text-xl">⭐</span>
        <div>
          <p className="text-xs text-gray-400">得分</p>
          <p className="text-lg font-bold text-gray-800">{score}</p>
        </div>
      </div>

      {/* 正确数 */}
      <div className="flex items-center gap-2">
        <span className="text-green-500 text-xl">✓</span>
        <div>
          <p className="text-xs text-gray-400">正确</p>
          <p className="text-lg font-bold text-green-600">{correctCount}</p>
        </div>
      </div>

      {/* 错误数 */}
      <div className="flex items-center gap-2">
        <span className="text-red-500 text-xl">✗</span>
        <div>
          <p className="text-xs text-gray-400">错误</p>
          <p className="text-lg font-bold text-red-500">{wrongCount}</p>
        </div>
      </div>

      {/* 连击 */}
      {combo > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-orange-500 text-xl">🔥</span>
          <div>
            <p className="text-xs text-gray-400">连击</p>
            <p className="text-lg font-bold text-orange-500">{combo}x</p>
          </div>
        </div>
      )}

      {/* 剩余时间 */}
      <div className="flex items-center gap-2 ml-auto">
        <span className={`text-xl ${isUrgent ? 'animate-pulse' : ''}`}>
          {isUrgent ? '⏰' : '⏱'}
        </span>
        <div>
          <p className="text-xs text-gray-400">剩余时间</p>
          <p className={`text-lg font-bold ${isUrgent ? 'text-red-500' : 'text-gray-700'}`}>
            {timeStr}
          </p>
        </div>
      </div>
    </div>
  );
}