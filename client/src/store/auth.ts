import { create } from 'zustand';

interface UserInfo {
  id: number;
  username: string;
  email: string;
  createdAt?: string;
  examType?: string | null;
  targetExam?: string | null;
}

interface AuthState {
  userId: number | null;
  username: string | null;
  examType: string | null;
  user: UserInfo | null;
  isLoggedIn: boolean;
  login: (user: UserInfo) => void;
  logout: () => void;
  setExamType: (examType: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: Number(localStorage.getItem('userId')) || null,
  username: localStorage.getItem('username') || null,
  examType: localStorage.getItem('examType') || null,
  user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
  isLoggedIn: !!localStorage.getItem('userId'),
  login: (user) => {
    localStorage.setItem('userId', String(user.id));
    localStorage.setItem('username', user.username);
    localStorage.setItem('user', JSON.stringify(user));
    const examType = user.examType || user.targetExam || null;
    if (examType) {
      localStorage.setItem('examType', examType);
    }
    set({ userId: user.id, username: user.username, user, isLoggedIn: true, examType });
  },
  logout: () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('user');
    localStorage.removeItem('examType');
    set({ userId: null, username: null, user: null, isLoggedIn: false, examType: null });
  },
  setExamType: (examType) => {
    localStorage.setItem('examType', examType);
    set({ examType });
  },
}));