import { useEffect, useState } from 'react';
import { Award, X, Sparkles, Trophy, Star } from 'lucide-react';

interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  story?: string;
}

interface AchievementCelebrationProps {
  achievement: Achievement;
  onClose: () => void;
}

export default function AchievementCelebration({ achievement, onClose }: AchievementCelebrationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const defaultStory = `你${achievement.description}——太厉害了！继续保持！`;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? 'bg-black/60 opacity-100' : 'bg-black/0 opacity-0'
      }`}
      onClick={handleDismiss}
    >
      <div
        className={`relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center transition-all duration-500 ${
          visible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
        style={{
          animation: visible ? 'achievement-pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes achievement-pop-in {
            0% { transform: scale(0.5); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          @keyframes sparkle {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
          }
        `}</style>

        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X size={20} className="text-gray-400" />
        </button>

        <div className="relative mb-4">
          <Sparkles className="absolute -top-2 left-1/4 text-yellow-400" size={20} style={{ animation: 'sparkle 2s ease-in-out infinite' }} />
          <Star className="absolute top-0 right-1/4 text-yellow-500" size={16} style={{ animation: 'sparkle 2s ease-in-out 0.5s infinite' }} />
        </div>

        <div className="text-6xl mb-4" style={{ animation: 'float 3s ease-in-out infinite' }}>
          {achievement.icon}
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy size={24} className="text-yellow-500" />
          <Award size={24} className="text-amber-500" />
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {achievement.name}
        </h2>

        <p className="text-gray-500 text-sm mb-4">{achievement.description}</p>

        <div className="bg-amber-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-800 leading-relaxed">
            {achievement.story || defaultStory}
          </p>
        </div>

        <button
          onClick={handleDismiss}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-yellow-600 transition-all shadow-lg shadow-amber-200"
        >
          太棒了！
        </button>
      </div>
    </div>
  );
}