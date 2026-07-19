import client from './client';

/** 概览统计 */
export interface OverviewStats {
  total_questions?: number;
  total_vocab?: number;
  total_users?: number;
  today_active?: number;
  [key: string]: unknown;
}

/** 用户学习统计 */
export interface UserStats {
  total_study_days?: number;
  total_questions_answered?: number;
  total_correct?: number;
  accuracy?: number;
  total_study_minutes?: number;
  current_streak?: number;
  vocab_mastered?: number;
  [key: string]: unknown;
}

/**
 * 统计 API 封装层。
 */
export const statisticsApi = {
  /**
   * 获取学生端平台概览统计
   * GET /api/v1/statistics/my-overview
   */
  async getOverview(): Promise<OverviewStats> {
    const res = await client.get('/api/v1/statistics/my-overview');
    return res.data;
  },

  /**
   * 获取当前用户学习统计
   * GET /api/v1/statistics/my-profile
   */
  async getUserStats(): Promise<UserStats> {
    const res = await client.get('/api/v1/statistics/my-profile');
    return res.data;
  },
};
