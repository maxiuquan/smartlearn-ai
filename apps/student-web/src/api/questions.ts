import client from './client';

/** 题目条目 */
export interface QuestionItem {
  id: string;
  subject: string;
  type: string;
  difficulty: string;
  title: string;
  options?: string[] | Record<string, string>;
  answer?: string;
  analysis?: string;
  knowledge_points?: string[];
}

/** 题目列表响应 */
export interface QuestionListResponse {
  items: QuestionItem[];
  total: number;
  page?: number;
  page_size?: number;
}

/** 题目详情 */
export interface QuestionDetail {
  id: string;
  subject: string;
  type: string;
  difficulty: string;
  title: string;
  options: string[] | Record<string, string>;
  answer: string;
  analysis: string;
  knowledge_points: string[];
}

/** 答题结果 */
export interface AttemptResult {
  correct: boolean;
  correct_answer: string;
  analysis: string;
  score?: number;
}

/** 获取题目列表参数 */
export interface GetQuestionsParams {
  subject?: string;
  type?: string;
  difficulty?: string;
  kp_id?: string;
  page?: number;
}

/**
 * 题目 API 封装层。
 */
export const questionsApi = {
  /**
   * 获取题目列表（分页 + 筛选）
   * GET /api/v1/questions
   */
  async getQuestions(params: GetQuestionsParams = {}): Promise<QuestionListResponse> {
    const res = await client.get('/api/v1/questions', {
      params: {
        subject: params.subject,
        type: params.type,
        difficulty: params.difficulty,
        kp_id: params.kp_id,
        page: params.page || 1,
      },
    });
    return res.data;
  },

  /**
   * 获取题目详情
   * GET /api/v1/questions/{id}
   */
  async getQuestionDetail(id: string): Promise<QuestionDetail> {
    const res = await client.get(`/api/v1/questions/${id}`);
    return res.data;
  },

  /**
   * 提交答题（判分）
   * POST /api/v1/questions/{id}/attempt
   */
  async submitAttempt(
    id: string,
    userAnswer: string,
    timeSpent: number
  ): Promise<AttemptResult> {
    const res = await client.post(`/api/v1/questions/${id}/attempt`, {
      user_answer: userAnswer,
      time_spent: timeSpent,
    });
    return res.data;
  },
};
