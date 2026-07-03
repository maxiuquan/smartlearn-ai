import { api, pageApi } from './request';
import { User, LoginParams, LoginResult, PaginatedResponse } from '@/types';

// 登录
export async function login(params: LoginParams): Promise<LoginResult> {
  return api.post<LoginResult>('/auth/login', params);
}

// 获取当前用户信息
export async function getCurrentUser(): Promise<User> {
  return api.get<User>('/auth/me');
}

// 退出登录
export async function logout(): Promise<void> {
  return api.post<void>('/auth/logout');
}

// 修改密码
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return api.post<void>('/auth/change-password', { oldPassword, newPassword });
}

// 刷新Token
export async function refreshToken(): Promise<{ token: string }> {
  return api.post<{ token: string }>('/auth/refresh');
}
