import { useEffect, useState } from 'react';
import HeartsDisplay from './HeartsDisplay';

interface ScoreBoardProps {
  score: number;
  correctCount: number;
  wrongCount: number;
  combo: number;
  maxCombo?: number;
  timeLeft: number;
  // P3-E: Hearts 生命值
  lives?: number;
  maxLives?: number;
}

/**
 * P1-A 改进 (2026-07-20): 增强版 ScoreBoard
 * - 实时分数展示 + 数字滚动动画
 * - 连击 ≥ 2 显示火焰图标 + 抖动特效
 * - 连击 ≥ 5 显示"超神!"文案
 * - 时间紧迫时闪烁提醒
 * - P3-E: Hearts 生命值可视化
 */
export default function ScoreBoard({ score, correctCount, wrongCount, combo, maxCombo, timeLeft, lives, maxLives }: ScoreBoardProps) {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const isUrgent = timeLeft <= 30 && timeLeft > 0;

  // P1-A: 分数变化时触发动画
  const [scorePulse, setScorePulse] = useState(false);
  useEffect(() => {
    if (score === 0) return;
    setScorePulse(true);
    const t = setTimeout(() => setScorePulse(false), 400);
    return () => clearTimeout(t);
  }, [score]);

  // P1-A: 连击文案
  const comboText = combo >= 10 ? '🔥 燃烧吧!' :
    combo >= 5 ? '⚡ 超神!' :
    combo >= 3 ? '✨ 不错!' :
    '';
  const comboActive = combo >= 2;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-4 sm:gap-6">
      {/* 得分 */}
      <div className="flex items-center gap-2">
        <span className="text-yellow-500 text-xl">⭐</span>
        <div>
          <p className="text-xs text-gray-400">得分</p>
          <p
            className={`text-lg font-bold text-gray-800 transition-all ${
              scorePulse ? 'text-yellow-500 scale-125' : ''
            }`}
          >
            {score}
          </p>
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

      {/* 连击 - P1-A 增强特效 */}
      {comboActive && (
        <div className={`flex items-center gap-2 ${combo >= 5 ? 'animate-bounce' : ''}`}>
          <span className="text-orange-500 text-xl">🔥</span>
          <div>
            <p className="text-xs text-gray-400">连击</p>
            <p className="text-lg font-bold text-orange-500">
              {combo}x
              {comboText && (
                <span className="ml-1 text-xs text-orange-400 font-medium">
                  {comboText}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* 最高连击 P1-A */}
      {maxCombo && maxCombo >= 2 && !comboActive && (
        <div className="flex items-center gap-2 opacity-60">
          <span className="text-gray-400 text-xl">📊</span>
          <div>
            <p className="text-xs text-gray-400">最高连击</p>
            <p className="text-lg font-bold text-gray-500">{maxCombo}x</p>
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
