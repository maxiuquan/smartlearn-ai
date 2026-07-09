import { api, pageApi, PageParams } from './request';
import { PastExam, PaginatedResponse } from '@/types';

// 后端无 /past-exams 路由，以下真题管理接口后端均尚未实现。保留方法以使页面可加载。

// 获取真题列表
// TODO: 后端尚未实现此路由
export async function getPastExamList(params: PageParams): Promise<PaginatedResponse<PastExam>> {
  return pageApi.get<PastExam>('/past-exams', params);
}

// 获取真题详情
// TODO: 后端尚未实现此路由
export async function getPastExam(id: string): Promise<PastExam> {
  return api.get<PastExam>(`/past-exams/${id}`);
}

// 创建真题
// TODO: 后端尚未实现此路由
export async function createPastExam(data: Partial<PastExam>): Promise<PastExam> {
  return api.post<PastExam>('/past-exams', data);
}

// 更新真题
// TODO: 后端尚未实现此路由
export async function updatePastExam(id: string, data: Partial<PastExam>): Promise<PastExam> {
  return api.put<PastExam>(`/past-exams/${id}`, data);
}

// 删除真题
// TODO: 后端尚未实现此路由
export async function deletePastExam(id: string): Promise<void> {
  return api.delete<void>(`/past-exams/${id}`);
}

// 发布真题
// TODO: 后端尚未实现此路由
export async function publishPastExam(id: string): Promise<void> {
  return api.post<void>(`/past-exams/${id}/publish`);
}

// 获取真题统计
// TODO: 后端尚未实现此路由
export async function getPastExamStats(): Promise<{
  total: number;
  byYear: Record<number, number>;
  bySubject: Record<string, number>;
  byProvince: Record<string, number>;
}> {
  return api.get('/past-exams/stats');
}

// 批量导入真题
// TODO: 后端尚未实现此路由
export async function importPastExams(file: File): Promise<{ success: number; failed: number }> {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<{ success: number; failed: number }>('/past-exams/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
