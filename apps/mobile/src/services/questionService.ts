import { apiClient } from './apiClient';
import { Question, PaginatedResponse } from '../types';

interface GetQuestionsParams {
  type?: string;
  difficulty?: string;
  knowledgePointId?: string;
  page?: number;
  pageSize?: number;
}

class QuestionService {
  async getQuestions(params: GetQuestionsParams): Promise<PaginatedResponse<Question>> {
    const response = await apiClient.get<PaginatedResponse<Question>>('/questions', params);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get questions');
    }
    return response.data;
  }

  async getQuestionById(id: string): Promise<Question> {
    const response = await apiClient.get<Question>(`/questions/${id}`);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get question');
    }
    return response.data;
  }

  /**
   * Fetch a batch of random questions, optionally filtered by type and difficulty.
   * @param count - Number of questions to retrieve.
   * @param params - Optional filter parameters (type, difficulty, knowledgePointId).
   */
  async getRandomQuestions(
    count: number,
    params?: { type?: string; difficulty?: string; knowledgePointId?: string }
  ): Promise<Question[]> {
    const response = await apiClient.get<Question[]>('/questions/random', {
      count,
      ...params,
    });
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get random questions');
    }
    return response.data;
  }

  async submitAnswer(questionId: string, answer: string, timeSpent: number): Promise<{
    isCorrect: boolean;
    correctAnswer: string;
    analysis: string;
  }> {
    const response = await apiClient.post(`/questions/${questionId}/submit`, {
      answer,
      timeSpent,
    });
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to submit answer');
    }
    return response.data;
  }

  async getQuestionsByWorkbook(workbookId: string): Promise<Question[]> {
    const response = await apiClient.get<Question[]>(`/workbooks/${workbookId}/questions`);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get workbook questions');
    }
    return response.data;
  }

  async getPastExamQuestions(examId: string): Promise<Question[]> {
    const response = await apiClient.get<Question[]>(`/past-exams/${examId}/questions`);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get past exam questions');
    }
    return response.data;
  }
}

export const questionService = new QuestionService();
