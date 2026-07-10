import client from './client';

/** 题目条目 */
export interface QuestionItem {
  id: string;
  subject: string;
  type: string;
  difficulty: string;
  title: string;
  /** 真正的题目正文/题干（后端 content 字段） */
  content?: string;
  options?: string[] | Record<string, string>;
  answer?: string;
  /** 后端字段为 solution，前端兼容用 analysis */
  analysis?: string;
  solution?: string;
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
  /** 真正的题目正文/题干（后端 content 字段） */
  content?: string;
  options: string[] | Record<string, string>;
  answer: string;
  /** 后端字段为 solution，前端兼容用 analysis */
  analysis?: string;
  solution?: string;
  knowledge_points: string[];
}

/** 答题结果（对齐后端 QuestionAttemptResponse） */
export interface AttemptResult {
  correct: boolean;
  correct_answer: string | null;
  /** 后端字段名为 solution，非 analysis */
  solution: string | null;
  xp_gained?: number;
}

/** 获取题目列表参数 */
export interface GetQuestionsParams {
  subject?: string;
  type?: string;
  difficulty?: string;
  category?: string;
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
   * 后端返回 solution 字段，前端兼容映射到 analysis
   */
  async getQuestions(params: GetQuestionsParams = {}): Promise<QuestionListResponse> {
    const res = await client.get('/api/v1/questions', {
      params: {
        subject: params.subject,
        type: params.type,
        difficulty: params.difficulty,
        category: params.category,
        kp_id: params.kp_id,
        page: params.page || 1,
      },
    });
    // 字段映射：solution → analysis（前端页面用 analysis）
    const data = res.data;
    if (data && Array.isArray(data.items)) {
      data.items.forEach((item: QuestionItem) => {
        if (item.solution !== undefined && item.analysis === undefined) {
          item.analysis = item.solution;
        }
      });
    }
    return data;
  },

  /**
   * 获取题目详情
   * GET /api/v1/questions/{id}
   * 后端返回 solution 字段，前端兼容映射到 analysis
   */
  async getQuestionDetail(id: string): Promise<QuestionDetail> {
    const res = await client.get(`/api/v1/questions/${id}`);
    const data = res.data;
    if (data && data.solution !== undefined && data.analysis === undefined) {
      data.analysis = data.solution;
    }
    return data;
  },

  /**
   * 提交答题（判分）
   * POST /api/v1/questions/{id}/attempt
   *
   * 后端 QuestionAttemptRequest 要求字段 duration_ms（毫秒），且禁止多余字段。
   */
  async submitAttempt(
    id: string,
    userAnswer: string,
    timeSpent: number
  ): Promise<AttemptResult> {
    const res = await client.post(`/api/v1/questions/${id}/attempt`, {
      user_answer: userAnswer,
      duration_ms: timeSpent,
    });
    return res.data;
  },
};
