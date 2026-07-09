import request, { api, pageApi, PageParams } from './request';
import { DashboardStats, UserStats, PaginatedResponse } from '@/types';

// 后端实际路由（/api/v1 前缀由 baseURL 统一处理）：
//   GET /statistics/overview  统计概览（已对齐，原 /statistics/dashboard）
//   GET /statistics/users      用户分析-趋势+分布（已对齐，原 /statistics/user-analysis）
//   其余统计子接口（活跃趋势/完成趋势/学科分布/掌握分布/排行/单用户明细/导出）后端尚未实现。

// 获取仪表盘统计数据
// 后端返回 snake_case 字段, 此处映射为前端 camelCase
export async function getDashboardStats(): Promise<DashboardStats> {
  const raw = await api.get<any>('/statistics/overview');
  return {
    totalUsers: raw.total_users ?? 0,
    activeUsers: raw.active_users_7d ?? 0,
    totalQuestions: raw.total_questions ?? 0,
    totalKnowledgePoints: raw.total_knowledge_points ?? 0,
    totalWords: raw.total_vocab ?? 0,
    todayLogins: raw.today_logins ?? 0,
    weeklyActiveUsers: raw.active_users_7d ?? 0,
    monthlyActiveUsers: raw.active_users_30d ?? 0,
  };
}

// 获取用户活跃趋势
// TODO: 后端尚未实现此路由（仅有 /statistics/users 返回汇总趋势）
export async function getUserActivityTrend(days: number = 30): Promise<{
  dates: string[];
  activeUsers: number[];
  newUsers: number[];
  logins: number[];
}> {
  return api.get('/statistics/user-activity', { params: { days } });
}

// 获取题目完成趋势
// TODO: 后端尚未实现此路由
export async function getQuestionCompletionTrend(days: number = 30): Promise<{
  dates: string[];
  completed: number[];
  correct: number[];
}> {
  return api.get('/statistics/question-completion', { params: { days } });
}

// 获取学科分布统计
// TODO: 后端尚未实现此路由
export async function getSubjectDistribution(): Promise<{
  subject: string;
  count: number;
  percentage: number;
}[]> {
  return api.get('/statistics/subject-distribution');
}

// 获取知识点掌握分布
// TODO: 后端尚未实现此路由
export async function getKnowledgeMastery(): Promise<{
  level: string;
  count: number;
}[]> {
  return api.get('/statistics/knowledge-mastery');
}

// 获取用户学习排行
// TODO: 后端尚未实现此路由
export async function getUserRanking(type: 'study_time' | 'questions' | 'accuracy', limit: number = 10): Promise<{
  user: { id: string; nickname: string; avatar: string };
  value: number;
}[]> {
  return api.get('/statistics/user-ranking', { params: { type, limit } });
}

// 获取用户分析列表
export async function getUserAnalysis(params: PageParams): Promise<PaginatedResponse<UserStats>> {
  return pageApi.get<UserStats>('/statistics/users', params);
}

// 获取单个用户详细统计
// TODO: 后端尚未实现此路由（后端有 GET /users/{user_id}/stats，路径不同）
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
// TODO: 后端尚未实现此路由
export async function exportStatisticsReport(type: string, params: any): Promise<Blob> {
  const response = await request.get(`/statistics/export/${type}`, {
    params,
    responseType: 'blob',
  });
  return response.data as Blob;
}
