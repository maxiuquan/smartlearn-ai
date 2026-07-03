import { api, pageApi, PageParams } from './request';
import { Workbook, PaginatedResponse } from '@/types';

// 获取习题册列表
export async function getWorkbookList(params: PageParams): Promise<PaginatedResponse<Workbook>> {
  return pageApi.get<Workbook>('/workbooks', params);
}

// 获取习题册详情
export async function getWorkbook(id: string): Promise<Workbook> {
  return api.get<Workbook>(`/workbooks/${id}`);
}

// 创建习题册
export async function createWorkbook(data: Partial<Workbook>): Promise<Workbook> {
  return api.post<Workbook>('/workbooks', data);
}

// 更新习题册
export async function updateWorkbook(id: string, data: Partial<Workbook>): Promise<Workbook> {
  return api.put<Workbook>(`/workbooks/${id}`, data);
}

// 删除习题册
export async function deleteWorkbook(id: string): Promise<void> {
  return api.delete<void>(`/workbooks/${id}`);
}

// 发布习题册
export async function publishWorkbook(id: string): Promise<void> {
  return api.post<void>(`/workbooks/${id}/publish`);
}

// 添加题目到习题册
export async function addQuestions(id: string, questionIds: string[]): Promise<void> {
  return api.post<void>(`/workbooks/${id}/questions`, { questionIds });
}

// 从习题册移除题目
export async function removeQuestions(id: string, questionIds: string[]): Promise<void> {
  return api.delete<void>(`/workbooks/${id}/questions`, { data: { questionIds } });
}

// 调整题目顺序
export async function reorderQuestions(id: string, questionIds: string[]): Promise<void> {
  return api.post<void>(`/workbooks/${id}/reorder`, { questionIds });
}

// 获取习题册统计
export async function getWorkbookStats(id: string): Promise<{
  questionCount: number;
  completionCount: number;
  avgScore: number;
}> {
  return api.get(`/workbooks/${id}/stats`);
}
