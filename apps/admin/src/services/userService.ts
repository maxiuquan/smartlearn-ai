import request, { api, pageApi, PageParams } from './request';
import { User, UserStats, UserRole, PaginatedResponse } from '@/types';

// 获取用户列表
export async function getUserList(params: PageParams): Promise<PaginatedResponse<User>> {
  return pageApi.get<User>('/users', params);
}

// getUsers 作为 getUserList 的别名
export const getUsers = getUserList;

// 获取用户详情
export async function getUser(id: string): Promise<User> {
  return api.get<User>(`/users/${id}`);
}

// 创建用户
export async function createUser(data: Partial<User>): Promise<User> {
  return api.post<User>('/users', data);
}

// 更新用户
export async function updateUser(id: string, data: Partial<User>): Promise<User> {
  return api.put<User>(`/users/${id}`, data);
}

// 禁用用户
export async function banUser(id: string, reason: string): Promise<void> {
  return api.post<void>(`/users/${id}/ban`, { reason });
}

// 启用用户
export async function enableUser(id: string): Promise<void> {
  return api.post<void>(`/users/${id}/enable`);
}

// 删除用户
export async function deleteUser(id: string): Promise<void> {
  return api.delete<void>(`/users/${id}`);
}

// 获取用户统计
export async function getUserStats(id: string): Promise<UserStats> {
  return api.get<UserStats>(`/users/${id}/stats`);
}

// 批量导入用户
export async function importUsers(file: File): Promise<{ success: number; failed: number }> {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<{ success: number; failed: number }>('/users/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// 导出用户
export async function exportUsers(params?: PageParams): Promise<Blob> {
  const response = await request.get('/v1/users/export', {
    params,
    responseType: 'blob',
  });
  return response.data as Blob;
}

// 重置用户密码
export async function resetPassword(id: string, new_password: string): Promise<void> {
  return api.post<void>(`/users/${id}/reset-password`, { new_password });
}

// 更新用户角色
export async function updateUserRole(id: string, role: UserRole): Promise<void> {
  return api.put<void>(`/users/${id}/role`, { role });
}

// 更新用户 VIP 信息
export async function updateUserVip(
  id: string,
  data: { vip_level: number; vip_expire_at?: string; ai_quota_daily_override?: number }
): Promise<void> {
  return api.put<void>(`/users/${id}/vip`, data);
}
