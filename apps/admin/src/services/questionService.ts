import request, { api, pageApi, PageParams } from './request';
import { Question, PaginatedResponse } from '@/types';

// 获取题目列表
export async function getQuestionList(params: PageParams): Promise<PaginatedResponse<Question>> {
  return pageApi.get<Question>('/questions', params);
}

// 获取题目详情
export async function getQuestion(id: string): Promise<Question> {
  return api.get<Question>(`/questions/${id}`);
}

// 创建题目
export async function createQuestion(data: Partial<Question>): Promise<Question> {
  return api.post<Question>('/questions', data);
}

// 更新题目
export async function updateQuestion(id: string, data: Partial<Question>): Promise<Question> {
  return api.put<Question>(`/questions/${id}`, data);
}

// 删除题目
export async function deleteQuestion(id: string): Promise<void> {
  return api.delete<void>(`/questions/${id}`);
}

// 批量删除题目
export async function batchDeleteQuestions(ids: string[]): Promise<void> {
  return api.post<void>('/questions/batch-delete', { ids });
}

// 批量导入题目
export async function importQuestions(file: File): Promise<{ success: number; failed: number; errors: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<{ success: number; failed: number; errors: string[] }>('/questions/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// 导出题目
export async function exportQuestions(params: PageParams): Promise<Blob> {
  const response = await request.get('/questions/export', {
    params,
    responseType: 'blob',
  });
  return response.data as Blob;
}

// 获取题目统计
export async function getQuestionStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  bySubject: Record<string, number>;
  byDifficulty: Record<string, number>;
}> {
  return api.get('/questions/stats');
}

// 审核题目
export async function reviewQuestion(id: string, status: 'approved' | 'rejected', comment?: string): Promise<void> {
  return api.post<void>(`/questions/${id}/review`, { status, comment });
}
