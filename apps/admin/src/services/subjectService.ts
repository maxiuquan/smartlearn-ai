import { api, pageApi, PageParams } from './request';
import { Subject, PaginatedResponse } from '@/types';

// 获取学科列表
export async function getSubjectList(params?: PageParams): Promise<PaginatedResponse<Subject>> {
  return pageApi.get<Subject>('/subjects', params);
}

// 获取所有学科（不分页）
export async function getAllSubjects(): Promise<Subject[]> {
  return api.get<Subject[]>('/subjects/all');
}

// 获取学科详情
export async function getSubject(id: string): Promise<Subject> {
  return api.get<Subject>(`/subjects/${id}`);
}

// 创建学科
export async function createSubject(data: Partial<Subject>): Promise<Subject> {
  return api.post<Subject>('/subjects', data);
}

// 更新学科
export async function updateSubject(id: string, data: Partial<Subject>): Promise<Subject> {
  return api.put<Subject>(`/subjects/${id}`, data);
}

// 删除学科
export async function deleteSubject(id: string): Promise<void> {
  return api.delete<void>(`/subjects/${id}`);
}

// 启用/禁用学科
export async function toggleSubject(id: string, status: boolean): Promise<void> {
  return api.post<void>(`/subjects/${id}/toggle`, { status });
}

// 获取学科统计
export async function getSubjectStats(id: string): Promise<{
  questionCount: number;
  knowledgeCount: number;
  userCount: number;
}> {
  return api.get(`/subjects/${id}/stats`);
}
