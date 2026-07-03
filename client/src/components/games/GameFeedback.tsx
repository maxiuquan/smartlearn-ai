import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

const CONFETTI_COLORS = ['#FF6B9D', '#FFD93D', '#6BCB77', '#4D96FF', '#A259FF', '#FF8C42'];

interface ConfettiParticle {
  id: number;
  color: string;
  left: number;
  delay: number;
  size: number;
  rotation: number;
}

export function ConfettiEffect({ show, onComplete }: { show: boolean; onComplete: () => void }) {
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);

  useEffect(() => {
    if (show) {
      const items: ConfettiParticle[] = Array.from({ length: 60 }, (_, i) => ({
        id: i,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        left: Math.random() * 100,
        delay: Math.random() * 2,
        size: 6 + Math.random() * 10,
        rotation: Math.random() * 720 - 360,
      }));
      setParticles(items);
      const timer = setTimeout(() => {
        setParticles([]);
        onComplete();
      }, 3500);
      return () => clearTimeout(timer);
    } else {
      setParticles([]);
    }
  }, [show, onComplete]);

  if (!show || particles.length === 0) return null;

  return (
    <div className='fixed inset-0 pointer-events-none z-50 overflow-hidden'>
      {particles.map((p) => (
        <div
          key={p.id}
          className='absolute rounded-sm'
          style={{
            left: `${p.left}%`,
            top: '-20px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
            animation: `confetti-fall ${2 + Math.random() * 2}s linear ${p.delay}s forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export function XPAnimation({ amount, trigger }: { amount: number; trigger: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger > 0) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  if (!visible) return null;

  return (
    <div
      className='fixed top-20 right-8 z-50 pointer-events-none'
      style={{ animation: 'xp-fly 1.5s ease-out forwards' }}
    >
      <span className='text-xl font-bold text-yellow-500 drop-shadow-md'>
        +{amount} XP
      </span>
      <style>{`
        @keyframes xp-fly {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          30% { transform: translateY(-20px) scale(1.2); opacity: 1; }
          100% { transform: translateY(-60px) scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export function AchievementPopup({
  achievement,
  onDismiss,
}: {
  achievement: { id: string; icon: string; name: string; description: string } | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (achievement) {
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [achievement, onDismiss]);

  if (!achievement) return null;

  return (
    <div className='fixed bottom-4 right-4 z-50 animate-slide-up'>
      <div className='bg-white rounded-2xl shadow-xl border border-yellow-200 p-4 flex items-center gap-3 max-w-xs relative'>
        <button
          onClick={onDismiss}
          className='absolute -top-2 -right-2 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors'
        >
          <X size={14} className='text-gray-500' />
        </button>
        <div className='w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl flex-shrink-0'>
          {achievement.icon}
        </div>
        <div>
          <p className='text-xs text-yellow-600 font-medium'>成就解锁！</p>
          <p className='text-sm font-bold text-gray-900'>{achievement.name}</p>
          <p className='text-xs text-gray-500'>{achievement.description}</p>
        </div>
      </div>
    </div>
  );
}

export function LevelUpModal({
  level,
  levelName,
  onClose,
}: {
  level: number;
  levelName: string;
  onClose: () => void;
}) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div
        className='bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl'
        style={{ animation: 'level-up-scale 0.5s ease-out forwards' }}
      >
        <div className='relative'>
          <div className='absolute inset-0 flex items-center justify-center'>
            <span className='text-6xl'>🎉</span>
          </div>
        </div>
        <div className='w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400 flex items-center justify-center shadow-lg'>
          <span className='text-5xl font-bold text-white drop-shadow-lg'>{level}</span>
        </div>
        <h2 className='text-2xl font-bold text-gray-900 mb-1'>等级提升！</h2>
        <p className='text-lg text-orange-600 font-semibold mb-1'>{levelName}</p>
        <p className='text-sm text-gray-500 mb-6'>恭喜你达到了新的等级！继续加油！</p>
        <div className='flex justify-center gap-2 mb-4'>
          <span className='text-3xl'>🎆</span>
          <span className='text-3xl'>✨</span>
          <span className='text-3xl'>🎇</span>
        </div>
        <button
          onClick={onClose}
          className='w-full py-3 bg-gradient-to-r from-orange-400 to-red-400 text-white font-bold rounded-xl hover:from-orange-500 hover:to-red-500 transition-all active:scale-[0.98]'
        >
          继续
        </button>
      </div>
      <style>{`
        @keyframes level-up-scale {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export function GameFeedback() {
  return null;
}

export function ComboDisplay({ combo }: { combo: number }) {
  if (combo < 5) return null;

  const fontSize = combo >= 20 ? 'text-5xl' : combo >= 15 ? 'text-4xl' : combo >= 10 ? 'text-3xl' : 'text-2xl';

  return (
    <div className='fixed inset-0 pointer-events-none z-40 flex items-center justify-center'>
      <div
        className={`${fontSize} font-bold text-orange-500 drop-shadow-lg`}
        style={{ animation: 'combo-pulse 0.6s ease-in-out infinite' }}
      >
        🔥 连击 x{combo}
      </div>
      <style>{`
        @keyframes combo-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  );
}