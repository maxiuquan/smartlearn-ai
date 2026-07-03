import { useToastStore } from '../store/toast';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import AchievementCelebration from './AchievementCelebration';

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const iconColorMap = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  const achievementToast = toasts.find((t) => t.type === 'achievement');
  const regularToasts = toasts.filter((t) => t.type !== 'achievement');

  return (
    <>
      {achievementToast && achievementToast.achievement && (
        <AchievementCelebration
          achievement={achievementToast.achievement}
          onClose={() => removeToast(achievementToast.id)}
        />
      )}
      {regularToasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {regularToasts.map((toast) => {
            const Icon = iconMap[toast.type as keyof typeof iconMap];
            if (!Icon) return null;
            return (
              <div
                key={toast.id}
                className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-slide-in ${colorMap[toast.type as keyof typeof colorMap]}`}
              >
                <Icon className={`shrink-0 mt-0.5 ${iconColorMap[toast.type as keyof typeof iconColorMap]}`} size={20} />
                <p className="text-sm flex-1">{toast.message}</p>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}