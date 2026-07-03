import { api, pageApi, PageParams } from './request';
import { DashboardStats, UserStats, PaginatedResponse } from '@/types';

// 获取仪表盘统计数据
export async function getDashboardStats(): Promise<DashboardStats> {
  return api.get<DashboardStats>('/statistics/dashboard');
}

// 获取用户活跃趋势
export async function getUserActivityTrend(days: number = 30): Promise<{
  dates: string[];
  activeUsers: number[];
  newUsers: number[];
  logins: number[];
}> {
  return api.get('/statistics/user-activity', { params: { days } });
}

// 获取题目完成趋势
export async function getQuestionCompletionTrend(days: number = 30): Promise<{
  dates: string[];
  completed: number[];
  correct: number[];
}> {
  return api.get('/statistics/question-completion', { params: { days } });
}

// 获取学科分布统计
export async function getSubjectDistribution(): Promise<{
  subject: string;
  count: number;
  percentage: number;
}[]> {
  return api.get('/statistics/subject-distribution');
}

// 获取知识点掌握分布
export async function getKnowledgeMastery(): Promise<{
  level: string;
  count: number;
}[]> {
  return api.get('/statistics/knowledge-mastery');
}

// 获取用户学习排行
export async function getUserRanking(type: 'study_time' | 'questions' | 'accuracy', limit: number = 10): Promise<{
  user: { id: string; nickname: string; avatar: string };
  value: number;
}[]> {
  return api.get('/statistics/user-ranking', { params: { type, limit } });
}

// 获取用户分析列表
export async function getUserAnalysis(params: PageParams): Promise<PaginatedResponse<UserStats>> {
  return pageApi.get<UserStats>('/statistics/user-analysis', params);
}

// 获取单个用户详细统计
export async function getUserDetailStats(userId: string): Promise<{
  studyDays: number;
  totalStudyTime: number;
  questionsCompleted: number;
  correctRate: number;
  wordsLearned: number;
  knowledgeProgress: { id: string; name: string; progress: number }[];
  recentActivity: { date: string; duration: number; questions: number }[];
}> {
  return api.get(`/statistics/user/${userId}`);
}

// 导出统计报告
export async function exportStatisticsReport(type: string, params: any): Promise<Blob> {
  const response = await fetch(`/api/statistics/export/${type}?${new URLSearchParams(params)}`);
  return response.blob();
}
