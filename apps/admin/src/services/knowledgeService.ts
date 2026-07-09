import { api, pageApi, PageParams } from './request';
import { KnowledgePoint, PaginatedResponse } from '@/types';

// 后端实际路由（/api/v1 前缀由 baseURL 统一处理）：
//   GET  /knowledge/search?q=&subject=&limit=    搜索知识点
//   GET  /knowledge/{subject}                     学科知识点树
//   GET  /knowledge/points/{kp_id}                知识点详情
// 后端知识点为只读接口，下列写操作（创建/更新/删除/移动/依赖/导入）后端尚未实现。

// 获取知识点列表
// 后端为 GET /knowledge（admin_data 路由提供的分页列表，支持 subject/q 可选筛选）
export async function getKnowledgeList(params: PageParams): Promise<PaginatedResponse<KnowledgePoint>> {
  return pageApi.get<KnowledgePoint>('/knowledge', params);
}

// 获取知识点树
// 后端为 GET /knowledge/{subject}（subject 为路径参数）
// 无 subject 时调用 GET /knowledge/tree 返回全部知识点的扁平列表
export async function getKnowledgeTree(subject?: string): Promise<KnowledgePoint[]> {
  if (subject) {
    return api.get<KnowledgePoint[]>(`/knowledge/${subject}`);
  }
  return api.get<KnowledgePoint[]>('/knowledge/tree');
}

// 获取知识点详情
// 后端为 GET /knowledge/points/{kp_id}
export async function getKnowledge(id: string): Promise<KnowledgePoint> {
  return api.get<KnowledgePoint>(`/knowledge/points/${id}`);
}

// 创建知识点
// TODO: 后端尚未实现此路由
export async function createKnowledge(data: Partial<KnowledgePoint>): Promise<KnowledgePoint> {
  return api.post<KnowledgePoint>('/knowledge', data);
}

// 更新知识点
// TODO: 后端尚未实现此路由
export async function updateKnowledge(id: string, data: Partial<KnowledgePoint>): Promise<KnowledgePoint> {
  return api.put<KnowledgePoint>(`/knowledge/${id}`, data);
}

// 删除知识点
// TODO: 后端尚未实现此路由
export async function deleteKnowledge(id: string): Promise<void> {
  return api.delete<void>(`/knowledge/${id}`);
}

// 移动知识点
// TODO: 后端尚未实现此路由
export async function moveKnowledge(id: string, parentId: string | null, order: number): Promise<void> {
  return api.post<void>(`/knowledge/${id}/move`, { parentId, order });
}

// 设置依赖关系
// TODO: 后端尚未实现此路由
export async function setDependencies(id: string, dependencies: string[]): Promise<void> {
  return api.post<void>(`/knowledge/${id}/dependencies`, { dependencies });
}

// 获取依赖关系图
// TODO: 后端尚未实现此路由
export async function getDependencyGraph(subject: string): Promise<{
  nodes: { id: string; name: string }[];
  edges: { source: string; target: string }[];
}> {
  return api.get(`/knowledge/dependency-graph`, { params: { subject } });
}

// 批量导入知识点
// TODO: 后端尚未实现此路由
export async function importKnowledge(file: File): Promise<{ success: number; failed: number }> {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<{ success: number; failed: number }>('/knowledge/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
