import { create } from 'zustand';
import { StudyPlan, StudyTask, StudyReport, Achievement } from '../types';

interface StudyStore {
  currentPlan: StudyPlan | null;
  todayTasks: StudyTask[];
  studyReports: StudyReport[];
  achievements: Achievement[];
  totalStudyTime: number;
  streak: number;
  
  // Actions
  setCurrentPlan: (plan: StudyPlan) => void;
  updateTaskProgress: (taskId: string, completed: number) => void;
  completeTask: (taskId: string) => void;
  addStudyTime: (minutes: number) => void;
  unlockAchievement: (achievementId: string) => void;
  getTodayProgress: () => number;
  getWeeklyReport: () => StudyReport[];
}

export const useStudyStore = create<StudyStore>((set, get) => ({
  currentPlan: null,
  todayTasks: [],
  studyReports: [],
  achievements: [],
  totalStudyTime: 0,
  streak: 0,

  setCurrentPlan: (plan: StudyPlan) => {
    set({ currentPlan: plan });
  },

  updateTaskProgress: (taskId: string, completed: number) => {
    const { todayTasks } = get();
    const updatedTasks = todayTasks.map(task => {
      if (task.id === taskId) {
        return { ...task, completedCount: Math.min(completed, task.targetCount) };
      }
      return task;
    });
    set({ todayTasks: updatedTasks });
  },

  completeTask: (taskId: string) => {
    const { todayTasks, achievements } = get();
    const task = todayTasks.find(t => t.id === taskId);
    
    if (task) {
      const updatedTasks = todayTasks.map(t => {
        if (t.id === taskId) {
          return { ...t, completedCount: t.targetCount };
        }
        return t;
      });
      
      // Check for achievements
      const completedCount = updatedTasks.filter(t => t.completedCount >= t.targetCount).length;
      const newAchievements = achievements.map(a => {
        if (a.id === 'daily_tasks' && a.progress < a.target) {
          return { ...a, progress: completedCount };
        }
        return a;
      });
      
      set({ todayTasks: updatedTasks, achievements: newAchievements });
    }
  },

  addStudyTime: (minutes: number) => {
    set(state => ({ totalStudyTime: state.totalStudyTime + minutes }));
  },

  unlockAchievement: (achievementId: string) => {
    const { achievements } = get();
    const updated = achievements.map(a => {
      if (a.id === achievementId && !a.unlockedAt) {
        return { ...a, unlockedAt: new Date().toISOString() };
      }
      return a;
    });
    set({ achievements: updated });
  },

  getTodayProgress: () => {
    const { todayTasks } = get();
    if (todayTasks.length === 0) return 0;
    
    const completed = todayTasks.filter(t => t.completedCount >= t.targetCount).length;
    return (completed / todayTasks.length) * 100;
  },

  getWeeklyReport: () => {
    const { studyReports } = get();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return studyReports.filter(report => 
      new Date(report.date) >= oneWeekAgo
    );
  },
}));
