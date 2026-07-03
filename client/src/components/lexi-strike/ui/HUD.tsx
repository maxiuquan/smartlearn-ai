import React, { useState, useEffect, useRef } from 'react';
import { GameState, GameMode, FeedbackInfo } from '../core/GameLoop';

interface HUDProps {
  state: GameState;
  mode: GameMode;
  isMobile: boolean;
  choices: string[];
  currentWord: string;
  feedback: FeedbackInfo | null;
  onSelect: (key: 'A' | 'B' | 'C') => void;
  onPause: () => void;
}

const BUTTON_COLORS = [
  { bg: 'linear-gradient(135deg, #FF4757, #FF6B81)', shadow: 'rgba(255,71,87,0.5)', label: 'A' },
  { bg: 'linear-gradient(135deg, #0066FF, #3399FF)', shadow: 'rgba(0,102,255,0.5)', label: 'B' },
  { bg: 'linear-gradient(135deg, #00CC7A, #00FF9C)', shadow: 'rgba(0,255,156,0.5)', label: 'C' },
];

const HUD: React.FC<HUDProps> = ({ state, mode, isMobile, choices, currentWord, feedback, onSelect, onPause }) => {
  const [lastFeedback, setLastFeedback] = useState<FeedbackInfo | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (feedback) {
      setLastFeedback(feedback);
      setShowFeedback(true);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => {
        setShowFeedback(false);
      }, 1500);
    }
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, [feedback]);

  const hasChoices = choices.length >= 3;
  const hpRatio = state.hp / state.maxHp;
  const hpColor = hpRatio > 0.5 ? '#00FF9C' : hpRatio > 0.25 ? '#FFD700' : '#FF4757';

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <div className="absolute top-0 left-0 right-0 flex justify-center p-2">
        <div
          className="px-4 py-1 rounded-full text-xs font-bold tracking-wider"
          style={{
            background: mode === 'road' ? 'rgba(0,255,156,0.15)' : 'rgba(255,71,87,0.15)',
            color: mode === 'road' ? '#00FF9C' : '#FF4757',
            fontFamily: 'monospace',
            border: `1px solid ${mode === 'road' ? 'rgba(0,255,156,0.3)' : 'rgba(255,71,87,0.3)'}`,
          }}
        >
          {mode === 'road' ? 'ROAD' : 'ARENA'}
        </div>
      </div>

      {showFeedback && lastFeedback && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
          style={{ animation: 'fadeUp 0.3s ease-out' }}>
          <div className="text-3xl" style={{ color: lastFeedback.correct ? '#00FF9C' : '#FF4757' }}>
            {lastFeedback.correct ? '✓' : '✗'}
          </div>
          <div className="text-sm font-bold px-3 py-1 rounded-lg mt-1" style={{
            color: lastFeedback.correct ? '#00FF9C' : '#FF4757',
            background: lastFeedback.correct ? 'rgba(0,255,156,0.1)' : 'rgba(255,71,87,0.1)',
            fontFamily: 'monospace',
          }}>
            {lastFeedback.word} = {lastFeedback.meaning}
          </div>
        </div>
      )}

      {hasChoices && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 pointer-events-auto">
          {currentWord && (
            <div className="text-center mb-2">
              <div className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'monospace' }}>选择正确释义</div>
              <div className="text-lg font-bold text-white px-2 py-1 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.08)', fontFamily: 'monospace' }}>
                {currentWord}
              </div>
            </div>
          )}
          {choices.map((choice, idx) => (
            <button
              key={idx}
              onTouchStart={(e) => { e.preventDefault(); onSelect(BUTTON_COLORS[idx].label as 'A' | 'B' | 'C'); }}
              onMouseDown={(e) => { e.preventDefault(); onSelect(BUTTON_COLORS[idx].label as 'A' | 'B' | 'C'); }}
              className="w-20 h-28 rounded-2xl flex items-center justify-center text-white font-bold active:scale-95 transition-transform shadow-lg"
              style={{
                background: BUTTON_COLORS[idx].bg,
                fontSize: '28px',
                fontFamily: 'monospace',
                boxShadow: `0 0 20px ${BUTTON_COLORS[idx].shadow}`,
                border: '2px solid rgba(255,255,255,0.2)',
              }}
            >
              <div className="text-center">
                <div className="text-xs opacity-70 mb-1">{BUTTON_COLORS[idx].label}</div>
                <div className="text-sm leading-tight px-1" style={{
                  color: idx === 2 ? '#000' : '#fff',
                }}>{choice}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default HUD;