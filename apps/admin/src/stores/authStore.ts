import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  setCurrentUser: (user: User) => void;
  logout: () => void;
}

// 计算是否为管理员
const computeIsAdmin = (user: User | null): boolean => {
  return user?.role === 'admin' || user?.role === 'super_admin';
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      setAuth: (token, user) =>
        set({
          token,
          user,
          isAuthenticated: true,
          isAdmin: computeIsAdmin(user),
        }),
      setUser: (user) => set({ user, isAdmin: computeIsAdmin(user) }),
      setCurrentUser: (user) => set({ user, isAdmin: computeIsAdmin(user) }),
      logout: () =>
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isAdmin: false,
        }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin,
      }),
    }
  )
);
