import client from './client';

/** 词汇条目 */
export interface VocabWord {
  word_id: string;
  headword: string;
  meaning: string;
  phonetic?: string;
  tags?: string[];
  frequency?: number;
  synonyms?: string[];
  antonyms?: string[];
  examples?: { en: string; zh: string }[];
}

/** 词汇列表响应 */
export interface VocabListResponse {
  items: VocabWord[];
  total: number;
  page: number;
  page_size: number;
}

/** 词汇学习进度 */
export interface VocabProgress {
  total_words: number;
  mastered: number;
  learning: number;
  new_words: number;
  due_today: number;
  avg_mastery?: number;
}

/** 学习事件类型 */
export type WordEvent = 'seen' | 'known' | 'unknown' | 'mastered';

/** 获取词汇列表参数 */
export interface GetWordsParams {
  page?: number;
  page_size?: number;
  tag?: string;
  frequency?: number;
}

/**
 * 词汇 API 封装层。
 */
export const vocabApi = {
  /**
   * 获取词汇列表（分页）
   * GET /api/v1/vocab/words
   */
  async getWords(params: GetWordsParams = {}): Promise<VocabListResponse> {
    const res = await client.get('/api/v1/vocab/words', {
      params: {
        page: params.page || 1,
        page_size: params.page_size || 20,
        tag: params.tag,
        frequency: params.frequency,
      },
    });
    return res.data;
  },

  /**
   * 获取学习进度
   * GET /api/v1/vocab/progress
   */
  async getProgress(): Promise<VocabProgress> {
    const res = await client.get('/api/v1/vocab/progress');
    return res.data;
  },

  /**
   * 获取今日待复习词汇
   * GET /api/v1/vocab/due
   */
  async getDueWords(): Promise<VocabWord[]> {
    const res = await client.get('/api/v1/vocab/due');
    // 后端可能返回数组或 {items: [...]}
    if (Array.isArray(res.data)) return res.data;
    return res.data?.items || [];
  },

  /**
   * 提交词汇学习事件
   * POST /api/v1/vocab/progress
   */
  async submitWordEvent(wordId: string, event: WordEvent): Promise<void> {
    await client.post('/api/v1/vocab/progress', {
      word_id: wordId,
      event,
    });
  },
};
