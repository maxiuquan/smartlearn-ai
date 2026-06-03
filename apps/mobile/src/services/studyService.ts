import { apiClient } from './apiClient';
import { StudyPlan, StudyReport, Achievement, Workbook, PastExam } from '../types';

class StudyService {
  async getCurrentPlan(): Promise<StudyPlan> {
    const response = await apiClient.get<StudyPlan>('/study/plan');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get study plan');
    }
    return response.data;
  }

  async getTodayTasks(): Promise<StudyPlan['dailyGoal'][0]['tasks']> {
    const response = await apiClient.get('/study/today');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get today tasks');
    }
    return response.data;
  }

  async getStudyReports(startDate: string, endDate: string): Promise<StudyReport[]> {
    const response = await apiClient.get<StudyReport[]>('/study/reports', {
      startDate,
      endDate,
    });
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get study reports');
    }
    return response.data;
  }

  async getAchievements(): Promise<Achievement[]> {
    const response = await apiClient.get<Achievement[]>('/study/achievements');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get achievements');
    }
    return response.data;
  }

  async getWorkbooks(): Promise<Workbook[]> {
    const response = await apiClient.get<Workbook[]>('/workbooks');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get workbooks');
    }
    return response.data;
  }

  async getPastExams(): Promise<PastExam[]> {
    const response = await apiClient.get<PastExam[]>('/past-exams');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get past exams');
    }
    return response.data;
  }

  async recordStudyTime(minutes: number): Promise<void> {
    const response = await apiClient.post('/study/time', { minutes });
    if (!response.success) {
      throw new Error(response.error || 'Failed to record study time');
    }
  }

  async updatePlan(plan: Partial<StudyPlan>): Promise<StudyPlan> {
    const response = await apiClient.put<StudyPlan>('/study/plan', plan);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update plan');
    }
    return response.data;
  }
}

export const studyService = new StudyService();
