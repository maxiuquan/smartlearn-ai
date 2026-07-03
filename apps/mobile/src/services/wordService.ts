import { apiClient } from './apiClient';
import { Word, PaginatedResponse } from '../types';

interface GetWordsParams {
  difficulty?: string;
  mastered?: boolean;
  page?: number;
  pageSize?: number;
}

class WordService {
  async getWords(params: GetWordsParams): Promise<PaginatedResponse<Word>> {
    const response = await apiClient.get<PaginatedResponse<Word>>('/words', params);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get words');
    }
    return response.data;
  }

  async getWordsToReview(): Promise<Word[]> {
    const response = await apiClient.get<Word[]>('/words/review');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get review words');
    }
    return response.data;
  }

  async getDailyWords(count: number): Promise<Word[]> {
    const response = await apiClient.get<Word[]>('/words/daily', { count });
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get daily words');
    }
    return response.data;
  }

  async markWordProgress(wordId: string, correct: boolean): Promise<void> {
    const response = await apiClient.post(`/words/${wordId}/progress`, { correct });
    if (!response.success) {
      throw new Error(response.error || 'Failed to mark progress');
    }
  }

  async searchWords(query: string): Promise<Word[]> {
    const response = await apiClient.get<Word[]>('/words/search', { q: query });
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to search words');
    }
    return response.data;
  }

  async getWordById(id: string): Promise<Word> {
    const response = await apiClient.get<Word>(`/words/${id}`);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get word');
    }
    return response.data;
  }
}

export const wordService = new WordService();
