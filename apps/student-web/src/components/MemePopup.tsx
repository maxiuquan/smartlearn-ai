import { useEffect, useState } from 'react';

/**
 * P3-D 对标 Quizizz: Meme 表情包反馈层
 * - 答对/答错/连击弹出 Meme
 * - 1.5s 自动消失
 * - 降低答错挫败感
 */
export interface Meme {
  text: string;
  emoji: string;
  color: string;
}

interface MemePopupProps {
  meme: Meme | null;
  duration?: number;
  onDismiss?: () => void;
}

export default function MemePopup({
  meme,
  duration = 1500,
  onDismiss,
}: MemePopupProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (meme) {
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onDismiss?.(), 200);
      }, duration);
      return () => clearTimeout(t);
    }
  }, [meme, duration, onDismiss]);

  if (!meme) return null;

  return (
    <div
      className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none
        transition-all duration-200 ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
        }`}
    >
      <div
        className={`px-8 py-6 rounded-2xl shadow-2xl border-4 ${meme.color} bg-white min-w-[200px]`}
      >
        <div className="text-6xl text-center mb-2 animate-bounce">{meme.emoji}</div>
        <p className="text-lg font-bold text-center text-gray-800">{meme.text}</p>
      </div>
    </div>
  );
}
