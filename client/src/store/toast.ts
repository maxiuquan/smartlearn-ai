import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'achievement';

export interface AchievementData {
  id: string;
  icon: string;
  name: string;
  description: string;
  story?: string;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  achievement?: AchievementData;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  showAchievement: (achievement: AchievementData) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    const duration = toast.duration ?? 4000;
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  showAchievement: (achievement) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    set((state) => ({
      toasts: [...state.toasts, { id, type: 'achievement', message: achievement.name, achievement }],
    }));
  },
}));

export const toast = {
  success: (message: string) => useToastStore.getState().addToast({ type: 'success', message }),
  error: (message: string) => useToastStore.getState().addToast({ type: 'error', message }),
  warning: (message: string) => useToastStore.getState().addToast({ type: 'warning', message }),
  info: (message: string) => useToastStore.getState().addToast({ type: 'info', message }),
};