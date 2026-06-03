import { api, pageApi, PageParams } from './request';
import { KnowledgePoint, PaginatedResponse } from '@/types';

// 获取知识点列表
export async function getKnowledgeList(params: PageParams): Promise<PaginatedResponse<KnowledgePoint>> {
  return pageApi.get<KnowledgePoint>('/knowledge-points', params);
}

// 获取知识点树
export async function getKnowledgeTree(subject?: string): Promise<KnowledgePoint[]> {
  return api.get<KnowledgePoint[]>('/knowledge-points/tree', { params: { subject } });
}

// 获取知识点详情
export async function getKnowledge(id: string): Promise<KnowledgePoint> {
  return api.get<KnowledgePoint>(`/knowledge-points/${id}`);
}

// 创建知识点
export async function createKnowledge(data: Partial<KnowledgePoint>): Promise<KnowledgePoint> {
  return api.post<KnowledgePoint>('/knowledge-points', data);
}

// 更新知识点
export async function updateKnowledge(id: string, data: Partial<KnowledgePoint>): Promise<KnowledgePoint> {
  return api.put<KnowledgePoint>(`/knowledge-points/${id}`, data);
}

// 删除知识点
export async function deleteKnowledge(id: string): Promise<void> {
  return api.delete<void>(`/knowledge-points/${id}`);
}

// 移动知识点
export async function moveKnowledge(id: string, parentId: string | null, order: number): Promise<void> {
  return api.post<void>(`/knowledge-points/${id}/move`, { parentId, order });
}

// 设置依赖关系
export async function setDependencies(id: string, dependencies: string[]): Promise<void> {
  return api.post<void>(`/knowledge-points/${id}/dependencies`, { dependencies });
}

// 获取依赖关系图
export async function getDependencyGraph(subject: string): Promise<{
  nodes: { id: string; name: string }[];
  edges: { source: string; target: string }[];
}> {
  return api.get(`/knowledge-points/dependency-graph`, { params: { subject } });
}

// 批量导入知识点
export async function importKnowledge(file: File): Promise<{ success: number; failed: number }> {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<{ success: number; failed: number }>('/knowledge-points/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
